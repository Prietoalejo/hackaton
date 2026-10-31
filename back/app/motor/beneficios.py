"""Motor de beneficios del Club PagoDirecto. Función pura.

Cada ruta del Club trae un beneficio base (C.RUTAS_CLUB: walletback y tickets gratis). El motor no lo
entrega fijo: lo multiplica por un factor personal que sube o baja según cómo paga cada persona, y le
suma un beneficio "a tu medida" según cómo usa PagoDirecto. Premia lo que reduce el riesgo (pagar a
tiempo, antes, con constancia), nunca usar más crédito.

    factor = 1 + señales (puntualidad, anticipados, score, riesgo), acotado a [mínimo, máximo]
    La racha no entra aquí: es del Club y solo multiplica los puntos (×1,5), para no premiar dos veces lo mismo.
    En modo recuperación el factor es 0: los beneficios quedan en pausa hasta saldar.
"""
from app import config as C
from app.motor.score import en_ventana, es_anticipado


def _pagos_con_fecha(eventos, hoy) -> list:
    """Pagos con fecha límite (servicios y cuotas) en la ventana: [a_tiempo, ...]."""
    return [e["a_tiempo"] for e in eventos
            if e["tipo"] in ("pago_servicio", "repago_ticket") and e.get("a_tiempo") is not None
            and en_ventana(e["fecha"], hoy, C.VENTANA_DIAS)]


def _este_mes(fecha, hoy) -> bool:
    return fecha is not None and (fecha.year, fecha.month) == (hoy.year, hoy.month) and fecha <= hoy


def _gasto_mensual(eventos, hoy) -> float:
    """USD pagados en PagoDirecto en los últimos 30 días (para estimar el walletback)."""
    return sum(e["monto"] or 0.0 for e in eventos
               if e["tipo"] in ("pago_servicio", "repago_ticket") and en_ventana(e["fecha"], hoy, 30))


def factor_personal(perfil, eventos, tickets, hoy) -> dict:
    """Factor que multiplica el beneficio base de la ruta, con sus razones (para mostrar el porqué)."""
    v = C.VALORES
    if perfil.get("modo_recuperacion"):
        return {"factor": 0.0, "pausa": True, "razones": [
            {"senal": "mora", "efecto": -1.0, "texto": "Beneficios en pausa mientras está en modo recuperación"}]}

    razones = []

    def senal(clave, efecto, texto):
        if efecto:
            razones.append({"senal": clave, "efecto": round(efecto, 2), "texto": texto})

    pagos = _pagos_con_fecha(eventos, hoy)
    if len(pagos) >= C.BENEFICIO_MIN_PAGOS:
        puntual = sum(pagos) / len(pagos)
        if puntual >= 0.95:
            senal("puntualidad", v["bono_puntualidad_pct"] / 100, f"Paga a tiempo el {puntual:.0%} de sus pagos")
        elif puntual < 0.8:
            senal("puntualidad", -v["bono_puntualidad_pct"] / 100, f"Solo el {puntual:.0%} de sus pagos llega a tiempo")

    cuotas = [t for t in tickets if t["estado"] == "pagado" and en_ventana(t["fecha_pago"], hoy, C.VENTANA_DIAS)]
    if len(cuotas) >= C.BENEFICIO_MIN_PAGOS:
        anticipadas = sum(1 for t in cuotas if es_anticipado(t)) / len(cuotas)
        if anticipadas >= 0.5:
            senal("anticipados", v["bono_anticipados_pct"] / 100, f"Paga antes del vencimiento el {anticipadas:.0%} de sus cuotas")

    score = perfil.get("trust_score")
    if score is not None and score >= C.UMBRALES_NIVEL[3]:
        senal("score", v["bono_score_pct"] / 100, f"Trust Score alto ({score})")
    elif score is not None and score < C.UMBRALES_NIVEL[1]:
        senal("score", -v["bono_score_pct"] / 100, f"Trust Score bajo ({score})")

    if perfil.get("segmento") == C.SEG_EN_RIESGO:
        senal("riesgo", -v["castigo_riesgo_pct"] / 100, "Atraso, comisión o score cayendo en los últimos días")

    bruto = 1 + sum(r["efecto"] for r in razones)
    factor = min(v["beneficio_max_pct"], max(v["beneficio_min_pct"], bruto * 100)) / 100
    return {"factor": round(factor, 2), "pausa": False, "razones": razones}


