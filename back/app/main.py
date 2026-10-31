"""API de Ritmo. Contrato en /API.md. Uso, desde back/:  uvicorn app.main:app --reload"""
from contextlib import asynccontextmanager
from datetime import timedelta
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select

from app import config as C
from app import db, metricas, reloj
from app.motor.cobros import (comision_por_desfase, cuota, descuento_por_nivel, deuda, gracia_hasta, nuevo_ticket,
                              oferta_quincena)
from app.motor.decisiones import en_uso, racha, validar_solicitud
from app.motor.perfil import evaluar_usuario
from app.motor.score import dias_atraso, es_anticipado
from app.worker import mora
from datos import generar
from datos.comportamiento import Comportamiento


def _cargar_config():
    try:
        with db.get_engine().begin() as conn:
            guardada = db.leer_config(conn)
        if guardada:
            C.aplicar(C.validar(guardada["valores"]))
    except Exception:   # base vacía: se usan los valores por defecto hasta el primer /reset
        pass


@asynccontextmanager
async def ciclo_de_vida(_app):
    _cargar_config()
    yield


app = FastAPI(title="Ritmo", description="Motor de comportamiento para Credirecto", lifespan=ciclo_de_vida)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def conexion():
    with db.get_engine().begin() as conn:
        yield conn


# --- Ficha del usuario -------------------------------------------------------------------

def _codigo(ticket_id) -> str:
    return f"{(ticket_id * 2654435761) % 0xFFFFFFF:07X}"


def _ticket_json(t, nivel, quincena, hoy) -> dict:
    vivo = t["estado"] != "pagado"
    oferta = oferta_quincena(t, nivel, quincena) if vivo else None
    return {
        "id": t["id"], "codigo": _codigo(t["id"]), "servicio": t["servicio"], "comercio": t.get("comercio"),
        "fecha_uso": t["fecha_uso"].isoformat(), "vence": t["fecha_vencimiento"].isoformat(),
        "estado": t["estado"], "dias_atraso": dias_atraso(t, hoy) if vivo else 0,
        "monto": t["monto"], "gasto_admin": t["gasto_admin"], "comision": t["comision"], "cuota": cuota(t),
        "pagado": t["monto_pagado"], "deuda": max(deuda(t), 0.0),
        "descuento_si_anticipa": (descuento_por_nivel(t, nivel)
                                  if vivo and hoy < t["fecha_vencimiento"] and t["estado"] == "abierto" else 0.0),
        "gracia_hasta": gracia_hasta(t).isoformat(),
        "comision_si_atrasa": comision_por_desfase(t) if vivo and t["comision"] == 0 else 0.0,
        "oferta_quincena": oferta.isoformat() if oferta else None,
    }


TITULOS = {"aviso_mora": "Modo recuperación", "comision": "Credirecto", "gracia": "Credirecto",
           "recordatorio": "Credirecto", "mover_quincena": "Fecha de pago", "falta_poco": "Credirecto"}
NOMBRE_SERVICIO = {"estacionamiento": "Estacionamiento", "parquimetro": "Parquímetro", "peaje": "Peaje",
                   "luz": "Luz", "internet": "Internet", "telefono": "Teléfono", "seguro": "Seguro"}


def _mensaje_subida(nivel) -> str:
    extras = {1: " y puedes pagar parquímetros y peajes", 2: " y puedes pagar luz e internet", 3: " y seguros"}
    return C.MENSAJE_SUBIDA.format(nivel=C.NOMBRES_NIVEL[nivel], tickets=C.NIVELES[nivel]["tickets"],
                                   extra=extras.get(nivel, ""))


