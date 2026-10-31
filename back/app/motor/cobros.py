"""Cuotas, gasto administrativo, gracia, comisión por desfase y descuentos por nivel. Funciones puras.

- Cuota = monto + gasto administrativo (GASTO_ADMIN del monto).
- Si paga antes del vencimiento, el gasto administrativo tiene el descuento de su nivel.
- Días 1..GRACIA_DIAS después del vencimiento: gracia, sin comisión.
- Desde el día GRACIA_DIAS + 1: comisión por desfase (COMISION de la cuota, mínimo COMISION_MIN), una sola vez.
- Desde el día MORA_DIA: mora → modo recuperación.
"""
from datetime import timedelta

from app import config as C
from app.motor.quincena import fecha_de_quincena
from app.motor.score import vence_original


def gasto_admin(monto: float) -> float:
    return round(monto * C.GASTO_ADMIN, 2)


def cuota(ticket) -> float:
    return round(ticket["monto"] + ticket["gasto_admin"], 2)


def comision_por_desfase(ticket) -> float:
    return round(max(cuota(ticket) * C.COMISION, C.COMISION_MIN), 2)


def descuento_por_nivel(ticket, nivel) -> float:
    if nivel is None:
        return 0.0
    return round(ticket["gasto_admin"] * C.DESCUENTO_NIVEL[nivel], 2)


def deuda(ticket) -> float:
    return round(ticket["monto"] + ticket["gasto_admin"] + ticket["comision"]
                 - ticket["descuento"] - ticket["monto_pagado"], 2)


def descuento_si_paga(ticket, hoy, nivel) -> float:
    """Descuento por nivel que tendría si salda la cuota hoy: solo antes del vencimiento."""
    return descuento_por_nivel(ticket, nivel) if hoy < vence_original(ticket) else 0.0


def estado_por_atraso(dias: int) -> str:
    if dias < 1:
        return "abierto"
    if dias <= C.GRACIA_DIAS:
        return "gracia"
    if dias < C.MORA_DIA:
        return "atrasado"
    return "mora"


def gracia_hasta(ticket):
    return ticket["fecha_vencimiento"] + timedelta(days=C.GRACIA_DIAS)


def vencimiento_base(fecha_uso):
    return fecha_uso + timedelta(days=C.PLAZO_BASE_DIAS)


def oferta_quincena(ticket, nivel, quincena):
    """Fecha de quincena a la que se puede mover la cuota sin pasar el plazo máximo del nivel, o None."""
    if nivel is None or ticket["estado"] not in ("abierto", "pausa_tecnica"):
        return None
    limite = ticket["fecha_uso"] + timedelta(days=C.NIVELES[nivel]["plazo_dias"])
    vence = ticket["fecha_vencimiento"]
    anio, mes = vence.year, vence.month
    for _ in range(2):
        for dia in sorted(quincena):
            f = fecha_de_quincena(anio, mes, dia)
            if vence < f <= limite:
                return f
        anio, mes = (anio + 1, 1) if mes == 12 else (anio, mes + 1)
    return None


def nuevo_ticket(ticket_id, user_id, servicio, comercio, monto, hoy) -> dict:
    return {"id": ticket_id, "user_id": user_id, "servicio": servicio, "comercio": comercio,
            "monto": round(monto, 2), "gasto_admin": gasto_admin(monto), "fecha_uso": hoy,
            "fecha_vencimiento": vencimiento_base(hoy), "fecha_pago": None, "estado": "abierto",
            "comision": 0.0, "descuento": 0.0, "monto_pagado": 0.0, "pago_planeado": None}


def cubrir_monto(monto, monto_max) -> dict:
    """El crédito cubre hasta monto_max; el resto lo paga el usuario con su saldo."""
    credito = round(min(monto, monto_max), 2)
    return {"credito": credito, "saldo": round(monto - credito, 2)}
