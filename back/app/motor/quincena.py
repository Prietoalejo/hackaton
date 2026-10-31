"""Historial → días de cobro del usuario. Sección 6.4."""
import calendar
from collections import Counter
from datetime import date

from app import config as C
from app.motor.score import en_ventana


def calcular_quincena(eventos, hoy) -> list:
    """Los dos días del mes con más recargas y pagos de servicio en la ventana, ordenados.

    Los días 28 a 31 se cuentan juntos como "fin de mes" y se guardan como DIA_FIN_DE_MES.
    """
    conteo = Counter()
    for e in eventos:
        if e["tipo"] in ("recarga", "pago_servicio") and en_ventana(e["fecha"], hoy):
            dia = e["fecha"].day
            conteo[C.DIA_FIN_DE_MES if dia >= C.FIN_DE_MES_DESDE else dia] += 1

    if sum(conteo.values()) < C.QUINCENA_MIN_EVENTOS or len(conteo) < 2:
        return list(C.QUINCENA_DEFECTO)
    top = sorted(conteo.items(), key=lambda kv: (-kv[1], kv[0]))[:2]
    return sorted(dia for dia, _ in top)


def fecha_de_quincena(anio: int, mes: int, dia: int) -> date:
    """Fecha real de un día de quincena: el "fin de mes" es el último día del mes."""
    ultimo = calendar.monthrange(anio, mes)[1]
    return date(anio, mes, ultimo if dia >= C.FIN_DE_MES_DESDE else min(dia, ultimo))