def _linea_de_tiempo(eventos, tickets, decisiones, fotos) -> list:
    por_id = {t["id"]: t for t in tickets}
    linea = []
    for e in eventos:
        t = por_id.get(e["ticket_id"])
        servicio = NOMBRE_SERVICIO.get(e["servicio"] or "", "")
        if e["tipo"] == "uso_ticket" and t:
            texto = f"Ticket · {servicio} {t.get('comercio') or ''}".strip() + \
                    f" · cuota {metricas._etiqueta(t['fecha_vencimiento'])}"
            linea.append((e["fecha"], 2, "Ticket", texto, round(t["monto"] + t["gasto_admin"], 2)))
        elif e["tipo"] == "repago_ticket" and t:
            if t["estado"] == "pagado" and t["fecha_pago"] == e["fecha"]:
                dias = (t["fecha_vencimiento"] - e["fecha"]).days
                cuando = (f"{dias} días antes" if dias > 1 else "1 día antes" if dias == 1 else
                          "el día de cobro" if dias == 0 else f"con {-dias} días de atraso")
                texto = f"Cuota pagada {cuando} · ticket renovado" + (" · racha +1" if dias > 0 else "")
            else:
                texto = "Abono a la cuota"
            linea.append((e["fecha"], 1, "Pago", texto, e["monto"]))
        elif e["tipo"] == "comision":
            linea.append((e["fecha"], 1, "Comisión", f"Comisión por desfase · {servicio}", e["monto"]))
        elif e["tipo"] == "debito_wallet":
            linea.append((e["fecha"], 1, "Mora", "Débito de la wallet para la cuota en mora", e["monto"]))
        elif e["tipo"] == "recarga":
            linea.append((e["fecha"], 0, "Recarga", "Recarga de saldo", e["monto"]))
    for fecha, comunicar in decisiones:
        if comunicar:
            canal = "Push" if comunicar["canal"] == "push" else "Wisi" if comunicar["canal"] == "wisi" else "Push y Wisi"
            linea.append((fecha, 3, "Mensaje", f"{canal}: «{comunicar['mensaje']}»", None))
    # fotos = [(fecha, nivel, score)] en orden: cada cambio de nivel entre dos fotos seguidas
    for (_, a, _), (fecha_b, b, score) in zip(fotos, fotos[1:]):
        if a is not None and b is not None and a != b:
            texto = (f"{C.NOMBRES_NIVEL[a]} → {C.NOMBRES_NIVEL[b]} (score {score}) · de "
                     f"{C.NIVELES[a]['tickets']} a {C.NIVELES[b]['tickets']} tickets")
            linea.append((fecha_b, 4, "Nivel", texto, None))
    linea.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [{"fecha": f.isoformat(), "tipo": tipo, "texto": texto, "monto": monto}
            for f, _, tipo, texto, monto in linea[:40]]


