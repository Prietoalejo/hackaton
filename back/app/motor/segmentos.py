"""Historial → segmento. Gana el primero que cumpla, en este orden:

1. Sin crédito      no está habilitado
2. En riesgo        deuda vencida, pagó con comisión o 2+ rechazos en 30 días, o el score cayó 5+ en 7 días
3. Nuevo            menos de 30 días habilitado
4. En enfriamiento  sin usar el crédito en 21+ días
5. Conductor diario pagos de movilidad en 4+ días distintos por semana (promedio de 4 semanas)
6. Puntual          el resto: paga antes o el día de cobro
"""
from app import config as C
from app.motor.score import ESTADOS_VENCIDOS, dias_atraso, en_ventana


def calcular_segmento(eventos, tickets, usuario, hoy, habilitado, habilitado_desde=None, score=None,
                      score_hace_7=None) -> str:
    if not habilitado:
        return C.SEG_SIN_CREDITO

    deuda_vencida = any(t["estado"] in ESTADOS_VENCIDOS for t in tickets)
    # Pagar dentro de la gracia no es riesgo; pagar con comisión sí
    pago_tarde = any(t["estado"] == "pagado" and dias_atraso(t, hoy) > C.GRACIA_DIAS
                     and en_ventana(t["fecha_pago"], hoy, C.RIESGO_DIAS) for t in tickets)
    rechazos = sum(1 for e in eventos
                   if e["tipo"] == "rechazo_fondos" and en_ventana(e["fecha"], hoy, C.RIESGO_DIAS))
    cayendo = score is not None and score_hace_7 is not None and score_hace_7 - score >= C.RIESGO_CAIDA_SCORE
    if deuda_vencida or pago_tarde or rechazos >= C.RIESGO_RECHAZOS or cayendo:
        return C.SEG_EN_RIESGO

    desde = habilitado_desde or hoy
    if (hoy - desde).days < C.NUEVO_DIAS:
        return C.SEG_NUEVO

    usos = [e["fecha"] for e in eventos if e["tipo"] == "uso_ticket" and e["fecha"] <= hoy]
    ultimo_uso = max(usos) if usos else desde
    if (hoy - max(ultimo_uso, desde)).days >= C.ENFRIAMIENTO_DIAS:
        return C.SEG_ENFRIAMIENTO

    dias_movilidad = {e["fecha"] for e in eventos
                      if e["tipo"] in ("pago_servicio", "uso_ticket")
                      and e.get("servicio") in C.SERVICIOS_MOVILIDAD
                      and en_ventana(e["fecha"], hoy, 7 * C.CONDUCTOR_SEMANAS)}
    if len(dias_movilidad) >= C.CONDUCTOR_DIAS_SEMANA * C.CONDUCTOR_SEMANAS:
        return C.SEG_CONDUCTOR

    return C.SEG_PUNTUAL
