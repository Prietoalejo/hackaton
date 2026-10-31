"""Eventos → Trust Score (0 a 100) con sus razones.

Puntualidad 40 + Constancia 20 + Antigüedad 15 + Anticipados 15 + Verificación 10 − Fricción (hasta 10).
Los eventos y tickets son dicts con las columnas de sus tablas; las fechas son `datetime.date`.
"""
import math
from datetime import timedelta

from app import config as C

# Tickets que no cuentan para atraso ni puntualidad
ESTADOS_PROTEGIDOS = ("disputa", "pausa_tecnica")
ESTADOS_VENCIDOS = ("gracia", "atrasado", "mora")
ESTADOS_IMPAGOS = ("abierto",) + ESTADOS_VENCIDOS
# Eventos que genera el sistema, no el usuario: no cuentan como actividad
EVENTOS_DEL_SISTEMA = ("comision", "debito_wallet")
DIAS_POR_MES = 30.4375

NOMBRES_SENAL = {"puntualidad": "Puntualidad", "constancia": "Constancia", "antiguedad": "Antigüedad",
                 "anticipados": "Anticipados", "verificacion": "Verificación", "friccion": "Fricción"}


def redondear(x: float) -> int:
    """Redondeo comercial (0,5 se aleja del cero), no el de banquero de `round`."""
    return int(math.floor(x + 0.5)) if x >= 0 else -int(math.floor(-x + 0.5))


def en_ventana(fecha, hoy, dias: int = None) -> bool:
    dias = C.VENTANA_DIAS if dias is None else dias
    return hoy - timedelta(days=dias) < fecha <= hoy


def meses_desde(fecha, hoy) -> float:
    return max(0, (hoy - fecha).days) / DIAS_POR_MES


def dias_atraso(ticket, hoy) -> int:
    """Días de atraso: pagado tarde, o impago vencido. Disputa y pausa técnica → 0."""
    if ticket["estado"] in ESTADOS_PROTEGIDOS:
        return 0
    fin = ticket["fecha_pago"] if ticket["estado"] == "pagado" else hoy
    return max(0, (fin - ticket["fecha_vencimiento"]).days)


def ticket_en_ventana(ticket, hoy, dias: int = None) -> bool:
    """Un ticket pagado cuenta si se pagó en la ventana; una deuda viva cuenta siempre."""
    if ticket["estado"] == "pagado":
        return en_ventana(ticket["fecha_pago"], hoy, dias)
    return ticket["fecha_uso"] <= hoy


def vence_original(ticket):
    """Vencimiento antes de moverlo a la quincena: moverlo da más plazo, no convierte un pago en anticipado."""
    return min(ticket["fecha_vencimiento"], ticket["fecha_uso"] + timedelta(days=C.PLAZO_BASE_DIAS))


def es_anticipado(ticket) -> bool:
    return (ticket["estado"] == "pagado"
            and ticket["fecha_pago"] <= vence_original(ticket) - timedelta(days=C.DIAS_ANTICIPADO))


def cuenta_para_premios(monto) -> bool:
    """Puntos, racha y repagos solo cuentan desde un monto mínimo (sin tickets de céntimos)."""
    return monto >= C.MONTO_MIN_PREMIO


def calcular_score(eventos, tickets, usuario, hoy) -> dict:
    protegidos = {t["id"] for t in tickets if t["estado"] in ESTADOS_PROTEGIDOS}
    ventana = [e for e in eventos if en_ventana(e["fecha"], hoy)]

    # Solo cuentan los pagos que tienen fecha límite (a_tiempo no nulo)
    pagos = [e for e in ventana
             if e["tipo"] in ("pago_servicio", "repago_ticket")
             and e.get("a_tiempo") is not None
             and e.get("ticket_id") not in protegidos]
    proporcion = (sum(1 for e in pagos if e["a_tiempo"]) / len(pagos)
                  if pagos else C.PUNTUALIDAD_SIN_HISTORIAL)

    semanas = {(hoy - e["fecha"]).days // 7 for e in eventos
               if e["tipo"] not in EVENTOS_DEL_SISTEMA
               and 0 <= (hoy - e["fecha"]).days < 7 * C.CONSTANCIA_SEMANAS}

    meses = min(meses_desde(usuario["fecha_registro"], hoy), C.ANTIGUEDAD_MESES_MAX)

    repagos = [t for t in tickets if t["estado"] == "pagado" and en_ventana(t["fecha_pago"], hoy)]
    anticipados = (sum(1 for t in repagos if es_anticipado(t)) / len(repagos)) if repagos else 0

    verificados = int(bool(usuario.get("cedula_verificada"))) + int(bool(usuario.get("vehiculo_verificado")))
    rechazos = sum(1 for e in ventana if e["tipo"] == "rechazo_fondos")
    atraso = sum(dias_atraso(t, hoy) for t in tickets if ticket_en_ventana(t, hoy))

    aportes = {
        "puntualidad": (C.PESOS["puntualidad"] * proporcion, C.PESOS["puntualidad"]),
        "constancia": (C.PESOS["constancia"] * len(semanas) / C.CONSTANCIA_SEMANAS, C.PESOS["constancia"]),
        "antiguedad": (C.PESOS["antiguedad"] * meses / C.ANTIGUEDAD_MESES_MAX, C.PESOS["antiguedad"]),
        "anticipados": (C.PESOS["anticipados"] * anticipados, C.PESOS["anticipados"]),
        "verificacion": (C.PESOS["verificacion"] * verificados / 2, C.PESOS["verificacion"]),
        "friccion": (max(C.FRICCION_MAX, C.FRICCION_POR_RECHAZO * rechazos + C.FRICCION_POR_DIA_ATRASO * atraso),
                     C.FRICCION_MAX),
    }
    razones = [{"senal": s, "nombre": NOMBRES_SENAL[s], "aporte": round(v, 1), "max": m}
               for s, (v, m) in aportes.items()]
    score = min(100, max(0, redondear(sum(v for v, _ in aportes.values()))))
    return {"trust_score": score, "razones": razones}
