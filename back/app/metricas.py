"""Consultas de las vistas del dashboard (solo lectura).

Las métricas del mundo Credirecto se calculan desde las tablas reales con las mismas definiciones que
`datos/generar.py` usa para guardar el contrafactual "regla actual" en metricas_regla_actual:
- repago a tiempo de una semana = cuotas que vencían esa semana pagadas a más tardar el día de vencimiento
- mora de una semana = cuotas que vencían MORA_DIA días antes y llegaron a mora
- reuso = usos tras los cuales el mismo usuario volvió a usar en 30 días
"""
from collections import Counter, defaultdict
from datetime import timedelta

import pandas as pd
from sqlalchemy import func, select

from app import config as C
from app import db
from app.motor.habilitacion import FALTANTES
from app.motor.perfil import evaluar_usuario
from app.motor.score import dias_atraso

SEMANAS = 12
MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
MESES_MIN = [m.lower() for m in MESES]


def _pct(parte, total, decimales=1):
    return round(100 * parte / total, decimales) if total else None


def _etiqueta(d):
    return f"{d.day} {MESES_MIN[d.month - 1]}"


# --- Tickets del mundo Credirecto ------------------------------------------------------------

def _tickets_df(conn) -> pd.DataFrame:
    t = db.tickets
    filas = conn.execute(select(t.c.id, t.c.user_id, t.c.monto, t.c.gasto_admin, t.c.comision, t.c.descuento,
                                t.c.monto_pagado, t.c.fecha_uso, t.c.fecha_vencimiento, t.c.fecha_pago,
                                t.c.estado)).mappings().all()
    df = pd.DataFrame(filas, columns=["id", "user_id", "monto", "gasto_admin", "comision", "descuento",
                                      "monto_pagado", "fecha_uso", "fecha_vencimiento", "fecha_pago", "estado"])
    for c in ("monto", "gasto_admin", "comision", "descuento", "monto_pagado"):
        df[c] = df[c].astype(float)
    for c in ("fecha_uso", "fecha_vencimiento", "fecha_pago"):
        df[c] = pd.to_datetime(df[c])
    return df


def _ritmo_diario(df: pd.DataFrame, hoy) -> pd.DataFrame:
    """Mismas columnas que metricas_regla_actual, por día."""
    hoy_ts = pd.Timestamp(hoy)
    validos = df[~df.estado.isin(["disputa", "pausa_tecnica"])]
    usos = df.sort_values("fecha_uso")
    siguiente = usos.groupby("user_id")["fecha_uso"].shift(-1)
    usos = usos.assign(reusado=(siguiente - usos.fecha_uso).dt.days.between(1, 30))
    pagados = df[df.estado == "pagado"]
    atraso_pago = (validos.fecha_pago - validos.fecha_vencimiento).dt.days
    atraso_hoy = (hoy_ts - validos.fecha_vencimiento).dt.days
    llego_a_mora = (atraso_pago >= C.MORA_DIA) | (validos.fecha_pago.isna() & (atraso_hoy >= C.MORA_DIA))

    diario = pd.DataFrame({
        "prestado": usos.groupby("fecha_uso")["monto"].sum(),
        "usos": usos.groupby("fecha_uso").size(),
        "usos_reusados": usos.groupby("fecha_uso")["reusado"].sum(),
        "vencidos": validos.groupby("fecha_vencimiento").size(),
        "a_tiempo": validos[validos.fecha_pago <= validos.fecha_vencimiento].groupby("fecha_vencimiento").size(),
        "llegaron_a_mora": validos[llego_a_mora].groupby("fecha_vencimiento").size(),
        "comisiones": (pagados.gasto_admin - pagados.descuento + pagados.comision).groupby(pagados.fecha_pago).sum(),
    }).fillna(0)
    diario.index = pd.to_datetime(diario.index)
    return diario


def _regla_diaria(conn) -> pd.DataFrame:
    m = db.metricas_regla_actual
    df = pd.DataFrame(conn.execute(select(m)).mappings().all())
    if df.empty:
        return df
    df["fecha"] = pd.to_datetime(df["fecha"])
    for c in ("prestado", "comisiones", "deuda_mora"):
        df[c] = df[c].astype(float)
    return df.set_index("fecha")


