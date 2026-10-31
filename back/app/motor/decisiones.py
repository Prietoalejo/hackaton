"""Perfil → prestar, comunicar y premiar."""
from datetime import timedelta

from app import config as C
from app.motor.cobros import cubrir_monto, oferta_quincena
from app.motor.niveles import evaluar_nivel
from app.motor.score import ESTADOS_PROTEGIDOS, ESTADOS_VENCIDOS, dias_atraso, es_anticipado


def en_uso(tickets) -> list:
    """Tickets que ocupan cupo: todo lo que no está pagado."""
    return [t for t in tickets if t["estado"] != "pagado"]


def racha(eventos, hoy) -> dict:
    """Pagos a tiempo en la semana (lunes a domingo) que contiene `hoy`."""
    lunes = hoy - timedelta(days=hoy.weekday())
    fechas = [e["fecha"] for e in eventos
              if e["tipo"] in ("pago_servicio", "repago_ticket") and e.get("a_tiempo") is True
              and lunes <= e["fecha"] <= hoy]
    semana = [lunes + timedelta(days=i) for i in range(7)]
    return {"pagos": min(len(fechas), C.META_RACHA), "meta": C.META_RACHA,
            "quedan_dias": 6 - hoy.weekday(), "multiplicador": len(fechas) >= C.META_RACHA,
            "dias": [{"fecha": d.isoformat(), "pago": d in fechas} for d in semana]}


# --- Prestar ---------------------------------------------------------------------------

def prestar_para(habilitado, nivel, tickets, modo_recuperacion, condiciones=None) -> dict:
    """Cupo de hoy. `condiciones` reemplaza las del nivel (la regla actual usa C.REGLA_ACTUAL)."""
    if not habilitado:
        return {"tickets": 0, "plazo_dias": None, "monto_max": 0.0, "servicios": [], "motivo": "no_habilitado"}
    cond = condiciones or C.NIVELES[nivel]
    prestar = {"tickets": max(0, cond["tickets"] - len(en_uso(tickets))), "plazo_dias": cond["plazo_dias"],
               "monto_max": cond["monto_max"], "servicios": list(cond["servicios"]), "motivo": None}
    if modo_recuperacion:
        prestar.update(tickets=0, motivo="modo_recuperacion")
    elif any(t["estado"] in ESTADOS_VENCIDOS for t in tickets):
        prestar.update(tickets=0, motivo="deuda_vencida")
    return prestar


def _prestar(perfil, tickets) -> dict:
    return prestar_para(perfil["habilitado"], perfil["nivel"], tickets,
                        perfil["usuario"].get("modo_recuperacion"))


def validar_solicitud(prestar, servicio, monto, saldo_wallet) -> dict:
    """¿Se aprueba un pago con Credirecto? → {"resultado", "motivo", "credito", "saldo"}."""
    def rechazo(motivo):
        return {"resultado": "rechazada", "motivo": motivo, "credito": 0.0, "saldo": 0.0}

    if prestar["motivo"]:
        return rechazo(prestar["motivo"])
    if servicio not in prestar["servicios"]:
        return rechazo("servicio_no_cubierto")
    if prestar["tickets"] <= 0:
        return rechazo("maximo_en_uso")
    cubre = cubrir_monto(monto, prestar["monto_max"])
    if cubre["saldo"] > saldo_wallet + 1e-9:
        return rechazo("saldo_insuficiente")
    return {"resultado": "parcial" if cubre["saldo"] > 0 else "aprobada", "motivo": None, **cubre}


# --- Comunicar -------------------------------------------------------------------------

def _mensaje(tipo, usuario, hoy, **valores) -> dict:
    plantilla = C.MENSAJES[tipo]
    canal = usuario.get("canal_preferido", "push") if plantilla["canal"] == "preferido" else plantilla["canal"]
    return {"tipo": tipo, "nombre": plantilla["nombre"], "mensaje": plantilla["mensaje"].format(**valores),
            "canal": canal, "fecha": hoy.isoformat(), "oferta_quincena": None}


