"""Reglas diarias de gracia, comisión y mora; pagos y recargas; simulación de días.

Las funciones de reglas (`procesar_usuario`, `aplicar_pago`, `aplicar_recarga`, `resolver_estado`,
`pausar_por_fallo_tecnico`) son puras y se prueban sin base de datos.
`simular` y `recalcular_usuario` leen y escriben la base.
"""
from collections import Counter
from datetime import timedelta

from sqlalchemy import select

from app import config as C
from app import db, reloj
from app.motor.cobros import comision_por_desfase, deuda, descuento_si_paga, estado_por_atraso, nuevo_ticket
from app.motor.decisiones import descontar_cupo, validar_solicitud
from app.motor.perfil import evaluar_usuario
from app.motor.score import ESTADOS_IMPAGOS, ESTADOS_VENCIDOS, vence_original


def _evento(user_id, hoy, tipo, monto, ticket=None, a_tiempo=None, servicio=None) -> dict:
    return {"user_id": user_id, "fecha": hoy, "tipo": tipo, "servicio": ticket["servicio"] if ticket else servicio,
            "monto": round(monto, 2), "ticket_id": ticket["id"] if ticket else None, "a_tiempo": a_tiempo}


def resolver_estado(usuario, tickets) -> dict:
    """Modo recuperación mientras haya un ticket en mora; sale al saldarlo."""
    return {**usuario, "modo_recuperacion": any(t["estado"] == "mora" for t in tickets)}


def aplicar_pago(ticket, monto, hoy, nivel, sin_gasto=False):
    """Pago del usuario a un ticket → (ticket, evento repago_ticket, monto aplicado).

    Si con este pago salda la cuota antes del vencimiento, se aplica el descuento de su nivel.
    `sin_gasto` (beneficio del Club "1 cuota al mes sin gasto administrativo"): si paga a tiempo,
    el descuento es todo el gasto administrativo.
    Nunca se devuelve efectivo: si paga de más, solo se aplica lo que debe.
    """
    t = dict(ticket)
    descuento = descuento_si_paga(t, hoy, nivel)
    if sin_gasto and hoy <= vence_original(t):
        descuento = t["gasto_admin"]
    debe_con_descuento = round(deuda(t) - descuento, 2)
    aplicado = round(min(monto, debe_con_descuento), 2)
    t["monto_pagado"] = round(t["monto_pagado"] + aplicado, 2)
    if aplicado >= debe_con_descuento:
        t.update(descuento=descuento, estado="pagado", fecha_pago=hoy)
    evento = _evento(t["user_id"], hoy, "repago_ticket", aplicado, t, a_tiempo=hoy <= t["fecha_vencimiento"])
    return t, evento, aplicado


def aplicar_recarga(usuario, tickets, monto, hoy, nivel) -> dict:
    """Cada recarga paga primero la deuda vencida (la más vieja primero); lo que sobra va a la wallet."""
    usuario = dict(usuario)
    tickets = [dict(t) for t in tickets]
    eventos = [_evento(usuario["id"], hoy, "recarga", monto)]
    resto = round(monto, 2)
    aplicado_total = 0.0
    for i in sorted((i for i, t in enumerate(tickets) if t["estado"] in ESTADOS_VENCIDOS),
                    key=lambda i: tickets[i]["fecha_vencimiento"]):
        if resto <= 0:
            break
        tickets[i], evento, aplicado = aplicar_pago(tickets[i], resto, hoy, nivel)
        eventos.append(evento)
        resto = round(resto - aplicado, 2)
        aplicado_total = round(aplicado_total + aplicado, 2)
    usuario["saldo_wallet"] = round(usuario["saldo_wallet"] + resto, 4)
    usuario = resolver_estado(usuario, tickets)
    return {"usuario": usuario, "tickets": tickets, "eventos": eventos,
            "aplicado_a_deuda": aplicado_total, "a_wallet": resto}


def procesar_usuario(usuario, tickets, hoy) -> dict:
    """Reglas de un día: gracia, comisión (una vez, al terminar la gracia) y mora con débito de wallet.

    No modifica la entrada. Devuelve {"usuario", "tickets", "eventos" (nuevos), "cambios"}.
    """
    usuario = dict(usuario)
    tickets = [dict(t) for t in tickets]
    eventos, cambios = [], []

    def anotar(tipo, ticket=None, **extra):
        cambios.append({"fecha": hoy.isoformat(), "user_id": usuario["id"], "tipo": tipo,
                        "ticket_id": ticket["id"] if ticket else None, **extra})

    for t in tickets:
        if t["estado"] not in ESTADOS_IMPAGOS:   # pagado, disputa y pausa_tecnica no se tocan
            continue
        dias = (hoy - t["fecha_vencimiento"]).days
        nuevo = estado_por_atraso(dias)
        if nuevo in ("atrasado", "mora") and t["comision"] == 0:
            t["comision"] = comision_por_desfase(t)
            eventos.append(_evento(usuario["id"], hoy, "comision", t["comision"], t))
            anotar("comision", t, monto=t["comision"])
        if nuevo != t["estado"]:
            t["estado"] = nuevo
            if nuevo in ("gracia", "mora"):
                anotar(nuevo, t, dias_atraso=dias)

        if nuevo == "mora" and usuario["saldo_wallet"] > 0:
            debito = round(min(usuario["saldo_wallet"], deuda(t)), 2)
            if debito > 0:
                usuario["saldo_wallet"] = round(usuario["saldo_wallet"] - debito, 4)
                t["monto_pagado"] = round(t["monto_pagado"] + debito, 2)
                saldado = deuda(t) <= 0
                if saldado:
                    t["estado"], t["fecha_pago"] = "pagado", hoy
                eventos.append(_evento(usuario["id"], hoy, "debito_wallet", debito, t,
                                       a_tiempo=False if saldado else None))
                anotar("debito_wallet", t, monto=debito, saldado=saldado, deuda_restante=deuda(t))

    antes = usuario["modo_recuperacion"]
    usuario = resolver_estado(usuario, tickets)
    if usuario["modo_recuperacion"] and not antes:
        anotar("congelado")
    elif antes and not usuario["modo_recuperacion"]:
        anotar("descongelado")
    return {"usuario": usuario, "tickets": tickets, "eventos": eventos, "cambios": cambios}