def _rango(df, desde, hasta, col):
    if df.empty or col not in df:
        return 0.0
    return float(df.loc[(df.index >= pd.Timestamp(desde)) & (df.index <= pd.Timestamp(hasta)), col].sum())


def _repago(df, desde, hasta):
    return _pct(_rango(df, desde, hasta, "a_tiempo"), _rango(df, desde, hasta, "vencidos"))


def _mora(df, desde, hasta):
    corrido = timedelta(days=C.MORA_DIA)
    return _pct(_rango(df, desde - corrido, hasta - corrido, "llegaron_a_mora"),
                _rango(df, desde - corrido, hasta - corrido, "vencidos"))


def _reuso(df, desde, hasta):
    fin = hasta - timedelta(days=30)
    return _pct(_rango(df, desde, fin, "usos_reusados"), _rango(df, desde, fin, "usos"), 0)


def resumen(conn, hoy) -> dict:
    df = _tickets_df(conn)
    ritmo = _ritmo_diario(df, hoy)
    regla = _regla_diaria(conn)
    desde = hoy - timedelta(days=7 * SEMANAS - 1)
    semana = hoy - timedelta(days=6)
    previa_desde, previa_hasta = semana - timedelta(days=7), semana - timedelta(days=1)

    usuarios = conn.execute(select(func.count()).select_from(db.usuarios)).scalar()
    habilitados = conn.execute(select(func.count()).where(db.perfiles.c.habilitado)).scalar()
    en_mora = df[df.estado == "mora"]
    perdida = float((en_mora.monto + en_mora.gasto_admin + en_mora.comision - en_mora.descuento
                     - en_mora.monto_pagado).sum())

    def r(x, n=1):
        return None if x is None else round(x, n)

    repago, mora = _repago(ritmo, semana, hoy), _mora(ritmo, semana, hoy)
    repago_prev, mora_prev = _repago(ritmo, previa_desde, previa_hasta), _mora(ritmo, previa_desde, previa_hasta)
    kpis = {
        "usuarios_totales": usuarios, "habilitados": habilitados, "en_espera": usuarios - habilitados,
        "pct_habilitados": _pct(habilitados, usuarios),
        "monto_prestado": round(_rango(ritmo, desde, hoy, "prestado"), 2),
        "repago_a_tiempo": repago,
        "repago_delta_pp": r(repago - repago_prev) if None not in (repago, repago_prev) else None,
        "mora": mora,
        "mora_delta_pp": r(mora - mora_prev) if None not in (mora, mora_prev) else None,
        "comisiones": round(_rango(ritmo, desde, hoy, "comisiones"), 2),
        "reuso": _reuso(ritmo, desde, hoy),
        "perdida_esperada": round(perdida, 2),
    }
    regla_hoy = regla.loc[pd.Timestamp(hoy)] if not regla.empty and pd.Timestamp(hoy) in regla.index else None
    perdida_regla = round(float(regla_hoy["deuda_mora"]), 2) if regla_hoy is not None else None
    ingresos_regla = round(_rango(regla, desde, hoy, "comisiones"), 2)
    # Lo que gana el negocio: lo cobrado (gasto adm. neto de descuentos + comisiones) menos lo que se espera perder
    neto_regla = round(ingresos_regla - perdida_regla, 2) if perdida_regla is not None else None
    comparativo = [
        ("Repago a tiempo", "pct", _repago(regla, semana, hoy), kpis["repago_a_tiempo"], True),
        ("Mora", "pct", _mora(regla, semana, hoy), kpis["mora"], False),
        ("Monto prestado", "usd", round(_rango(regla, desde, hoy, "prestado"), 2), kpis["monto_prestado"], True),
        ("Reuso", "pct", _reuso(regla, desde, hoy), kpis["reuso"], True),
        ("Pérdida esperada", "usd", perdida_regla, kpis["perdida_esperada"], False),
        ("Ingresos (gasto adm. + comisiones)", "usd", ingresos_regla, kpis["comisiones"], True),
        ("Resultado neto (ingresos − pérdida)", "usd", neto_regla,
         round(kpis["comisiones"] - kpis["perdida_esperada"], 2), True),
        ("Usuarios habilitados", "n", int(regla_hoy["habilitados"]) if regla_hoy is not None else usuarios,
         habilitados, True),
    ]
    semanal = []
    for i in range(SEMANAS):
        inicio = desde + timedelta(days=7 * i)
        fin = inicio + timedelta(days=6)
        semanal.append({"desde": inicio.isoformat(), "etiqueta": _etiqueta(inicio),
                        "repago_a_tiempo": _repago(ritmo, inicio, fin), "mora": _mora(ritmo, inicio, fin)})
    return {
        "hoy": hoy.isoformat(), "desde": desde.isoformat(), "ritmo_desde": C.RITMO_DESDE.isoformat(),
        "hay_datos": bool(_rango(ritmo, semana, hoy, "vencidos")),
        "kpis": kpis,
        "comparativo": [{"metrica": m, "unidad": u, "regla_actual": a, "ritmo": b, "mejor_si_sube": s}
                        for m, u, a, b, s in comparativo],
        "semanal": semanal,
    }


