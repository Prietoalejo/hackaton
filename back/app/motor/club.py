"""Club PagoDirecto: puntos y ruta del usuario. Función pura.

El Club ya existe en PagoDirecto (de Turista a Leyenda): cada pago suma puntos y los puntos desbloquean
rutas. Credirecto no tiene puntos propios: sus cuotas pagadas a tiempo suman a este mismo saldo, y
cada nivel de Credirecto se amarra a una ruta del Club (ver C.RUTA_MINIMA_POR_NIVEL).
"""
from app import config as C
from app.motor.score import cuenta_para_premios, es_anticipado


def puntos_de_cuota(ticket, racha_completa=False) -> int:
    """Puntos que una cuota pagada suma al Club (0 si no está pagada, se pagó tarde o es de céntimos)."""
    if (ticket["estado"] != "pagado" or ticket["fecha_pago"] > ticket["fecha_vencimiento"]
            or not cuenta_para_premios(ticket["monto"])):
        return 0
    doble = es_anticipado(ticket) or racha_completa
    return int(C.PUNTOS_POR_PAGO * (C.MULTIPLICADOR_PUNTOS if doble else 1))


def nivel_club(puntos) -> int:
    """Índice en C.RUTAS_CLUB de la ruta más alta desbloqueada con esos puntos."""
    return max(i for i, r in enumerate(C.RUTAS_CLUB) if puntos >= r["desde"])


def calcular_club(eventos, tickets, hoy) -> dict:
    """Puntos del Club a la fecha y la ruta en la que va el usuario.

    Suman: cada pago de servicio en PagoDirecto (PUNTOS_POR_PAGO), cada cuota de Credirecto pagada a
    tiempo (×1,5 si se paga antes) y el bono por ruta completada (BONO_RUTA_COMPLETADA).
    """
    pagos = sum(1 for e in eventos if e["tipo"] == "pago_servicio" and e["fecha"] <= hoy)
    cuotas = [t for t in tickets if t["estado"] == "pagado" and t["fecha_pago"] and t["fecha_pago"] <= hoy]
    puntos_credirecto = sum(puntos_de_cuota(t) for t in cuotas)
    puntos = pagos * C.PUNTOS_POR_PAGO + puntos_credirecto
    # Cada ruta completada da un bono, que a su vez puede completar la siguiente
    completadas = 0
    while completadas + 1 < len(C.RUTAS_CLUB) and puntos >= C.RUTAS_CLUB[completadas + 1]["desde"]:
        completadas += 1
        puntos += C.BONO_RUTA_COMPLETADA
    n = nivel_club(puntos)
    ruta = C.RUTAS_CLUB[n]
    siguiente = C.RUTAS_CLUB[n + 1] if n + 1 < len(C.RUTAS_CLUB) else None
    # Todas las rutas para el carrusel del Club: completadas, la actual y las bloqueadas
    rutas = [{"nivel_club": i, "nivel_nombre": r["nivel"], "ruta": r["ruta"], "desde": r["desde"],
              "walletback_pct": r["walletback_pct"], "tickets_gratis": r["tickets_gratis"],
              "credirecto_nivel": nivel_credirecto_por_club(i),
              "estado": "completada" if i < n else "actual" if i == n else "bloqueada"}
             for i, r in enumerate(C.RUTAS_CLUB)]
    return {
        "nombre": C.CLUB_NOMBRE, "nivel_club": n, "nivel_nombre": ruta["nivel"], "ruta": ruta["ruta"],
        "texto": f"{ruta['nivel']} · {ruta['ruta']}", "puntos": puntos, "puntos_credirecto": puntos_credirecto,
        "siguiente": ({"nivel_club": n + 1, "nivel_nombre": siguiente["nivel"], "ruta": siguiente["ruta"],
                       "desde": siguiente["desde"], "faltan": siguiente["desde"] - puntos} if siguiente else None),
        "puntos_por_pago": C.PUNTOS_POR_PAGO, "multiplicador": C.MULTIPLICADOR_PUNTOS,
        "bono_ruta": C.BONO_RUTA_COMPLETADA,
        "desglose": {"servicios": pagos * C.PUNTOS_POR_PAGO, "credirecto": puntos_credirecto,
                     "rutas": completadas * C.BONO_RUTA_COMPLETADA},
        "rutas": rutas,
    }


def nivel_credirecto_por_club(n_club) -> int:
    """Nivel de Credirecto más alto que permite la ruta del Club en la que va el usuario."""
    return max(n for n, minima in C.RUTA_MINIMA_POR_NIVEL.items() if n_club >= minima)
