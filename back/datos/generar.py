"""Datos sintéticos de Ritmo: 500 usuarios, historial del 1 may al 31 oct 2026.

Uso, desde back/:  python -m datos.generar
Borra todo (menos la configuración guardada) y vuelve a cargar. Se puede correr varias veces.

Se simulan dos mundos con las mismas intenciones de cada usuario (ver comportamiento.py):
- "Ritmo" (lo que queda en la base): regla actual hasta RITMO_DESDE; desde ahí decide el motor.
- "Regla actual" (contrafactual): todos con 2 tickets, 7 días, solo estacionamiento. Solo se guardan
  sus métricas diarias (tabla metricas_regla_actual), hasta 90 días después de hoy para que el
  reloj de demo pueda avanzar.
"""
import time
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy import inspect

from app import config as C
from app import db, reloj
from app.motor.cobros import comision_por_desfase, descuento_por_nivel, estado_por_atraso, nuevo_ticket
from app.motor.decisiones import prestar_para, validar_solicitud
from app.motor.perfil import evaluar_usuario
from datos import comportamiento as cp

FECHA_RELOJ = cp.FECHA_RELOJ
INICIO_HISTORIAL = date(2026, 5, 1)
FIN_REGLA_ACTUAL = FECHA_RELOJ + timedelta(days=90)
REGISTRO_DESDE, REGISTRO_HASTA = date(2026, 1, 1), date(2026, 10, 25)
N_USUARIOS = 500
MEZCLA = {"puntual": 0.30, "conductor": 0.25, "ocasional": 0.20, "moroso": 0.10, "sin_credito": 0.15}
PROP_CEDULA = 0.94
PROP_VEHICULO = 0.87
PROP_VEHICULO_SIN_CREDITO = 0.70
PROP_PUSH = 0.70
SALDO_MAX, SALDO_MAX_MOROSO = 20.0, 3.0
CLUBES = ["Turista", "Caminante · Ruta Colonial", "Explorador · Ruta Andina", "Viajero · Ruta del Sol"]
DIAS_FOTOS = 14   # fotos diarias hacia atrás: movimientos de la semana y "score cayendo"
LOTE = 1000
SCHEMA = Path(__file__).with_name("schema.sql")

NOMBRES = ["Ana", "Luis", "Carmen", "José", "Daniela", "Miguel", "Gabriela", "Jesús", "Valentina", "Andrés",
           "Mariana", "Alejandro", "Andrea", "Ricardo", "Paola", "Jorge", "Isabel", "Rafael", "Sofía", "Diego",
           "Fernanda", "Héctor", "Lucía", "Víctor", "Elena", "Francisco", "Rosa", "Manuel", "Patricia", "Oscar",
           "Adriana", "Eduardo", "Verónica", "Alberto", "Natalia", "Gustavo", "Camila", "Raúl", "Laura", "Simón",
           "Daniel", "Carla", "Ana", "Pedro"]


def _dias(desde, hasta):
    d = desde
    while d <= hasta:
        yield d
        d += timedelta(days=1)


def primera_habilitacion(usuario, eventos):
    """Primer día en que cumple todos los requisitos (puede ser futuro), o None si nunca los cumple."""
    req = C.REQUISITOS
    if (req["cedula"] and not usuario["cedula_verificada"]) or (req["vehiculo"] and not usuario["vehiculo_verificado"]):
        return None
    desde = usuario["fecha_registro"] + timedelta(days=req["dias"])
    if req["pagos"] > 0:
        pagos = sorted(e["fecha"] for e in eventos if e["tipo"] == "pago_servicio" and e.get("a_tiempo") is True)
        if len(pagos) < req["pagos"]:
            return None
        desde = max(desde, pagos[req["pagos"] - 1])
    return desde


