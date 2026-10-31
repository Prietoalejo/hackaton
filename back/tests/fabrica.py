"""Constructores de datos armados a mano para los tests del motor (sin base de datos)."""
import itertools
from datetime import date, timedelta

from app.motor.cobros import nuevo_ticket

HOY = date(2026, 10, 31)
_ids = itertools.count(1)


def hace(dias: int) -> date:
    return HOY - timedelta(days=dias)


def usuario(**cambios) -> dict:
    base = {"id": "u_test", "nombre": "Test", "alias": "@test", "fecha_registro": hace(200),
            "cedula_verificada": True, "vehiculo_verificado": True, "saldo_wallet": 0.0,
            "perfil_sintetico": None, "quincenero": False, "canal_preferido": "push", "club": "Turista",
            "habilitado_desde": hace(150), "modo_recuperacion": False}
    return {**base, **cambios}


def evento(fecha, tipo, servicio=None, monto=1.0, ticket_id=None, a_tiempo=None) -> dict:
    return {"id": next(_ids), "user_id": "u_test", "fecha": fecha, "tipo": tipo, "servicio": servicio,
            "monto": monto, "ticket_id": ticket_id, "a_tiempo": a_tiempo}


def facturas(n=3, desde_hace=170) -> list:
    """Pagos de servicios a tiempo (habilitan al usuario)."""
    return [evento(hace(desde_hace - 30 * i), "pago_servicio", "luz", 10.0, a_tiempo=True) for i in range(n)]


def ticket(uso, estado="abierto", monto=4.0, servicio="estacionamiento", vence=None, **cambios) -> dict:
    t = nuevo_ticket(next(_ids), "u_test", servicio, "C.C. El Tolón", monto, uso)
    if vence:
        t["fecha_vencimiento"] = vence
    t.update(estado=estado, **cambios)
    return t


def ticket_pagado(uso, dias_vs_vencimiento=0, monto=4.0):
    """Ticket ya pagado más sus eventos. dias_vs_vencimiento < 0 = antes del vencimiento."""
    t = ticket(uso, monto=monto)
    pago = t["fecha_vencimiento"] + timedelta(days=dias_vs_vencimiento)
    t.update(estado="pagado", fecha_pago=pago, monto_pagado=t["monto"] + t["gasto_admin"])
    eventos = [evento(uso, "uso_ticket", t["servicio"], t["monto"], t["id"]),
               evento(pago, "repago_ticket", t["servicio"], t["monto_pagado"], t["id"],
                      a_tiempo=dias_vs_vencimiento <= 0)]
    return t, eventos


def historial_puntual(n_tickets=12, cada=7, desde_hace=88, dias_vs_vencimiento=0):
    """Usuario habilitado que usa un ticket cada `cada` días y lo paga el día de cobro."""
    tickets, eventos = [], facturas()
    for i in range(n_tickets):
        t, ev = ticket_pagado(hace(desde_hace - cada * i), dias_vs_vencimiento)
        tickets.append(t)
        eventos += ev
    return tickets, eventos