PRIMER_MES = 4  # semanas que cuentan como "primer mes" en la comparación por cohorte


def cohortes(conn, hoy) -> dict:
    """Usuarios agrupados por el mes de su primer ticket.

    Cada semana k (contada desde el primer ticket de cada usuario) trae el % y su base:
    - repago_a_tiempo: cuotas usadas en la semana k, ya vencidas, pagadas a tiempo (base n_repago = cuotas)
    - reuso: usuarios que volvieron a usar un ticket en la semana k (base n_reuso = usuarios)
    `primer_mes` junta las semanas 1–4; `grupos` compara las cohortes de antes y desde que decide Credirecto.
    """
    df = _tickets_df(conn)
    habilitados = conn.execute(select(func.count()).where(db.perfiles.c.habilitado)).scalar()
    salida = {"hoy": hoy.isoformat(), "semanas": SEMANAS, "primer_mes_semanas": PRIMER_MES,
              "habilitados": habilitados, "ritmo_desde": C.RITMO_DESDE.isoformat(), "cohortes": [],
              "grupos": None, "mejor_semana4": None, "peor_semana4": None}
    if df.empty:
        return salida
    hoy_ts = pd.Timestamp(hoy)
    primeros = df.groupby("user_id")["fecha_uso"].min().rename("primer_uso").to_frame()
    primeros["cohorte"] = primeros.primer_uso.dt.strftime("%Y-%m")
    df = df.join(primeros, on="user_id")
    df["semana_uso"] = (df.fecha_uso - df.primer_uso).dt.days // 7 + 1
    df["vencida"] = (df.fecha_vencimiento <= hoy_ts) & ~df.estado.isin(["disputa", "pausa_tecnica"])
    df["a_tiempo"] = df.vencida & (df.fecha_pago <= df.fecha_vencimiento)
    df["reusa"] = df.fecha_uso > df.primer_uso
    mes_ritmo = C.RITMO_DESDE.strftime("%Y-%m")

    def primer_mes(tickets, usuarios):
        """Semanas 1–4 juntas. Reuso solo entre quienes ya cumplieron su primer mes completo."""
        mes = tickets[tickets.semana_uso <= PRIMER_MES]
        vencen = mes[mes.vencida]
        completos = usuarios[usuarios.primer_uso + pd.Timedelta(days=7 * PRIMER_MES) <= hoy_ts].index
        reusan = mes[mes.reusa & mes.user_id.isin(completos)].user_id.nunique()
        return {"repago_a_tiempo": _pct(int(vencen.a_tiempo.sum()), len(vencen)), "n_repago": len(vencen),
                "reuso": _pct(reusan, len(completos)), "n_reuso": len(completos)}

    semana4 = {"repago_a_tiempo": [], "reuso": []}
    for cohorte, usuarios in primeros.groupby("cohorte"):
        tickets = df[df.cohorte == cohorte]
        anio, mes = map(int, cohorte.split("-"))
        etiqueta = f"{MESES[mes - 1]} {anio}"
        semanas = []
        for k in range(1, SEMANAS + 1):
            inicio_k = usuarios.primer_uso + pd.Timedelta(days=7 * (k - 1))
            observados = int((inicio_k <= hoy_ts).sum())
            if not observados:
                semanas.append({"semana": k, "repago_a_tiempo": None, "n_repago": 0, "reuso": None, "n_reuso": 0})
                continue
            de_k = tickets[tickets.semana_uso == k]
            vencen = de_k[de_k.vencida]
            reusan = de_k[de_k.reusa].user_id.nunique()
            fila = {"semana": k, "repago_a_tiempo": _pct(int(vencen.a_tiempo.sum()), len(vencen)),
                    "n_repago": len(vencen), "reuso": _pct(reusan, observados), "n_reuso": observados}
            semanas.append(fila)
            if k == 4:
                for clave in semana4:
                    if fila[clave] is not None:
                        semana4[clave].append({"etiqueta": etiqueta, "valor": fila[clave]})
        salida["cohortes"].append({"cohorte": cohorte, "etiqueta": etiqueta, "usuarios": len(usuarios),
                                   "con_credirecto": cohorte >= mes_ritmo,
                                   "primer_mes": primer_mes(tickets, usuarios), "semanas": semanas})
    con = primeros.cohorte >= mes_ritmo
    salida["grupos"] = {
        "antes": {"usuarios": int((~con).sum()), **primer_mes(df[df.cohorte < mes_ritmo], primeros[~con])},
        "con": {"usuarios": int(con.sum()), **primer_mes(df[df.cohorte >= mes_ritmo], primeros[con])},
    }
    salida["mejor_semana4"] = {c: max(v, key=lambda x: x["valor"]) if v else None for c, v in semana4.items()}
    salida["peor_semana4"] = {c: min(v, key=lambda x: x["valor"]) if v else None for c, v in semana4.items()}
    return salida