def ticket_a_la_fecha(t, d):
    """Estado que tenía un ticket generado en la fecha `d` (None si aún no existía)."""
    if t["fecha_uso"] > d:
        return None
    fila = {k: v for k, v in t.items() if not k.startswith("_")}
    plan, vence = t["_plan"], t["fecha_vencimiento"]
    if plan is not None and plan <= d:
        comision = comision_por_desfase(t) if (plan - vence).days > C.GRACIA_DIAS else 0.0
        descuento = t.get("_descuento", 0.0) if plan < vence else 0.0
        fila.update(estado="pagado", fecha_pago=plan, comision=comision, descuento=descuento, pago_planeado=None,
                    monto_pagado=round(t["monto"] + t["gasto_admin"] + comision - descuento, 2))
    else:
        estado = estado_por_atraso((d - vence).days)
        fila.update(estado=estado, fecha_pago=None, monto_pagado=0.0, descuento=0.0, pago_planeado=plan,
                    comision=comision_por_desfase(t) if estado in ("atrasado", "mora") else 0.0)
    return fila


def _eventos_de_ticket(t) -> list:
    """Eventos del mundo Ritmo de un ticket: uso, comisión si pasó la gracia, y repago."""
    uid, vence, plan = t["user_id"], t["fecha_vencimiento"], t["_plan"]
    base = {"user_id": uid, "servicio": t["servicio"], "ticket_id": t["id"]}
    eventos = [{**base, "fecha": t["fecha_uso"], "tipo": "uso_ticket", "monto": t["monto"], "a_tiempo": None}]
    dia_comision = vence + timedelta(days=C.GRACIA_DIAS + 1)
    tarde = plan is None or (plan - vence).days > C.GRACIA_DIAS
    if tarde and dia_comision <= FECHA_RELOJ:
        eventos.append({**base, "fecha": dia_comision, "tipo": "comision", "monto": comision_por_desfase(t),
                        "a_tiempo": None})
    if plan is not None and plan <= FECHA_RELOJ:
        pagado = ticket_a_la_fecha(t, plan)["monto_pagado"]
        eventos.append({**base, "fecha": plan, "tipo": "repago_ticket", "monto": pagado, "a_tiempo": plan <= vence})
    return eventos


class Lote:
    def __init__(self):
        self.usuarios, self.eventos, self.tickets, self.solicitudes, self.regla_actual = [], [], [], [], []

    def siguiente_ticket(self) -> int:
        return len(self.tickets) + 1

    def usuario(self, uid, nombre, alias, registro, cedula, vehiculo, saldo, perfil, quincenero, canal, club):
        u = {"id": uid, "nombre": nombre, "alias": alias, "fecha_registro": registro, "cedula_verificada": cedula,
             "vehiculo_verificado": vehiculo, "saldo_wallet": round(saldo, 4), "perfil_sintetico": perfil,
             "quincenero": quincenero, "canal_preferido": canal, "club": club, "habilitado_desde": None,
             "modo_recuperacion": False}
        self.usuarios.append(u)
        return u

    def ticket_ritmo(self, u, servicio, comercio, monto, uso, plan=None, vence=None, descuento_nivel=None):
        t = nuevo_ticket(self.siguiente_ticket(), u["id"], servicio, comercio, monto, uso)
        if vence:
            t["fecha_vencimiento"] = vence
        t["_plan"] = plan
        t["_descuento"] = descuento_por_nivel(t, descuento_nivel) if descuento_nivel is not None else 0.0
        self.tickets.append(t)
        self.eventos.extend(_eventos_de_ticket(t))
        self.solicitudes.append({"user_id": u["id"], "fecha": uso, "servicio": servicio, "monto": monto,
                                 "resultado": "aprobada", "motivo": None, "ticket_id": t["id"]})
        return t


# --- Usuarios generados ----------------------------------------------------------------

