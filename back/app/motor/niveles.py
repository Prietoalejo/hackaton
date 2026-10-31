"""Score + historial → nivel (0 Inicial, 1 Básico, 2 Confiable, 3 Premium).

1. Nivel por score: el mayor n con score >= UMBRALES_NIVEL[n].
2. Margen para bajar: si venía de un nivel más alto, lo conserva mientras el score no caiga más de
   MARGEN_BAJADA puntos bajo el umbral de ese nivel (nadie rebota por un mal día).
3. Requisitos: repagos a tiempo (REPAGOS_POR_NIVEL) y, para Premium, X_MESES_HISTORIAL meses.
   El nivel final es el menor entre el del score y el de los requisitos.
Solo aplica a usuarios habilitados.
"""
from app import config as C
from app.motor.score import meses_desde


def repagos_a_tiempo(tickets) -> int:
    return sum(1 for t in tickets
               if t["estado"] == "pagado" and t["fecha_pago"] <= t["fecha_vencimiento"])


def _umbral(n, umbrales) -> float:
    return 0 if n == 0 else umbrales[n]


def nivel_por_score(score, nivel_anterior=None, umbrales=None, margen=None) -> int:
    umbrales = umbrales or C.UMBRALES_NIVEL
    margen = C.MARGEN_BAJADA if margen is None else margen
    sube = max([n for n in range(4) if score >= _umbral(n, umbrales)], default=0)
    if nivel_anterior is None or sube >= nivel_anterior:
        return sube
    conserva = max(n for n in range(nivel_anterior + 1) if score >= _umbral(n, umbrales) - margen)
    return max(sube, conserva)


def nivel_por_requisitos(repagos, usuario, hoy) -> int:
    nivel = 0
    for n in (1, 2, 3):
        if repagos < C.REPAGOS_POR_NIVEL[n]:
            break
        if n == 3 and meses_desde(usuario["fecha_registro"], hoy) < C.X_MESES_HISTORIAL:
            break
        nivel = n
    return nivel


def evaluar_nivel(score, historial, usuario, hoy, nivel_anterior=None, umbrales=None, repagos_extra=0) -> dict:
    """`historial` = {"eventos": [...], "tickets": [...]}. Devuelve el nivel y el progreso al siguiente."""
    umbrales = umbrales or C.UMBRALES_NIVEL
    repagos = repagos_a_tiempo(historial["tickets"]) + repagos_extra
    por_score = nivel_por_score(score, nivel_anterior, umbrales)
    por_requisitos = nivel_por_requisitos(repagos, usuario, hoy)
    nivel = min(por_score, por_requisitos)

    progreso = None
    if nivel < 3:
        siguiente = nivel + 1
        requeridos = C.REPAGOS_POR_NIVEL[siguiente]
        progreso = {
            "siguiente_nivel": siguiente,
            "siguiente_nombre": C.NOMBRES_NIVEL[siguiente],
            "faltan_puntos": max(0, int(_umbral(siguiente, umbrales) - score)),
            "repagos_hechos": min(repagos, requeridos) if requeridos else repagos,
            "repagos_requeridos": requeridos,
            "faltan_repagos": max(0, requeridos - repagos),
        }
    return {"nivel": nivel, "nivel_score": por_score, "nivel_requisitos": por_requisitos,
            "repagos_a_tiempo": repagos, "progreso": progreso}


def calcular_nivel(score, historial, usuario, hoy, nivel_anterior=None, umbrales=None) -> int:
    return evaluar_nivel(score, historial, usuario, hoy, nivel_anterior, umbrales)["nivel"]