def segmentos(conn, hoy) -> dict:
    p, h = db.perfiles, db.historial_niveles
    por_nivel = dict(conn.execute(select(p.c.nivel, func.count()).where(p.c.habilitado).group_by(p.c.nivel)).all())
    por_segmento = dict(conn.execute(select(p.c.segmento, func.count()).group_by(p.c.segmento)).all())
    antes = db.foto_de_historial(conn, h.c.fecha <= hoy - timedelta(days=7), func.max)
    ahora = conn.execute(select(p.c.user_id, p.c.nivel)).all()
    movimientos = Counter()
    for uid, nivel in ahora:
        previo = antes.get(uid, {}).get("nivel")
        if previo is not None and nivel is not None and previo != nivel:
            movimientos[(previo, nivel)] += 1
    umbrales = [0] + [C.UMBRALES_NIVEL[n] for n in (1, 2, 3)]
    rangos = [f"score < {umbrales[1]}", f"{umbrales[1]} – {umbrales[2] - 1}", f"{umbrales[2]} – {umbrales[3] - 1}",
              f"≥ {umbrales[3]}"]
    orden = sorted(movimientos.items(), key=lambda kv: (kv[0][1] < kv[0][0], min(kv[0]), kv[0][0]))
    return {
        "hoy": hoy.isoformat(),
        "habilitados": sum(por_nivel.values()),
        "total": sum(por_segmento.values()),
        "margen_bajada": C.MARGEN_BAJADA,
        "niveles": [{"nivel": n, "nombre": f"Credirecto {C.NOMBRES_NIVEL[n]}", "rango": rangos[n], "umbral": umbrales[n],
                     "usuarios": por_nivel.get(n, 0), "tickets": C.NIVELES[n]["tickets"],
                     "servicios_cupo": C.NIVELES[n]["servicios_cupo"],
                     "ruta_club": "{nivel} · {ruta}".format(**C.RUTAS_CLUB[C.RUTA_MINIMA_POR_NIVEL[n]]),
                     "monto_max": C.NIVELES[n]["monto_max"], "servicios": C.NIVELES[n]["servicios"],
                     "servicios_texto": C.SERVICIOS_TEXTO[n]} for n in range(4)],
        "segmentos": [{"segmento": s, "descripcion": C.DESCRIPCION_SEGMENTO[s], "usuarios": por_segmento.get(s, 0)}
                      for s in C.SEGMENTOS],
        "semana": {
            "desde": (hoy - timedelta(days=6)).isoformat(), "hasta": hoy.isoformat(),
            "subieron": sum(n for (a, b), n in movimientos.items() if b > a),
            "bajaron": sum(n for (a, b), n in movimientos.items() if b < a),
            "movimientos": [{"de": C.NOMBRES_NIVEL[a], "a": C.NOMBRES_NIVEL[b], "usuarios": n, "sube": b > a}
                            for (a, b), n in orden],
        },
    }