def _historia(lote, u):
    """Simula los dos mundos para un usuario generado."""
    uid = u["id"]
    inicio = max(u["fecha_registro"], INICIO_HISTORIAL)
    actividad = [e for d in _dias(inicio, FIN_REGLA_ACTUAL) for e in cp.actividad(u, d)]
    habilitado_desde = primera_habilitacion(u, actividad)
    eventos = [e for e in actividad if e["fecha"] <= FECHA_RELOJ]
    tickets_ritmo, tickets_regla = [], []
    nivel = None

    def estado_en(d):
        return [x for x in (ticket_a_la_fecha(t, d) for t in tickets_ritmo) if x]

    for d in _dias(inicio, FIN_REGLA_ACTUAL):
        habilitado = habilitado_desde is not None and d >= habilitado_desde
        if (d <= FECHA_RELOJ and d >= C.RITMO_DESDE and habilitado
                and (nivel is None or (d - C.RITMO_DESDE).days % 7 == 0)):
            estado = estado_en(d)
            ud = {**u, "habilitado_desde": habilitado_desde,
                  "modo_recuperacion": any(t["estado"] == "mora" for t in estado)}
            perfil, _ = evaluar_usuario(ud, [e for e in eventos if e["fecha"] <= d], estado, d, nivel)
            nivel = perfil["nivel"]

        intento = cp.intencion(u, d)
        if not intento:
            continue
        servicio, monto, comercio = intento["servicio"], intento["monto"], intento["comercio"]

        # Mundo "regla actual": 2 tickets, 7 días, solo estacionamiento, para todos
        abiertos = [t for t in tickets_regla if t["_plan"] is None or t["_plan"] > d]
        if (servicio in C.REGLA_ACTUAL["servicios"] and len(abiertos) < C.REGLA_ACTUAL["tickets"]
                and all(t["fecha_vencimiento"] >= d for t in abiertos)):
            t = nuevo_ticket(None, uid, servicio, comercio, min(monto, C.REGLA_ACTUAL["monto_max"]), d)
            t["_plan"] = cp.plan_de_pago(u, t, False, None, False, riesgo=not habilitado)
            tickets_regla.append(t)

        # Mundo Ritmo (solo hasta hoy)
        if d > FECHA_RELOJ:
            continue
        ritmo = d >= C.RITMO_DESDE
        estado = estado_en(d)
        mora = any(t["estado"] == "mora" for t in estado)
        prestar = (prestar_para(habilitado, nivel, estado, mora) if ritmo
                   else prestar_para(True, None, estado, mora, C.REGLA_ACTUAL))
        v = validar_solicitud(prestar, servicio, monto, float("inf"))
        ticket_id = None
        if v["resultado"] != "rechazada":
            t = nuevo_ticket(lote.siguiente_ticket(), uid, servicio, comercio, v["credito"], d)
            cp.planificar(u, t, nivel if ritmo else None, d, riesgo=not habilitado)
            t["_plan"] = t.pop("pago_planeado")
            t["pago_planeado"] = None
            t["_descuento"] = descuento_por_nivel(t, nivel) if ritmo else 0.0
            lote.tickets.append(t)
            tickets_ritmo.append(t)
            eventos.extend(_eventos_de_ticket(t))
            ticket_id = t["id"]
        if v["motivo"] not in C.MOTIVOS_SIN_SOLICITUD:
            lote.solicitudes.append({"user_id": uid, "fecha": d, "servicio": servicio, "monto": monto,
                                     "resultado": v["resultado"], "motivo": v["motivo"], "ticket_id": ticket_id})

    lote.eventos.extend(eventos)
    lote.regla_actual.extend(tickets_regla)
    return habilitado_desde


def _usuarios_generados(lote, rng):
    perfiles = [p for p, prop in MEZCLA.items() for _ in range(round(prop * N_USUARIOS))]
    rng.shuffle(perfiles)
    ids = [i for i in range(1, N_USUARIOS + 1) if f"u_{i:04d}" not in cp.HISTORIA]
    rango = (REGISTRO_HASTA - REGISTRO_DESDE).days
    for i, perfil in zip(ids, perfiles):
        nombre = rng.choice(NOMBRES)
        u = lote.usuario(
            f"u_{i:04d}", nombre, f"@{nombre.lower()}.{rng.choice('abcdefghijklmnoprstv')}",
            REGISTRO_DESDE + timedelta(days=rng.randint(0, rango)),
            rng.random() < PROP_CEDULA,
            rng.random() < (PROP_VEHICULO_SIN_CREDITO if perfil == "sin_credito" else PROP_VEHICULO),
            rng.uniform(0, SALDO_MAX_MOROSO if perfil == "moroso" else SALDO_MAX), perfil,
            rng.random() < C.QUINCENEROS, "push" if rng.random() < PROP_PUSH else "wisi", rng.choice(CLUBES))
        u["_habilitado_desde"] = _historia(lote, u)