def _ficha(conn, user_id) -> dict:
    hoy = reloj.leer(conn)
    usuario = db.cargar_usuarios(conn, user_id).get(user_id)
    if usuario is None:
        raise HTTPException(404, f"No existe el usuario {user_id}.")
    eventos = db.cargar_eventos(conn, user_id).get(user_id, [])
    tickets = db.cargar_tickets(conn, user_id).get(user_id, [])
    niveles, scores = db.contexto_anterior(conn, hoy, user_id)
    perfil, decision = evaluar_usuario(usuario, eventos, tickets, hoy, niveles.get(user_id), scores.get(user_id))
    nivel = perfil["nivel"]

    d, h = db.decisiones, db.historial_niveles
    historial = conn.execute(select(d.c.fecha, d.c.comunicar, d.c.premiar).where(d.c.user_id == user_id)
                             .order_by(d.c.fecha)).all()
    fotos = conn.execute(select(h.c.fecha, h.c.nivel, h.c.trust_score).where(h.c.user_id == user_id)
                         .order_by(h.c.fecha)).all()
    notificaciones = []
    for fecha, comunicar, premiar in historial:
        if comunicar:
            notificaciones.append({"fecha": fecha.isoformat(), "tipo": comunicar["tipo"],
                                   "titulo": TITULOS.get(comunicar["tipo"], "Credirecto"),
                                   "mensaje": comunicar["mensaje"], "canal": comunicar["canal"]})
        for p in premiar:
            if p["tipo"] == "subida_nivel":
                notificaciones.append({"fecha": fecha.isoformat(), "tipo": "subida_nivel", "titulo": "Nuevo nivel",
                                       "mensaje": _mensaje_subida(p["nuevo_nivel"]), "canal": "push"})
    usados = len(en_uso(tickets))
    vivos = sorted((t for t in tickets if t["estado"] != "pagado"), key=lambda t: (t["fecha_vencimiento"], t["id"]))
    primer_uso = min((t["fecha_uso"] for t in tickets), default=None)
    return {
        "user_id": user_id, "nombre": usuario["nombre"], "alias": usuario["alias"],
        "habilitado": perfil["habilitado"],
        "habilitado_desde": perfil["habilitado_desde"].isoformat() if perfil["habilitado_desde"] else None,
        "cohorte": primer_uso.strftime("%Y-%m") if primer_uso else None,
        "nivel": nivel, "nivel_nombre": C.NOMBRES_NIVEL[nivel] if nivel is not None else None,
        "segmento": perfil["segmento"], "quincena": perfil["quincena"], "club": usuario["club"],
        "saldo_wallet": round(usuario["saldo_wallet"], 4), "modo_recuperacion": usuario["modo_recuperacion"],
        "estado_mora": perfil["estado_mora"],
        "trust_score": perfil["trust_score"], "razones": perfil["razones"], "checklist": perfil["checklist"],
        "tickets": {"total": C.NIVELES[nivel]["tickets"] if nivel is not None else 0, "usados": usados,
                    "disponibles": decision["prestar"]["tickets"], "monto_max": decision["prestar"]["monto_max"],
                    "servicios": decision["prestar"]["servicios"]},
        "progreso": perfil["progreso"],
        "racha": racha(eventos, hoy),
        "deuda_total": round(sum(max(deuda(t), 0.0) for t in vivos), 2),
        "tickets_abiertos": [{**_ticket_json(t, nivel, perfil["quincena"], hoy), "numero": i}
                             for i, t in enumerate(sorted(vivos, key=lambda t: (t["fecha_uso"], t["id"])), 1)],
        "decisiones": decision,
        "notificaciones": sorted(notificaciones, key=lambda n: n["fecha"], reverse=True)[:10],
        "linea_de_tiempo": _linea_de_tiempo(eventos, tickets, [(f, c) for f, c, _ in historial], fotos),
    }


# --- Comunes -----------------------------------------------------------------------------

@app.get("/salud")
def salud(conn=Depends(conexion)):
    return {"ok": True, "hoy": reloj.leer(conn).isoformat(), "tasa_bs": C.TASA_BS}


@app.get("/reloj")
def ver_reloj(conn=Depends(conexion)):
    b = db.bitacora
    filas = conn.execute(select(b.c.fecha, b.c.mensaje).order_by(b.c.id.desc()).limit(30)).all()
    return {"hoy": reloj.leer(conn).isoformat(),
            "bitacora": [{"fecha": f.isoformat(), "mensaje": m} for f, m in filas]}


@app.post("/simular-dia")
def simular_dia(dias: int = Query(1, ge=1, le=60), conn=Depends(conexion)):
    # Los usuarios sintéticos usan y pagan según su perfil; los de historia (María, Carmen, Pedro) no
    return mora.simular(conn, dias, comportamiento=Comportamiento)


@app.post("/reset")
def reset():
    return generar.generar()


# --- Dashboard ---------------------------------------------------------------------------

@app.get("/resumen")
def resumen(conn=Depends(conexion)):
    return metricas.resumen(conn, reloj.leer(conn))


@app.get("/cohortes")
def cohortes(conn=Depends(conexion)):
    return metricas.cohortes(conn, reloj.leer(conn))


@app.get("/segmentos")
def segmentos(conn=Depends(conexion)):
    return metricas.segmentos(conn, reloj.leer(conn))


@app.get("/decisiones")
def decisiones(conn=Depends(conexion)):
    return metricas.decisiones(conn, reloj.leer(conn))


@app.get("/usuarios")
def listar_usuarios(q: Optional[str] = None, nivel: Optional[str] = Query(None, pattern="^([0-3]|espera)?$"),
                    segmento: Optional[str] = None, limit: int = Query(50, ge=1, le=500),
                    offset: int = Query(0, ge=0), conn=Depends(conexion)):
    return metricas.listar_usuarios(conn, q, nivel, segmento, limit, offset)