def decisiones(conn, hoy) -> dict:
    desde = hoy - timedelta(days=6)
    s, d, u, e = db.solicitudes, db.decisiones, db.usuarios, db.eventos
    sol = conn.execute(select(s.c.resultado, s.c.motivo).where(s.c.fecha >= desde, s.c.fecha <= hoy)).all()
    resultados = Counter(r for r, _ in sol)
    motivos = Counter(m for r, m in sol if r == "rechazada")

    recientes = conn.execute(
        select(u.c.id, u.c.nombre, u.c.habilitado_desde, db.perfiles.c.nivel)
        .join(db.perfiles, db.perfiles.c.user_id == u.c.id)
        .where(u.c.habilitado_desde >= desde).order_by(u.c.habilitado_desde.desc(), u.c.id)).all()

    pagos = dict(conn.execute(select(e.c.user_id, func.count()).where(
        e.c.tipo == "pago_servicio", e.c.a_tiempo.is_(True)).group_by(e.c.user_id)).all())
    espera = conn.execute(select(u).join(db.perfiles, db.perfiles.c.user_id == u.c.id)
                          .where(db.perfiles.c.habilitado.is_(False))).mappings().all()
    faltan = Counter()
    req = C.REQUISITOS
    for x in espera:
        if req["vehiculo"] and not x["vehiculo_verificado"]:
            faltan["vehiculo"] += 1
        if req["pagos"] and pagos.get(x["id"], 0) < req["pagos"]:
            faltan["pagos"] += 1
        if req["cedula"] and not x["cedula_verificada"]:
            faltan["cedula"] += 1
        if req["dias"] and (hoy - x["fecha_registro"]).days < req["dias"]:
            faltan["dias"] += 1

    mensajes = conn.execute(select(d.c.user_id, d.c.fecha, d.c.comunicar, d.c.premiar)
                            .where(d.c.fecha >= desde, d.c.fecha <= hoy)).all()
    repagos = defaultdict(set)
    for uid, fecha in conn.execute(select(e.c.user_id, e.c.fecha).where(
            e.c.tipo == "repago_ticket", e.c.fecha >= desde, e.c.fecha <= hoy + timedelta(days=2))):
        repagos[uid].add(fecha)
    por_tipo = defaultdict(lambda: {"push": 0, "wisi": 0, "enviados": 0, "pagan": 0})
    premios = Counter()
    descuentos = 0.0
    for uid, fecha, comunicar, premiar in mensajes:
        for p in premiar:
            premios[p["tipo"]] += 1
            if p["tipo"] == "puntos":
                premios["puntos_total"] += p["puntos"]
            if p["tipo"] == "descuento_nivel":
                descuentos += p["monto"]
        if not comunicar:
            continue
        fila = por_tipo[comunicar["tipo"]]
        fila["enviados"] += 1
        for canal in ("push", "wisi"):
            fila[canal] += canal in comunicar["canal"]
        fila["pagan"] += any(fecha <= f <= fecha + timedelta(days=2) for f in repagos[uid])
    enviados = sum(f["enviados"] for f in por_tipo.values())

    return {
        "desde": desde.isoformat(), "hasta": hoy.isoformat(),
        "solicitudes": {"total": len(sol), "aprobadas": resultados["aprobada"], "parciales": resultados["parcial"],
                        "rechazadas": resultados["rechazada"],
                        "motivos": [{"motivo": C.MOTIVOS_RECHAZO.get(m, m), "usuarios": n}
                                    for m, n in motivos.most_common()]},
        "habilitaciones": {"semana": len(recientes),
                           "recientes": [{"user_id": i, "nombre": n, "fecha": f.isoformat(), "nivel": nv}
                                         for i, n, f, nv in recientes[:8]]},
        "en_espera": {"total": len(espera),
                      "faltantes": [{"requisito": FALTANTES[k], "usuarios": n} for k, n in faltan.most_common()]},
        "mensajes": {
            "enviados": enviados,
            "pct_pagan_48h": _pct(sum(f["pagan"] for f in por_tipo.values()), enviados, 0),
            "por_tipo": [{"tipo": t, "nombre": m["nombre"], "descripcion": m["descripcion"],
                          "push": por_tipo[t]["push"], "wisi": por_tipo[t]["wisi"],
                          "total": por_tipo[t]["push"] + por_tipo[t]["wisi"],
                          "pct_pagan_48h": _pct(por_tipo[t]["pagan"], por_tipo[t]["enviados"], 0)}
                         for t, m in sorted(C.MENSAJES.items(), key=lambda kv: kv[1]["prioridad"])],
        },
        "premios": {"rachas": premios["racha"], "multiplicadores": premios["multiplicador"],
                    "puntos": premios["puntos_total"], "descuentos": premios["descuento_nivel"],
                    "descuentos_monto": round(descuentos, 2)},
    }