# --- Usuarios de historia --------------------------------------------------------------

def _maria(lote, rng):
    """Confiable, Puntual, cobra el 15 y el 30, racha 2 de 3. Hoy usa un ticket en C.C. El Tolón."""
    u = lote.usuario("u_0142", "María", "@maria.r", date(2026, 3, 10), True, True, 1.38 / C.TASA_BS,
                     "puntual", True, "push", "Caminante · Ruta Colonial")
    for d in _dias(INICIO_HISTORIAL, FECHA_RELOJ):
        if d.day == 15:
            lote.eventos.append(_ev(u, d, "recarga", None, rng.uniform(25, 45)))
            lote.eventos.append(_ev(u, d, "pago_servicio", "luz", rng.uniform(9, 14), True))
        if d.day == 30:
            lote.eventos.append(_ev(u, d, "recarga", None, rng.uniform(25, 45)))
            lote.eventos.append(_ev(u, d, "pago_servicio", "telefono", rng.uniform(5, 9), True))
    servicios = [("estacionamiento", "C.C. El Tolón"), ("peaje", "Peaje Tazón"), ("estacionamiento", "C.C. Líder")]
    uso, i = date(2026, 6, 2), 0
    while uso <= date(2026, 10, 21):
        servicio, comercio = servicios[i % 3]
        vence = uso + timedelta(days=C.PLAZO_BASE_DIAS)
        tarde = uso in (date(2026, 8, 7), date(2026, 9, 18))   # dos pagos dentro de la gracia
        plan = vence + timedelta(days=1) if tarde else (vence - timedelta(days=3) if i % 4 == 0 else vence)
        lote.ticket_ritmo(u, servicio, comercio, round(rng.uniform(3.5, 4.8), 2), uso, plan,
                          descuento_nivel=2 if uso >= C.RITMO_DESDE else None)
        uso += timedelta(days=6)
        i += 1
    lote.eventos.append(_ev(u, date(2026, 10, 30), "pago_servicio", "telefono", 6.2, True))
    lote.ticket_ritmo(u, "estacionamiento", "C.C. El Tolón", 4.36, FECHA_RELOJ)


def _carmen(lote, rng):
    """Aún sin Credirecto: cédula verificada, falta el vehículo y 1 de 2 pagos a tiempo."""
    u = lote.usuario("u_0333", "Carmen", "@carmen.s", date(2026, 8, 20), True, False, 1.38 / C.TASA_BS,
                     "ocasional", False, "push", "Turista")
    lote.eventos += [_ev(u, date(2026, 9, 1), "recarga", None, 20.0),
                     _ev(u, date(2026, 9, 15), "pago_servicio", "luz", 11.4, True),
                     _ev(u, date(2026, 10, 1), "recarga", None, 15.0),
                     _ev(u, date(2026, 10, 17), "pago_servicio", "luz", 12.1, False),
                     _ev(u, date(2026, 10, 22), "pago_servicio", "estacionamiento", 2.0, None)]


def _pedro(lote, rng):
    """Pagaba bien, pero el 24 oct usó 2 tickets que vencen hoy y no los pagará."""
    u = lote.usuario("u_0007", "Pedro", "@pedro.g", date(2026, 6, 1), True, True, 4.0, "conductor", False,
                     "wisi", "Explorador · Ruta Andina")
    for d in _dias(u["fecha_registro"], date(2026, 10, 24)):
        if d.day == 1:
            lote.eventos.append(_ev(u, d, "recarga", None, rng.uniform(20, 40)))
            lote.eventos.append(_ev(u, d, "pago_servicio", "telefono", rng.uniform(5, 9), True))
        if rng.random() < 0.5:
            servicio = rng.choice(["estacionamiento", "peaje"])
            lote.eventos.append(_ev(u, d, "pago_servicio", servicio, rng.uniform(0.5, 3)))
    uso = date(2026, 6, 3)
    while uso <= date(2026, 10, 10):
        vence = uso + timedelta(days=C.PLAZO_BASE_DIAS)
        lote.ticket_ritmo(u, "estacionamiento", "C.C. Sambil Chacao", round(rng.uniform(2, 5), 2), uso,
                          vence - timedelta(days=1))
        uso += timedelta(days=8)
    lote.ticket_ritmo(u, "estacionamiento", "C.C. Sambil Chacao", 3.5, date(2026, 10, 24))
    lote.ticket_ritmo(u, "peaje", "Peaje Tazón", 4.0, date(2026, 10, 24))