@app.get("/usuarios/{user_id}")
def ver_usuario(user_id: str, conn=Depends(conexion)):
    return _ficha(conn, user_id)


class ConfigIn(BaseModel):
    valores: dict


def _config_json(conn) -> dict:
    guardada = db.leer_config(conn)
    grupos = {}
    for clave, grupo, etiqueta, unidad, defecto, paso in C.EDITABLES:
        booleano = isinstance(defecto, bool)
        grupos.setdefault(grupo, []).append({
            "clave": clave, "etiqueta": etiqueta, "valor": C.VALORES[clave], "unidad": unidad,
            "tipo": "booleano" if booleano else "numero", "paso": None if booleano else paso})
    return {"tasa_bs": C.TASA_BS,
            "guardado": {"fecha": guardada["fecha"].isoformat(), "por": guardada["por"]} if guardada else None,
            "grupos": [{"titulo": t, "campos": c} for t, c in grupos.items()]}


def _validar_config(valores):
    try:
        return C.validar(valores)
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.get("/config")
def ver_config(conn=Depends(conexion)):
    return _config_json(conn)


@app.put("/config")
def guardar_config(body: ConfigIn, conn=Depends(conexion)):
    cambios = _validar_config(body.valores)
    hoy = reloj.leer(conn)
    C.aplicar({**C.VALORES, **cambios})
    db.guardar_config(conn, dict(C.VALORES), hoy, "Equipo Riesgo")
    mora.recalcular_todos(conn, hoy)
    return _config_json(conn)


@app.post("/config/simular")
def simular_config(body: ConfigIn, conn=Depends(conexion)):
    return metricas.simular_config(conn, reloj.leer(conn), _validar_config(body.valores))


# --- App móvil ---------------------------------------------------------------------------

class TicketIn(BaseModel):
    user_id: str
    servicio: str
    monto: float = Field(gt=0)
    comercio: Optional[str] = None


class PagoIn(BaseModel):
    user_id: str
    ticket_id: int
    monto: float = Field(0, ge=0)
    origen: Literal["usuario", "fallo_tecnico"] = "usuario"


class RecargaIn(BaseModel):
    user_id: str
    monto: float = Field(gt=0)


def _contexto(conn, user_id):
    """(hoy, usuario, eventos, tickets, perfil, decision) con el motor recalculado en vivo."""
    hoy = reloj.leer(conn)
    usuario = db.cargar_usuarios(conn, user_id).get(user_id)
    if usuario is None:
        raise HTTPException(404, f"No existe el usuario {user_id}.")
    eventos = db.cargar_eventos(conn, user_id).get(user_id, [])
    tickets = db.cargar_tickets(conn, user_id).get(user_id, [])
    niveles, scores = db.contexto_anterior(conn, hoy, user_id)
    perfil, decision = evaluar_usuario(usuario, eventos, tickets, hoy, niveles.get(user_id), scores.get(user_id))
    return hoy, usuario, eventos, tickets, perfil, decision


def _cargar_ticket(conn, ticket_id, user_id=None) -> dict:
    t = conn.execute(select(db.tickets).where(db.tickets.c.id == ticket_id)).mappings().first()
    if t is None or (user_id is not None and t["user_id"] != user_id):
        raise HTTPException(404, f"No existe el ticket {ticket_id}" + (f" del usuario {user_id}." if user_id else "."))
    return db.a_dict(t)