def listar_usuarios(conn, q=None, nivel=None, segmento=None, limit=50, offset=0) -> dict:
    u, p, t = db.usuarios, db.perfiles, db.tickets
    deuda = t.c.monto + t.c.gasto_admin + t.c.comision - t.c.descuento - t.c.monto_pagado
    hoy = conn.execute(select(db.reloj.c.fecha_actual)).scalar()
    # "usados" cuenta solo tickets (movilidad); los pagos de servicios tienen su propio cupo
    vivos = (select(t.c.user_id, func.count().filter(t.c.servicio.notin_(C.SERVICIOS_FACTURA)).label("usados"),
                    func.count().filter(t.c.servicio.in_(C.SERVICIOS_FACTURA)).label("servicios_usados"),
                    func.sum(deuda).label("deuda"),
                    func.max(hoy - t.c.fecha_vencimiento).label("atraso"))
             .where(t.c.estado != "pagado").group_by(t.c.user_id).subquery())
    consulta = (select(u.c.id, u.c.nombre, u.c.modo_recuperacion, p.c.trust_score, p.c.nivel, p.c.segmento,
                       p.c.habilitado, vivos.c.usados, vivos.c.servicios_usados, vivos.c.deuda, vivos.c.atraso)
                .join(p, p.c.user_id == u.c.id).outerjoin(vivos, vivos.c.user_id == u.c.id))
    if q:
        consulta = consulta.where((u.c.id.ilike(f"%{q}%")) | (u.c.nombre.ilike(f"%{q}%")))
    if nivel == "espera":
        consulta = consulta.where(p.c.habilitado.is_(False))
    elif nivel is not None and nivel != "":
        consulta = consulta.where(p.c.nivel == int(nivel))
    if segmento:
        consulta = consulta.where(p.c.segmento == segmento)
    total = conn.execute(select(func.count()).select_from(consulta.subquery())).scalar()
    filas = conn.execute(consulta.order_by(u.c.id).limit(limit).offset(offset)).mappings().all()
    return {"total": total, "usuarios": [{
        "user_id": f["id"], "nombre": f["nombre"], "trust_score": f["trust_score"], "nivel": f["nivel"],
        "nivel_nombre": C.NOMBRES_NIVEL[f["nivel"]] if f["nivel"] is not None else None,
        "segmento": f["segmento"], "habilitado": f["habilitado"],
        "tickets_usados": int(f["usados"] or 0) if f["habilitado"] else None,
        "tickets_total": C.NIVELES[f["nivel"]]["tickets"] if f["nivel"] is not None else None,
        "servicios_usados": int(f["servicios_usados"] or 0) if f["habilitado"] else None,
        "servicios_total": C.NIVELES[f["nivel"]]["servicios_cupo"] if f["nivel"] is not None else None,
        "monto_max": C.NIVELES[f["nivel"]]["monto_max"] if f["nivel"] is not None else None,
        "deuda": round(float(f["deuda"] or 0), 2), "dias_atraso": max(0, int(f["atraso"] or 0)),
        "modo_recuperacion": f["modo_recuperacion"],
    } for f in filas]}