def _ev(u, fecha, tipo, servicio, monto, a_tiempo=None) -> dict:
    return {"user_id": u["id"], "fecha": fecha, "tipo": tipo, "servicio": servicio, "monto": round(monto, 2),
            "ticket_id": None, "a_tiempo": a_tiempo}


# --- Armado --------------------------------------------------------------------------

def construir() -> Lote:
    np.random.seed(cp.SEMILLA)
    rng = cp.rng("generador")
    lote = Lote()
    _usuarios_generados(lote, rng)
    _maria(lote, rng)
    _carmen(lote, rng)
    _pedro(lote, rng)
    for u in lote.usuarios:
        if "_habilitado_desde" not in u:
            u["_habilitado_desde"] = primera_habilitacion(u, [e for e in lote.eventos if e["user_id"] == u["id"]])
    lote.usuarios.sort(key=lambda u: u["id"])
    lote.eventos.sort(key=lambda e: (e["fecha"], e["user_id"]))
    return lote


def metricas_regla_actual(lote) -> list:
    """Métricas diarias del mundo "regla actual", con las mismas definiciones que /resumen usa para Ritmo."""
    dias = list(_dias(INICIO_HISTORIAL, FIN_REGLA_ACTUAL))
    m = {d: dict(prestado=0.0, usos=0, usos_reusados=0, vencidos=0, a_tiempo=0, llegaron_a_mora=0,
                 comisiones=0.0, deuda_mora=0.0) for d in dias}
    deuda_delta = defaultdict(float)
    por_usuario = defaultdict(list)
    for t in lote.regla_actual:
        por_usuario[t["user_id"]].append(t["fecha_uso"])
    for t in lote.regla_actual:
        uso, vence, plan = t["fecha_uso"], t["fecha_vencimiento"], t["_plan"]
        m[uso]["prestado"] += t["monto"]
        m[uso]["usos"] += 1
        if any(uso < otro <= uso + timedelta(days=30) for otro in por_usuario[t["user_id"]]):
            m[uso]["usos_reusados"] += 1
        if vence in m:
            m[vence]["vencidos"] += 1
            m[vence]["a_tiempo"] += plan is not None and plan <= vence
            m[vence]["llegaron_a_mora"] += plan is None or (plan - vence).days >= C.MORA_DIA
        # Regla actual: sin gracia ni descuentos; comisión desde el primer día de atraso
        if plan is not None and plan in m:
            m[plan]["comisiones"] += t["gasto_admin"] + (comision_por_desfase(t) if plan > vence else 0)
        inicio_mora = vence + timedelta(days=C.MORA_DIA)
        if plan is None or plan > inicio_mora:
            deuda = t["monto"] + t["gasto_admin"] + comision_por_desfase(t)
            deuda_delta[inicio_mora] += deuda
            if plan is not None:
                deuda_delta[plan] -= deuda
    acumulada = 0.0
    registrados = sorted(u["fecha_registro"] for u in lote.usuarios)
    filas = []
    for d in dias:
        acumulada += deuda_delta.get(d, 0.0)
        fila = m[d]
        filas.append({"fecha": d, **{k: (round(v, 2) if isinstance(v, float) else v) for k, v in fila.items()},
                      "deuda_mora": round(acumulada, 2),
                      "habilitados": sum(1 for r in registrados if r <= d)})
    return filas


