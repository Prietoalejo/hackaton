"""Junta las piezas del motor: usuario + historial → perfil y decisiones. Función pura."""
from app.motor.beneficios import calcular_beneficios
from app.motor.club import calcular_club
from app.motor.decisiones import decidir
from app.motor.habilitacion import evaluar_habilitacion
from app.motor.niveles import evaluar_nivel
from app.motor.quincena import calcular_quincena
from app.motor.score import calcular_score
from app.motor.segmentos import calcular_segmento


def estado_mora(tickets) -> str:
    estados = {t["estado"] for t in tickets}
    for estado in ("mora", "atrasado", "gracia"):
        if estado in estados:
            return estado
    return "al_dia"


def evaluar_usuario(usuario, eventos, tickets, hoy, nivel_anterior=None, score_hace_7=None):
    """Devuelve (perfil, decision).

    `perfil` tiene las columnas de la tabla perfiles más `checklist`, `progreso` y `habilitado_desde`
    (estas no se guardan en perfiles).
    """
    score = calcular_score(eventos, tickets, usuario, hoy)
    habilitacion = evaluar_habilitacion(usuario, eventos, hoy)
    habilitado = habilitacion["habilitado"]
    nivel, progreso = None, None
    club = calcular_club(eventos, tickets, hoy)
    if habilitado:
        detalle = evaluar_nivel(score["trust_score"], {"eventos": eventos, "tickets": tickets}, usuario, hoy,
                                nivel_anterior)
        nivel, progreso = detalle["nivel"], detalle["progreso"]
    habilitado_desde = (usuario.get("habilitado_desde") or hoy) if habilitado else None

    perfil = {
        "user_id": usuario["id"],
        "trust_score": score["trust_score"],
        "razones": score["razones"],
        "habilitado": habilitado,
        "nivel": nivel,
        "segmento": calcular_segmento(eventos, tickets, usuario, hoy, habilitado, habilitado_desde,
                                      score["trust_score"], score_hace_7),
        "estado_mora": estado_mora(tickets),
        "quincena": calcular_quincena(eventos, hoy),
        "actualizado": hoy,
        "checklist": habilitacion["checklist"],
        "progreso": progreso,
        "habilitado_desde": habilitado_desde,
        "club": club,
    }
    perfil["beneficios"] = calcular_beneficios(
        {**perfil, "modo_recuperacion": usuario.get("modo_recuperacion")}, club, eventos, tickets, hoy)
    # Cupo variable dentro del nivel. En Inicial (arranque en frío) solo puede quedarse igual.
    ajuste = perfil["beneficios"]["ajuste_cupo"] if habilitado else 0
    perfil["ajuste_cupo"] = min(ajuste, 0) if nivel == 0 else ajuste
    contexto = {**perfil, "usuario": usuario, "nivel_anterior": nivel_anterior}
    return perfil, decidir(contexto, tickets, eventos, hoy)