def pausar_por_fallo_tecnico(ticket) -> dict:
    """Un pago que falló por culpa del sistema: el ticket entra en pausa y su vencimiento se corre."""
    return {**ticket, "estado": "pausa_tecnica",
            "fecha_vencimiento": ticket["fecha_vencimiento"] + timedelta(days=C.EXTENSION_FALLO_TECNICO_DIAS)}


# --- Con base de datos ---------------------------------------------------------------

def recalcular_usuario(conn, user_id, hoy):
    """Recalcula estado, perfil y decisiones de un usuario y los guarda. Devuelve (perfil, decision)."""
    usuario = db.cargar_usuarios(conn, user_id)[user_id]
    eventos = db.cargar_eventos(conn, user_id).get(user_id, [])
    tickets = db.cargar_tickets(conn, user_id).get(user_id, [])
    niveles, scores = db.contexto_anterior(conn, hoy, user_id)
    actualizado = resolver_estado(usuario, tickets)
    perfil, decision = evaluar_usuario(actualizado, eventos, tickets, hoy, niveles.get(user_id), scores.get(user_id))
    actualizado["habilitado_desde"] = perfil["habilitado_desde"]
    if actualizado != usuario:
        db.actualizar_usuarios(conn, [actualizado])
    db.guardar_resultados(conn, [(perfil, decision)], hoy)
    return perfil, decision


def recalcular_todos(conn, hoy) -> None:
    """Recalcula y guarda el perfil y las decisiones de hoy para todos (tras cambiar la configuración)."""
    usuarios = db.cargar_usuarios(conn)
    eventos = db.cargar_eventos(conn)
    tickets = db.cargar_tickets(conn)
    niveles, scores = db.contexto_anterior(conn, hoy)
    resultados, habilitados = [], []
    for uid, u in usuarios.items():
        perfil, decision = evaluar_usuario(u, eventos.get(uid, []), tickets.get(uid, []), hoy,
                                           niveles.get(uid), scores.get(uid))
        resultados.append((perfil, decision))
        if perfil["habilitado_desde"] != u["habilitado_desde"]:
            habilitados.append({**u, "habilitado_desde": perfil["habilitado_desde"]})
    db.actualizar_usuarios(conn, habilitados)
    db.guardar_resultados(conn, resultados, hoy)