def calcular_perfiles(lote):
    """Corre el motor para todos en cada uno de los últimos DIAS_FOTOS días y hoy.

    Devuelve ([(fecha, [(perfil, decision), ...]), ...], usuarios finales, tickets finales).
    """
    eventos, tickets = defaultdict(list), defaultdict(list)
    for e in lote.eventos:
        eventos[e["user_id"]].append(e)
    for t in lote.tickets:
        tickets[t["user_id"]].append(t)

    por_dia, niveles, scores = [], {}, defaultdict(dict)
    usuarios_finales, tickets_finales = [], []
    for atras in range(DIAS_FOTOS, -1, -1):
        d = FECHA_RELOJ - timedelta(days=atras)
        resultados = []
        for u in lote.usuarios:
            uid = u["id"]
            tk = [x for x in (ticket_a_la_fecha(t, d) for t in tickets[uid]) if x]
            hab = u["_habilitado_desde"]
            ud = {k: v for k, v in u.items() if not k.startswith("_")}
            ud.update(habilitado_desde=hab if hab and hab <= d else None,
                      modo_recuperacion=any(t["estado"] == "mora" for t in tk))
            perfil, decision = evaluar_usuario(ud, [e for e in eventos[uid] if e["fecha"] <= d], tk, d,
                                               niveles.get(uid), scores[uid].get(d - timedelta(days=7)))
            niveles[uid] = perfil["nivel"]
            scores[uid][d] = perfil["trust_score"]
            resultados.append((perfil, decision))
            if d == FECHA_RELOJ:
                usuarios_finales.append(ud)
                tickets_finales += tk
        por_dia.append((d, resultados))
    return por_dia, usuarios_finales, tickets_finales


def _a_sql(conn, df, tabla):
    if len(df):
        df.to_sql(tabla, conn, if_exists="append", index=False, method="multi", chunksize=LOTE)


def _recrear_tablas(conn):
    """Borra las tablas de datos (conserva la configuración) y crea el esquema actual."""
    existentes = set(inspect(conn).get_table_names())
    for tabla in db.TABLAS_DE_DATOS:
        if tabla in existentes:
            conn.exec_driver_sql(f"drop table {tabla} cascade")
    conn.exec_driver_sql(SCHEMA.read_text(encoding="utf-8"))


def generar(engine=None) -> dict:
    inicio = time.perf_counter()
    engine = engine or db.get_engine()
    with engine.begin() as conn:
        _recrear_tablas(conn)
        guardada = db.leer_config(conn)
    if guardada:
        C.aplicar(C.validar(guardada["valores"]))

    lote = construir()
    por_dia, usuarios, tickets = calcular_perfiles(lote)

    eventos = pd.DataFrame(lote.eventos)
    eventos["ticket_id"] = eventos["ticket_id"].astype("Int64")
    eventos["a_tiempo"] = eventos["a_tiempo"].astype(object).where(eventos["a_tiempo"].notna(), None)
    solicitudes = pd.DataFrame(lote.solicitudes)
    solicitudes["ticket_id"] = solicitudes["ticket_id"].astype("Int64")

    with engine.begin() as conn:
        _a_sql(conn, pd.DataFrame(usuarios), "usuarios")
        _a_sql(conn, pd.DataFrame(tickets), "tickets")
        _a_sql(conn, eventos, "eventos")
        _a_sql(conn, solicitudes, "solicitudes")
        _a_sql(conn, pd.DataFrame(metricas_regla_actual(lote)), "metricas_regla_actual")
        conn.exec_driver_sql("select setval(pg_get_serial_sequence('tickets', 'id'), "
                             "(select coalesce(max(id), 1) from tickets))")
        reloj.fijar(conn, FECHA_RELOJ)
        for fecha, resultados in por_dia:
            db.guardar_resultados(conn, resultados, fecha)
        congelados = sum(1 for u in usuarios if u["modo_recuperacion"])
        db.anotar_bitacora(conn, FECHA_RELOJ, f"Worker listo · {len(usuarios)} scores al día · "
                                              f"{congelados} créditos congelados")
        if not guardada:
            db.guardar_config(conn, dict(C.VALORES), FECHA_RELOJ, "Equipo Riesgo")

    habilitados = sum(1 for p, _ in por_dia[-1][1] if p["habilitado"])
    return {
        "hoy": FECHA_RELOJ.isoformat(),
        "usuarios": len(usuarios),
        "habilitados": habilitados,
        "tickets": len(tickets),
        "eventos": len(eventos),
        "segundos": round(time.perf_counter() - inicio, 1),
    }


if __name__ == "__main__":
    print(generar())
