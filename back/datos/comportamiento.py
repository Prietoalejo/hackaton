"""Comportamiento de los usuarios sintéticos. Solo para datos: el motor nunca lo usa.

Todo es determinista: cada decisión sale de un generador aleatorio sembrado con (semilla, usuario, fecha),
así el historial que arma `generar.py` y los días que avanza `POST /simular-dia` siguen el mismo patrón,
y los mundos "regla actual" y "Ritmo" comparten las mismas intenciones de cada usuario.
"""
import random
from datetime import date, timedelta

from app import config as C
from app.motor.cobros import oferta_quincena
from app.motor.quincena import fecha_de_quincena

SEMILLA = 42
FECHA_RELOJ = date(2026, 10, 31)
HISTORIA = {"u_0142", "u_0333", "u_0007"}   # usuarios de historia: su demo se maneja a mano
QUINCENAS = [[15, 30], [1, 15], [5, 20]]

# Probabilidades por día (ticket, movilidad, rechazo) y por cuota o factura (el resto)
PERFILES = {
    "puntual": dict(ticket=0.12, movilidad=0.10, rechazo=0.003, a_tiempo=0.93, anticipado=0.45, factura=0.95,
                    servicios={"estacionamiento": 0.5, "parquimetro": 0.15, "peaje": 0.1, "luz": 0.1,
                               "internet": 0.08, "telefono": 0.07}),
    "conductor": dict(ticket=0.22, movilidad=0.62, rechazo=0.005, a_tiempo=0.85, anticipado=0.20, factura=0.90,
                      servicios={"estacionamiento": 0.6, "peaje": 0.3, "parquimetro": 0.1}),
    "ocasional": dict(ticket=0.05, movilidad=0.06, rechazo=0.006, a_tiempo=0.75, anticipado=0.15, factura=0.80,
                      servicios={"estacionamiento": 0.7, "peaje": 0.1, "telefono": 0.1, "luz": 0.1}),
    "moroso": dict(ticket=0.12, movilidad=0.10, rechazo=0.03, a_tiempo=0.45, anticipado=0.08, factura=0.60,
                   servicios={"estacionamiento": 0.6, "peaje": 0.2, "telefono": 0.2}),
    "sin_credito": dict(ticket=0.0, movilidad=0.10, rechazo=0.003, a_tiempo=0.0, anticipado=0.0, factura=0.90,
                        servicios={"estacionamiento": 1.0}),
}
MONTOS = {"estacionamiento": (1.0, 5.0), "parquimetro": (0.5, 2.0), "peaje": (0.5, 3.0), "luz": (5.0, 14.0),
          "internet": (10.0, 25.0), "telefono": (5.0, 12.0), "seguro": (15.0, 40.0)}
COMERCIOS = {
    "estacionamiento": ["C.C. El Tolón", "C.C. Sambil Chacao", "C.C. Líder", "C.C. San Ignacio", "C.C. Millennium"],
    "parquimetro": ["Parquímetro Chacao", "Parquímetro Altamira", "Parquímetro Los Palos Grandes"],
    "peaje": ["Peaje Tazón", "Peaje Guarenas", "Peaje Tejerías"],
    "luz": ["Corpoelec"], "internet": ["CANTV", "Inter", "NetUno"],
    "telefono": ["Movistar", "Digitel", "Movilnet"], "seguro": ["Seguros Caracas", "Mercantil Seguros"],
}
# Efecto de Ritmo y del riesgo sobre la probabilidad de pagar a tiempo
BONO_QUINCENA = 0.06       # la cuota cae en su día de cobro
BONO_RECORDATORIO = 0.04   # recibe recordatorio a su hora
BONO_DESCUENTO = 0.10      # Confiable y Premium anticipan más por el descuento
PENALIZACION_RIESGO = 0.18 # quien no cumpliría los requisitos de habilitación paga peor...
PROB_MORA_RIESGO = 0.45    # ...y cuando se atrasa, suele llegar a mora
PROB_MORA_MOROSO = 0.6
PROP_ENFRIANDO = 0.15
DIAS_ADOPCION = 150        # los usuarios empiezan a usar Credirecto en algún día de los primeros 150
DIAS_ENFRIANDO = 28


def rng(*partes) -> random.Random:
    return random.Random("|".join(str(p) for p in (SEMILLA,) + partes))


def quincena_de(user_id) -> list:
    return rng("quincena", user_id).choice(QUINCENAS)


def facturas_de(user_id) -> list:
    r = rng("facturas", user_id)
    if r.random() < 0.06:
        return []
    return r.sample(["luz", "internet", "telefono"], r.randint(1, 3))


def _factor(user_id, hoy) -> float:
    """Los que se están enfriando bajan su actividad en las últimas 4 semanas (y siguen así)."""
    enfria = rng("enfria", user_id).random() < PROP_ENFRIANDO
    return 0.25 if enfria and hoy > FECHA_RELOJ - timedelta(days=DIAS_ENFRIANDO) else 1.0


def _sintetico(usuario, hoy) -> bool:
    return (usuario.get("perfil_sintetico") in PERFILES and usuario["id"] not in HISTORIA
            and hoy >= usuario["fecha_registro"])


def adopcion(usuario):
    """Día en que el usuario empieza a pagar con Credirecto: reparte las cohortes de mayo a octubre."""
    inicio = max(usuario["fecha_registro"], date(2026, 5, 1))
    return inicio + timedelta(days=rng("adopcion", usuario["id"]).randint(0, DIAS_ADOPCION))