def _a_tu_medida(perfil, factor) -> dict | None:
    """Un beneficio elegido por cómo usa PagoDirecto (no por cuánto crédito usa)."""
    if factor["pausa"]:
        return {"tipo": "recuperacion", "nombre": "Recupera tus beneficios",
                "detalle": "Salda tu cuota y vuelven tus beneficios del Club al instante."}
    segmento = perfil.get("segmento")
    if segmento == C.SEG_SIN_CREDITO:
        return None   # sin Credirecto no hay cuotas: solo el beneficio de su ruta
    if segmento == C.SEG_CONDUCTOR:
        return {"tipo": "ticket_extra", "nombre": "+1 ticket gratis de estacionamiento",
                "detalle": "Porque estacionas casi todos los días."}
    if segmento == C.SEG_PUNTUAL:
        return {"tipo": "cuota_sin_gasto", "nombre": "1 cuota al mes sin gasto administrativo",
                "detalle": "Porque pagas antes o el día de cobro."}
    if segmento == C.SEG_NUEVO:
        return {"tipo": "bienvenida", "nombre": "Walletback doble en tu primer mes",
                "detalle": "Bienvenida a Credirecto: paga a tiempo y lo mantienes."}
    if segmento == C.SEG_ENFRIAMIENTO:
        return {"tipo": "reactivacion", "nombre": "Walletback doble en tu próximo pago de servicio",
                "detalle": "Te extrañamos: vuelve a pagar con PagoDirecto."}
    if segmento == C.SEG_EN_RIESGO:
        return {"tipo": "recupera_factor", "nombre": "Recupera tu beneficio completo",
                "detalle": f"Paga a tiempo tus próximas {C.BENEFICIO_MIN_PAGOS} cuotas y vuelve al 100 %."}
    if perfil.get("quincena") and C.VALORES["ofrecer_quincena"]:
        return {"tipo": "quincena", "nombre": "Cuotas en tu quincena sin costo",
                "detalle": "Movemos tus cuotas a tu día de cobro."}
    return None


def ajuste_cupo(factor) -> int:
    """Tickets (y pagos de servicios) que gana o pierde dentro de su nivel: ±ajuste_cupo_max.

    Cuentan las mismas señales de riesgo del factor (puntualidad, anticipados, score, riesgo); la racha
    semanal no entra, así el cupo no cambia cada lunes. En modo recuperación pierde cupo.
    """
    tope = int(C.VALORES["ajuste_cupo_max"])
    if factor["pausa"]:
        return -tope
    s = sum(r["efecto"] for r in factor["razones"])
    if s >= C.CUPO_SUBE_DESDE:
        return tope
    if s <= C.CUPO_BAJA_DESDE:
        return -tope
    return 0


def walletback_pct(beneficios) -> float:
    return next(b["personal"] for b in beneficios["beneficios"] if b["tipo"] == "walletback")


def walletback_de_pago(beneficios, monto, a_tiempo) -> float:
    """Walletback que se acredita a la wallet por pagar una cuota a tiempo (USD). Nunca por usar crédito."""
    if not a_tiempo or monto <= 0:
        return 0.0
    return round(monto * walletback_pct(beneficios) / 100, 2)


def calcular_beneficios(perfil, club, eventos, tickets, hoy) -> dict:
    """Beneficios de la ruta del Club para esta persona: base fija × factor personal + uno a su medida."""
    ruta = C.RUTAS_CLUB[club["nivel_club"]]
    f = factor_personal(perfil, eventos, tickets, hoy)
    walletback = round(ruta["walletback_pct"] * f["factor"], 2)
    tickets_gratis = int(round(ruta["tickets_gratis"] * f["factor"]))
    a_medida = _a_tu_medida(perfil, f)
    if a_medida and a_medida["tipo"] == "ticket_extra":
        tickets_gratis += 1
    if a_medida and a_medida["tipo"] == "cuota_sin_gasto":
        # Una vez al mes: ya la usó si este mes saldó una cuota con todo el gasto administrativo descontado
        usada = any(t["estado"] == "pagado" and _este_mes(t["fecha_pago"], hoy)
                    and t["gasto_admin"] > 0 and t["descuento"] >= t["gasto_admin"] for t in tickets)
        a_medida = {**a_medida, "disponible": not usada and not f["pausa"]}
    gratis_usados = sum(1 for e in eventos if e["tipo"] == "ticket_gratis" and _este_mes(e["fecha"], hoy))
    recibido = round(sum(e["monto"] or 0.0 for e in eventos if e["tipo"] == "walletback" and _este_mes(e["fecha"], hoy)), 2)
    return {
        "ruta": club["texto"], "factor": f["factor"], "pausa": f["pausa"], "razones": f["razones"],
        "beneficios": [
            {"tipo": "walletback", "nombre": "Walletback", "unidad": "%", "base": ruta["walletback_pct"],
             "personal": walletback, "recibido_mes": recibido,
             "estimado_mes": round(_gasto_mensual(eventos, hoy) * walletback / 100, 2)},
            {"tipo": "tickets_gratis", "nombre": "Tickets gratis de estacionamiento al mes", "unidad": "",
             "base": ruta["tickets_gratis"], "personal": tickets_gratis, "usados_mes": gratis_usados,
             "disponibles": 0 if f["pausa"] else max(0, tickets_gratis - gratis_usados)},
        ],
        "a_tu_medida": a_medida,
        "ajuste_cupo": ajuste_cupo(f),
    }