# --- Simulación de configuración -------------------------------------------------------

def simular_config(conn, hoy, cambios) -> dict:
    """Antes y después de unos parámetros, sobre los mismos usuarios y sin guardar nada.

    Habilitación y niveles se recalculan con el motor. Repago y mora esperados = promedio de la
    historia de cada usuario ponderado por su exposición ((tickets + pagos de servicios) × monto máximo).
    """
    usuarios = db.cargar_usuarios(conn)
    eventos = db.cargar_eventos(conn)
    tickets = db.cargar_tickets(conn)
    niveles, scores = db.contexto_anterior(conn, hoy)
    historia = {}
    for uid, lista in tickets.items():
        vencidos = [t for t in lista if t["fecha_vencimiento"] < hoy and t["estado"] not in ("disputa", "pausa_tecnica")]
        if vencidos:
            historia[uid] = (sum(t["estado"] == "pagado" and t["fecha_pago"] <= t["fecha_vencimiento"] for t in vencidos)
                             / len(vencidos),
                             sum(dias_atraso(t, hoy) >= C.MORA_DIA for t in vencidos) / len(vencidos))
    promedio = tuple(sum(h[i] for h in historia.values()) / max(len(historia), 1) for i in (0, 1))

    def escenario():
        exposicion, repago, mora, habilitados = 0.0, 0.0, 0.0, 0
        for uid, u in usuarios.items():
            perfil, _ = evaluar_usuario(u, eventos.get(uid, []), tickets.get(uid, []), hoy,
                                        niveles.get(uid), scores.get(uid))
            if not perfil["habilitado"]:
                continue
            habilitados += 1
            nivel = C.NIVELES[perfil["nivel"]]
            cupo = (nivel["tickets"] + nivel["servicios_cupo"]) * nivel["monto_max"]
            r, m = historia.get(uid, promedio)
            exposicion += cupo
            repago += cupo * r
            mora += cupo * m
        return {"exposicion": exposicion, "habilitados": habilitados,
                "repago": 100 * repago / exposicion if exposicion else None,
                "mora": 100 * mora / exposicion if exposicion else None}

    antes = escenario()
    with C.con_valores(cambios):
        despues = escenario()
    prestado = resumen(conn, hoy)["kpis"]["monto_prestado"]
    factor = despues["exposicion"] / antes["exposicion"] if antes["exposicion"] else 1
    r1 = lambda x: None if x is None else round(x, 1)
    return {"metricas": [
        {"metrica": "Mora", "unidad": "pct", "antes": r1(antes["mora"]), "despues": r1(despues["mora"]),
         "mejor_si_sube": False},
        {"metrica": "Repago a tiempo", "unidad": "pct", "antes": r1(antes["repago"]), "despues": r1(despues["repago"]),
         "mejor_si_sube": True},
        {"metrica": "Monto prestado", "unidad": "usd", "antes": prestado, "despues": round(prestado * factor, 2),
         "mejor_si_sube": True},
        {"metrica": "Usuarios habilitados", "unidad": "n", "antes": antes["habilitados"],
         "despues": despues["habilitados"], "mejor_si_sube": True},
    ]}