def _evento(uid, hoy, tipo, servicio=None, monto=0.0, a_tiempo=None) -> dict:
    return {"user_id": uid, "fecha": hoy, "tipo": tipo, "servicio": servicio, "monto": round(monto, 2),
            "ticket_id": None, "a_tiempo": a_tiempo}


def actividad(usuario, hoy) -> list:
    """Recargas, facturas, pagos de movilidad y rechazos del día (todo lo que no es Credirecto)."""
    if not _sintetico(usuario, hoy):
        return []
    uid = usuario["id"]
    p = PERFILES[usuario["perfil_sintetico"]]
    r = rng("dia", uid, hoy)
    f = _factor(uid, hoy)
    quincena = quincena_de(uid)
    eventos = []
    if any(hoy == fecha_de_quincena(hoy.year, hoy.month, q) for q in quincena):
        if r.random() < (0.95 if usuario.get("quincenero") else 0.6) * f:
            eventos.append(_evento(uid, hoy, "recarga", monto=r.uniform(10, 60)))
        if hoy == fecha_de_quincena(hoy.year, hoy.month, quincena[0]):
            for servicio in facturas_de(uid):
                if r.random() < 0.95:
                    eventos.append(_evento(uid, hoy, "pago_servicio", servicio, r.uniform(*MONTOS[servicio]),
                                           a_tiempo=r.random() < p["factura"]))
    elif r.random() < 0.02 * f:
        eventos.append(_evento(uid, hoy, "recarga", monto=r.uniform(5, 30)))
    # Pagos de movilidad al instante: no tienen fecha límite, a_tiempo queda nulo
    if r.random() < p["movilidad"] * f:
        servicio = r.choice(C.SERVICIOS_MOVILIDAD)
        eventos.append(_evento(uid, hoy, "pago_servicio", servicio, r.uniform(*MONTOS[servicio])))
    if r.random() < p["rechazo"]:
        servicio = r.choice(C.SERVICIOS)
        eventos.append(_evento(uid, hoy, "rechazo_fondos", servicio, r.uniform(2, 20)))
    return eventos


def intencion(usuario, hoy):
    """¿Quiere pagar algo con Credirecto hoy? → {"servicio", "monto", "comercio"} o None."""
    if not _sintetico(usuario, hoy):
        return None
    if hoy < adopcion(usuario):
        return None
    p = PERFILES[usuario["perfil_sintetico"]]
    r = rng("uso", usuario["id"], hoy)
    if r.random() >= p["ticket"] * _factor(usuario["id"], hoy):
        return None
    servicios = list(p["servicios"])
    servicio = r.choices(servicios, weights=[p["servicios"][s] for s in servicios])[0]
    return {"servicio": servicio, "monto": round(r.uniform(*MONTOS[servicio]), 2),
            "comercio": r.choice(COMERCIOS[servicio])}


def plan_de_pago(usuario, ticket, ritmo, nivel, alineado, riesgo):
    """Fecha en que el usuario pagará la cuota, o None si nunca la paga.

    El mismo sorteo sirve para los dos mundos: Ritmo solo sube la probabilidad de pagar a tiempo,
    así que todo lo que se paga a tiempo con la regla actual también se paga a tiempo con Ritmo.
    """
    p = PERFILES[usuario["perfil_sintetico"]]
    r = rng("pago", usuario["id"], ticket["fecha_uso"], ticket["servicio"])
    x = r.random()
    a_tiempo = p["a_tiempo"] - (PENALIZACION_RIESGO if riesgo else 0)
    anticipado = p["anticipado"]
    if ritmo:
        a_tiempo += BONO_RECORDATORIO + (BONO_QUINCENA if alineado else 0)
        anticipado += BONO_DESCUENTO if nivel is not None and nivel >= 2 else 0
    anticipado = min(anticipado, a_tiempo)
    uso, vence = ticket["fecha_uso"], ticket["fecha_vencimiento"]
    if x < anticipado:
        return uso + timedelta(days=r.randint(0, max(0, (vence - uso).days - C.DIAS_ANTICIPADO)))
    if x < a_tiempo:
        return vence
    prob_mora = PROB_MORA_MOROSO if usuario["perfil_sintetico"] == "moroso" else (PROB_MORA_RIESGO if riesgo else 0)
    if r.random() < prob_mora:
        return None if r.random() < 0.3 else vence + timedelta(days=r.randint(C.MORA_DIA, 25))
    return vence + timedelta(days=r.randint(1, C.MORA_DIA - 2))


def acepta_quincena(usuario, ticket) -> bool:
    r = rng("quincena-acepta", usuario["id"], ticket["fecha_uso"])
    return r.random() < (0.85 if usuario.get("quincenero") else 0.25)


def planificar(usuario, ticket, nivel, hoy, riesgo=False) -> None:
    """Con Ritmo, si le ofrecen mover la cuota a su quincena y acepta, la mueve. Luego fija cuándo pagará."""
    ritmo = hoy >= C.RITMO_DESDE
    alineado = False
    if ritmo and nivel is not None:
        oferta = oferta_quincena(ticket, nivel, quincena_de(usuario["id"]))
        if oferta and acepta_quincena(usuario, ticket):
            ticket["fecha_vencimiento"] = oferta
            alineado = True
    ticket["pago_planeado"] = plan_de_pago(usuario, ticket, ritmo, nivel, alineado, riesgo)


class Comportamiento:
    """Lo que necesita `worker.mora.simular` para mover a los usuarios sintéticos."""
    actividad = staticmethod(actividad)
    intencion = staticmethod(intencion)
    planificar = staticmethod(planificar)