def _comunicar(perfil, tickets, eventos, hoy):
    """Un solo mensaje por día: el de mayor prioridad que aplique, o None."""
    usuario = perfil["usuario"]
    if not perfil["habilitado"]:
        return None
    vivos = [t for t in tickets if t["estado"] not in ("pagado", "disputa")]
    atrasos = {t["id"]: dias_atraso(t, hoy) for t in vivos if t["estado"] not in ESTADOS_PROTEGIDOS}

    if any(d == C.MORA_DIA for d in atrasos.values()):
        return _mensaje("aviso_mora", usuario, hoy)
    for t in vivos:
        if atrasos.get(t["id"]) == C.GRACIA_DIAS + 1:
            return _mensaje("comision", usuario, hoy, monto=f"${t['comision']:.2f}".replace(".", ","))
    if any(d == 1 for d in atrasos.values()):
        return _mensaje("gracia", usuario, hoy, dias=C.GRACIA_DIAS)

    por_vencer = sorted((t for t in vivos if t["estado"] in ("abierto", "pausa_tecnica")),
                        key=lambda t: t["fecha_vencimiento"])
    for t in por_vencer:
        if (t["fecha_vencimiento"] - hoy).days == C.DIAS_RECORDATORIO:
            m = _mensaje("recordatorio", usuario, hoy)
            oferta = oferta_quincena(t, perfil["nivel"], perfil["quincena"])
            m["oferta_quincena"] = oferta.isoformat() if oferta else None
            return m
    for t in por_vencer:
        oferta = oferta_quincena(t, perfil["nivel"], perfil["quincena"])
        if t["fecha_uso"] == hoy and oferta:
            m = _mensaje("mover_quincena", usuario, hoy, fecha=t["fecha_vencimiento"].strftime("%d/%m"),
                         dia=oferta.day)
            m["oferta_quincena"] = oferta.isoformat()
            return m

    # Solo el día en que salda una cuota y queda a un repago de subir (no todos los días)
    pago_hoy = any(t["estado"] == "pagado" and t["fecha_pago"] == hoy for t in tickets)
    if pago_hoy and not usuario.get("modo_recuperacion") and perfil["nivel"] < 3:
        historial = {"eventos": eventos, "tickets": tickets}
        con_uno_mas = evaluar_nivel(perfil["trust_score"], historial, usuario, hoy,
                                    perfil.get("nivel_anterior"), repagos_extra=1)
        if con_uno_mas["nivel"] > perfil["nivel"]:
            return _mensaje("falta_poco", usuario, hoy)
    return None


# --- Premiar ---------------------------------------------------------------------------

def premios_por_pago(ticket, nivel, racha_despues) -> list:
    """Premios de saldar una cuota. Solo se premia lo que reduce el riesgo, nunca el uso."""
    premios = []
    if ticket["fecha_pago"] <= ticket["fecha_vencimiento"]:
        premios.append({"tipo": "racha", "detalle": "+1 racha"})
    anticipado = es_anticipado(ticket)
    if anticipado:
        premios.append({"tipo": "multiplicador", "detalle": "puntos ×1,5"})
    if ticket["fecha_pago"] <= ticket["fecha_vencimiento"]:
        factor = C.MULTIPLICADOR_PUNTOS if anticipado or racha_despues["multiplicador"] else 1
        premios.append({"tipo": "puntos", "puntos": int(C.PUNTOS_POR_PAGO * factor)})
    if ticket["descuento"] > 0:
        premios.append({"tipo": "descuento_nivel", "monto": ticket["descuento"],
                        "detalle": f"−{int(C.DESCUENTO_NIVEL[nivel] * 100)} % gasto administrativo"})
    return premios


def _premiar(perfil, tickets, eventos, hoy) -> list:
    premios = []
    pagados_hoy = [t for t in tickets if t["estado"] == "pagado" and t["fecha_pago"] == hoy]
    if pagados_hoy and perfil["habilitado"]:
        premios += premios_por_pago(pagados_hoy[-1], perfil["nivel"], racha(eventos, hoy))
    anterior = perfil.get("nivel_anterior")
    if perfil["nivel"] is not None and anterior is not None and perfil["nivel"] > anterior:
        premios.append({"tipo": "subida_nivel", "nuevo_nivel": perfil["nivel"]})
    return premios


def decidir(perfil, tickets, eventos, hoy) -> dict:
    """`perfil` trae el resultado del motor más `usuario` (dict) y `nivel_anterior` (int o None)."""
    return {
        "prestar": _prestar(perfil, tickets),
        "comunicar": _comunicar(perfil, tickets, eventos, hoy),
        "premiar": _premiar(perfil, tickets, eventos, hoy),
    }