def _texto_rechazo(motivo, perfil, prestar, servicio, monto) -> str:
    nivel = perfil["nivel"]
    if motivo == "no_habilitado":
        return "Aún no tienes Credirecto: completa los requisitos para activarlo."
    if motivo == "modo_recuperacion":
        return "Tu crédito está en pausa hasta que pagues la cuota en mora. Cada recarga paga primero tu deuda."
    if motivo == "deuda_vencida":
        return "Tienes una cuota vencida. Págala y tus tickets vuelven a estar disponibles."
    if motivo == "servicio_no_cubierto":
        cubre = ", ".join(NOMBRE_SERVICIO[s].lower() for s in prestar["servicios"])
        return f"Credirecto {C.NOMBRES_NIVEL[nivel]} no cubre {NOMBRE_SERVICIO[servicio].lower()}. Puedes usarlo en: {cubre}."
    if motivo == "maximo_en_uso":
        return (f"Ya estás usando tus {C.NIVELES[nivel]['tickets']} tickets. Paga una cuota y tu ticket vuelve "
                f"a estar disponible.")
    resto = round(monto - prestar["monto_max"], 2)
    return f"Tu ticket cubre hasta ${prestar['monto_max']:.2f}; no tienes saldo para los ${resto:.2f} restantes."


@app.post("/tickets", status_code=201)
def crear_ticket(body: TicketIn, conn=Depends(conexion)):
    if body.servicio not in C.SERVICIOS:
        raise HTTPException(422, f"Servicio desconocido: {body.servicio}.")
    hoy, usuario, _, _, perfil, decision = _contexto(conn, body.user_id)
    prestar = decision["prestar"]
    v = validar_solicitud(prestar, body.servicio, body.monto, usuario["saldo_wallet"])
    ticket_id = db.siguiente_id(conn, db.tickets) if v["resultado"] != "rechazada" else None
    if v["motivo"] not in C.MOTIVOS_SIN_SOLICITUD:
        db.insertar_solicitudes(conn, [{"user_id": body.user_id, "fecha": hoy, "servicio": body.servicio,
                                        "monto": body.monto, "resultado": v["resultado"], "motivo": v["motivo"],
                                        "ticket_id": ticket_id}])
    if v["resultado"] == "rechazada":
        raise HTTPException(409, _texto_rechazo(v["motivo"], perfil, prestar, body.servicio, body.monto))

    t = nuevo_ticket(ticket_id, body.user_id, body.servicio, body.comercio, v["credito"], hoy)
    db.insertar_tickets(conn, [t])
    nuevos = [{"user_id": body.user_id, "fecha": hoy, "tipo": "uso_ticket", "servicio": body.servicio,
               "monto": t["monto"], "ticket_id": t["id"], "a_tiempo": None}]
    if v["saldo"] > 0:
        # El excedente lo paga el usuario con su saldo; no es un pago con fecha límite
        usuario["saldo_wallet"] = round(usuario["saldo_wallet"] - v["saldo"], 4)
        db.actualizar_usuarios(conn, [usuario])
        nuevos.append({"user_id": body.user_id, "fecha": hoy, "tipo": "pago_servicio", "servicio": body.servicio,
                       "monto": v["saldo"], "ticket_id": t["id"], "a_tiempo": None})
    db.insertar_eventos(conn, nuevos)
    perfil, _ = mora.recalcular_usuario(conn, body.user_id, hoy)
    return {"ticket": _ticket_json(t, perfil["nivel"], perfil["quincena"], hoy),
            "cubierto_por_credito": v["credito"], "pagado_con_saldo": v["saldo"],
            "usuario": _ficha(conn, body.user_id)}


@app.post("/tickets/{ticket_id}/quincena")
def mover_a_quincena(ticket_id: int, conn=Depends(conexion)):
    t = _cargar_ticket(conn, ticket_id)
    hoy, _, _, _, perfil, _ = _contexto(conn, t["user_id"])
    oferta = oferta_quincena(t, perfil["nivel"], perfil["quincena"])
    if oferta is None:
        raise HTTPException(409, "Esta cuota no se puede mover a tu quincena.")
    t["fecha_vencimiento"] = oferta
    db.actualizar_tickets(conn, [t])
    perfil, _ = mora.recalcular_usuario(conn, t["user_id"], hoy)
    return {"ticket": _ticket_json(t, perfil["nivel"], perfil["quincena"], hoy), "usuario": _ficha(conn, t["user_id"])}