def simular(conn, dias: int = 1, comportamiento=None) -> dict:
    """Avanza el reloj día por día. Cada día, en orden:
    1. (si hay `comportamiento`) los usuarios sintéticos hacen su actividad, piden tickets y pagan;
    2. corre el worker de gracia, comisión y mora;
    3. se recalcula el perfil y las decisiones de todos.
    """
    desde = reloj.leer(conn)
    usuarios = db.cargar_usuarios(conn)
    eventos = db.cargar_eventos(conn)
    tickets = db.cargar_tickets(conn)
    niveles, scores_hace_7 = db.contexto_anterior(conn, desde + timedelta(days=1))
    scores = {}
    prestar = {d.user_id: d.prestar for d in conn.execute(
        select(db.decisiones.c.user_id, db.decisiones.c.prestar).where(db.decisiones.c.fecha == desde))}
    proximo_id = db.siguiente_id(conn, db.tickets)

    originales = {t["id"]: dict(t) for lista in tickets.values() for t in lista}
    usuarios_originales = {u: dict(v) for u, v in usuarios.items()}
    eventos_nuevos, tickets_nuevos, solicitudes, cambios, cambios_nivel, notas = [], [], [], [], [], []

    hoy = desde
    for _ in range(dias):
        hoy += timedelta(days=1)
        resultados, del_dia = [], Counter()
        for uid in usuarios:
            u, propios, nuevos = usuarios[uid], list(tickets.get(uid, [])), []

            if comportamiento:
                nuevos += comportamiento.actividad(u, hoy)
                intento = comportamiento.intencion(u, hoy)
                if intento and uid in prestar and prestar[uid]["motivo"] not in C.MOTIVOS_SIN_SOLICITUD:
                    validacion = validar_solicitud(prestar[uid], intento["servicio"], intento["monto"],
                                                   u["saldo_wallet"])
                    del_dia["solicitudes"] += 1
                    ticket_id = None
                    if validacion["resultado"] != "rechazada":
                        t = nuevo_ticket(proximo_id, uid, intento["servicio"], intento["comercio"],
                                         validacion["credito"], hoy)
                        proximo_id += 1
                        comportamiento.planificar(u, t, niveles.get(uid), hoy)
                        propios.append(t)
                        tickets_nuevos.append(t)
                        ticket_id = t["id"]
                        nuevos.append(_evento(uid, hoy, "uso_ticket", t["monto"], t))
                        descontar_cupo(prestar[uid], intento["servicio"])
                        del_dia["tickets"] += 1
                    solicitudes.append({"user_id": uid, "fecha": hoy, "servicio": intento["servicio"],
                                        "monto": intento["monto"], "resultado": validacion["resultado"],
                                        "motivo": validacion["motivo"], "ticket_id": ticket_id})
                for i, t in enumerate(propios):
                    if t.get("pago_planeado") == hoy and t["estado"] != "pagado":
                        propios[i], evento, aplicado = aplicar_pago(t, deuda(t), hoy, niveles.get(uid))
                        nuevos.append(evento)
                        del_dia["pagos"] += 1
                        cambios.append({"fecha": hoy.isoformat(), "user_id": uid, "tipo": "pago",
                                        "ticket_id": t["id"], "monto": aplicado, "a_tiempo": evento["a_tiempo"]})

            r = procesar_usuario(u, propios, hoy)
            usuarios[uid], tickets[uid] = r["usuario"], r["tickets"]
            nuevos += r["eventos"]
            cambios += r["cambios"]
            for c in r["cambios"]:
                del_dia[c["tipo"]] += 1
            if nuevos:
                eventos.setdefault(uid, []).extend(nuevos)
                eventos_nuevos += nuevos

            perfil, decision = evaluar_usuario(usuarios[uid], eventos.get(uid, []), tickets[uid], hoy,
                                               niveles.get(uid), scores_hace_7.get(uid))
            if perfil["habilitado"] and not usuarios[uid].get("habilitado_desde"):
                usuarios[uid]["habilitado_desde"] = hoy
                del_dia["habilitados"] += 1
                cambios.append({"fecha": hoy.isoformat(), "user_id": uid, "tipo": "habilitado"})
            anterior = niveles.get(uid)
            if anterior is not None and perfil["nivel"] is not None and perfil["nivel"] != anterior:
                cambios_nivel.append({"fecha": hoy.isoformat(), "user_id": uid, "de": anterior, "a": perfil["nivel"]})
                del_dia["subieron_nivel" if perfil["nivel"] > anterior else "bajaron_nivel"] += 1
            niveles[uid] = perfil["nivel"]
            scores[uid] = perfil["trust_score"]
            prestar[uid] = decision["prestar"]
            resultados.append((perfil, decision))
        db.guardar_resultados(conn, resultados, hoy)
        # Para el score "de hace 7 días" del día siguiente
        _, scores_hace_7 = db.contexto_anterior(conn, hoy + timedelta(days=1))

        mensaje = (f"Comisiones aplicadas: {del_dia['comision']} · tickets congelados: {del_dia['congelado']} · "
                   f"{len(resultados)} scores recalculados ({del_dia['subieron_nivel']} suben de nivel) · "
                   f"usuarios habilitados: {del_dia['habilitados']}")
        db.anotar_bitacora(conn, hoy, mensaje)
        notas.append({"fecha": hoy.isoformat(), "mensaje": mensaje, "totales": del_dia})

    db.insertar_tickets(conn, tickets_nuevos)
    nuevos_ids = {t["id"] for t in tickets_nuevos}
    db.actualizar_tickets(conn, [t for lista in tickets.values() for t in lista
                                 if t["id"] not in nuevos_ids and t != originales.get(t["id"])])
    db.insertar_eventos(conn, eventos_nuevos)
    db.insertar_solicitudes(conn, solicitudes)
    db.actualizar_usuarios(conn, [u for uid, u in usuarios.items() if u != usuarios_originales[uid]])
    reloj.fijar(conn, hoy)

    totales = Counter()
    for n in notas:
        totales.update(n["totales"])
    claves = ["solicitudes", "tickets", "pagos", "comision", "mora", "congelado", "habilitados",
              "subieron_nivel", "bajaron_nivel"]
    nombres = {"comision": "comisiones", "mora": "nuevas_moras", "congelado": "congelados"}
    return {
        "desde": desde.isoformat(),
        "hoy": hoy.isoformat(),
        "dias": dias,
        "totales": {nombres.get(k, k): totales.get(k, 0) for k in claves},
        "bitacora": [{"fecha": n["fecha"], "mensaje": n["mensaje"]} for n in reversed(notas)],
        "cambios": cambios,
        "cambios_nivel": cambios_nivel,
    }