@app.post("/pagos")
def registrar_pago(body: PagoIn, conn=Depends(conexion)):
    t = _cargar_ticket(conn, body.ticket_id, body.user_id)
    if t["estado"] == "pagado":
        raise HTTPException(409, "Esa cuota ya está pagada.")
    hoy, _, eventos, _, perfil, _ = _contexto(conn, body.user_id)

    if body.origen == "fallo_tecnico":
        t = mora.pausar_por_fallo_tecnico(t)
        db.actualizar_tickets(conn, [t])
        perfil, _ = mora.recalcular_usuario(conn, body.user_id, hoy)
        return {"aplicado": 0.0, "deuda_restante": deuda(t), "comprobante": None,
                "ticket": _ticket_json(t, perfil["nivel"], perfil["quincena"], hoy),
                "usuario": _ficha(conn, body.user_id)}

    if body.monto <= 0:
        raise HTTPException(422, "El monto del pago debe ser mayor que 0.")
    racha_antes = racha(eventos, hoy)["pagos"]
    t, evento, aplicado = mora.aplicar_pago(t, body.monto, hoy, perfil["nivel"])
    db.actualizar_tickets(conn, [t])
    db.insertar_eventos(conn, [evento])
    perfil, _ = mora.recalcular_usuario(conn, body.user_id, hoy)
    completo = t["estado"] == "pagado"
    comprobante = {
        "referencia": f"CD-{(t['id'] * 7919 + hoy.toordinal()) % 10**9:09d}", "fecha": hoy.isoformat(),
        "completo": completo,
        "dias_antes": max(0, (t["fecha_vencimiento"] - hoy).days),
        "anticipado": completo and es_anticipado(t),
        "cuota": t["monto"], "gasto_admin": t["gasto_admin"], "descuento": t["descuento"],
        "descuento_pct": int(round(C.DESCUENTO_NIVEL.get(perfil["nivel"], 0) * 100)) if t["descuento"] else 0,
        "comision": t["comision"], "total": aplicado, "ahorro": t["descuento"],
        "racha_antes": racha_antes, "racha_despues": racha(eventos + [evento], hoy)["pagos"],
        "ticket_disponible": completo,
    }
    return {"aplicado": aplicado, "deuda_restante": max(deuda(t), 0.0), "comprobante": comprobante,
            "ticket": _ticket_json(t, perfil["nivel"], perfil["quincena"], hoy),
            "usuario": _ficha(conn, body.user_id)}


@app.post("/recargas")
def recargar(body: RecargaIn, conn=Depends(conexion)):
    hoy, usuario, _, tickets, perfil, _ = _contexto(conn, body.user_id)
    r = mora.aplicar_recarga(usuario, tickets, body.monto, hoy, perfil["nivel"])
    originales = {t["id"]: t for t in tickets}
    db.actualizar_tickets(conn, [t for t in r["tickets"] if t != originales[t["id"]]])
    db.insertar_eventos(conn, r["eventos"])
    db.actualizar_usuarios(conn, [r["usuario"]])
    mora.recalcular_usuario(conn, body.user_id, hoy)
    return {"aplicado_a_deuda": r["aplicado_a_deuda"], "a_wallet": r["a_wallet"],
            "deuda_restante": round(sum(max(deuda(t), 0.0) for t in r["tickets"] if t["estado"] != "pagado"), 2),
            "saldo_wallet": round(r["usuario"]["saldo_wallet"], 4), "usuario": _ficha(conn, body.user_id)}


@app.post("/tickets/{ticket_id}/disputa")
def abrir_disputa(ticket_id: int, conn=Depends(conexion)):
    t = _cargar_ticket(conn, ticket_id)
    if t["estado"] == "pagado":
        raise HTTPException(409, "No se puede disputar una cuota ya pagada.")
    t["estado"] = "disputa"
    db.actualizar_tickets(conn, [t])
    hoy = reloj.leer(conn)
    perfil, _ = mora.recalcular_usuario(conn, t["user_id"], hoy)
    return {"ticket": _ticket_json(t, perfil["nivel"], perfil["quincena"], hoy), "usuario": _ficha(conn, t["user_id"])}
