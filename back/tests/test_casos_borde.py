"""Un test por caso borde, con las reglas de la guía del front (gracia, comisión, modo recuperación)."""
import random
from datetime import timedelta

from app import config as C
from app.motor.cobros import comision_por_desfase, cuota, deuda
from app.motor.decisiones import prestar_para, validar_solicitud
from app.motor.perfil import evaluar_usuario
from app.motor.score import calcular_score
from app.worker.mora import aplicar_recarga, pausar_por_fallo_tecnico, procesar_usuario
from tests.fabrica import HOY, evento, facturas, hace, historial_puntual, ticket, ticket_pagado, usuario


def test_1_arranque_en_frio():
    # Cumple los requisitos pero no tiene historial con Credirecto: Inicial, 1 ticket
    u = usuario(fecha_registro=hace(90), habilitado_desde=None)
    perfil, decision = evaluar_usuario(u, facturas(2, desde_hace=60), [], HOY)
    assert perfil["habilitado"] and perfil["nivel"] == 0
    assert decision["prestar"]["tickets"] == C.NIVELES[0]["tickets"] == 1

    # Le falta un pago de servicio a tiempo: en espera, con su checklist
    perfil, decision = evaluar_usuario(u, facturas(1, desde_hace=60), [], HOY)
    assert not perfil["habilitado"] and perfil["nivel"] is None
    assert perfil["segmento"] == C.SEG_SIN_CREDITO
    assert decision["prestar"] == {"tickets": 0, "servicios_cupo": 0, "plazo_dias": None, "monto_max": 0.0,
                                   "servicios": [], "motivo": "no_habilitado"}
    pagos = next(c for c in perfil["checklist"] if c["requisito"] == "pagos")
    assert not pagos["ok"] and pagos["detalle"] == "1 de 2"


def test_2_usa_dos_tickets_y_desaparece():
    vence = HOY
    u = usuario(saldo_wallet=5.0)
    tickets = [ticket(vence - timedelta(days=7), monto=3.0), ticket(vence - timedelta(days=7), monto=4.0)]

    # Días 1 y 2: gracia, sin comisión ni congelamiento
    for dia in (1, 2):
        r = procesar_usuario(u, tickets, vence + timedelta(days=dia))
        u, tickets = r["usuario"], r["tickets"]
        assert [t["estado"] for t in tickets] == ["gracia", "gracia"]
        assert r["eventos"] == [] and not u["modo_recuperacion"]

    # Día 3: comisión por desfase (5 % de la cuota, mínimo $0,25), una sola vez
    r = procesar_usuario(u, tickets, vence + timedelta(days=3))
    u, tickets = r["usuario"], r["tickets"]
    assert [t["estado"] for t in tickets] == ["atrasado", "atrasado"]
    assert [e["tipo"] for e in r["eventos"]] == ["comision", "comision"]
    assert [t["comision"] for t in tickets] == [C.COMISION_MIN, C.COMISION_MIN]
    assert procesar_usuario(u, tickets, vence + timedelta(days=4))["eventos"] == []

    # Día 8: mora, modo recuperación y débito de la wallet
    hoy = vence + timedelta(days=C.MORA_DIA)
    r = procesar_usuario(u, tickets, hoy)
    u, tickets = r["usuario"], r["tickets"]
    assert u["modo_recuperacion"] is True
    assert [e["tipo"] for e in r["eventos"]] == ["debito_wallet", "debito_wallet"]
    assert tickets[0]["estado"] == "pagado"        # 3,30 + 0,25 cubiertos por la wallet
    assert tickets[1]["estado"] == "mora"
    assert u["saldo_wallet"] == 0
    perfil, decision = evaluar_usuario(u, facturas(), tickets, hoy)
    assert decision["prestar"]["tickets"] == 0 and decision["prestar"]["motivo"] == "modo_recuperacion"
    assert perfil["segmento"] == C.SEG_EN_RIESGO


def test_3_un_atraso_leve_en_usuario_puntual():
    u = usuario()
    tickets, eventos = historial_puntual()
    antes, _ = evaluar_usuario(u, eventos, tickets, HOY)

    t, ev = ticket_pagado(hace(12), dias_vs_vencimiento=1)   # pagó en el día 1 de gracia
    despues, _ = evaluar_usuario(u, eventos + ev, tickets + [t], HOY, nivel_anterior=antes["nivel"])
    assert despues["trust_score"] < antes["trust_score"]
    assert despues["nivel"] == antes["nivel"]


def test_4_moroso_que_se_pone_al_dia():
    tickets, eventos = historial_puntual(n_tickets=6)
    moroso = ticket(hace(20), estado="mora", monto=4.0)
    moroso["comision"] = comision_por_desfase(moroso)
    u = usuario(modo_recuperacion=True, saldo_wallet=0.0)
    antes, _ = evaluar_usuario(u, eventos, tickets + [moroso], HOY)
    assert antes["nivel"] is not None

    # Recarga más de lo que debe: primero paga la deuda, el resto va a la wallet
    r = aplicar_recarga(u, tickets + [moroso], 10.0, HOY, antes["nivel"])
    debe = cuota(moroso) + moroso["comision"]
    assert r["aplicado_a_deuda"] == round(debe, 2)
    assert r["a_wallet"] == round(10.0 - debe, 2)
    assert r["usuario"]["modo_recuperacion"] is False
    assert r["tickets"][-1]["estado"] == "pagado"

    # Recupera su crédito: vuelve a tener tickets de su nivel
    perfil, decision = evaluar_usuario(r["usuario"], eventos + r["eventos"], r["tickets"], HOY, antes["nivel"])
    assert decision["prestar"]["motivo"] is None
    assert decision["prestar"]["tickets"] == C.NIVELES[perfil["nivel"]]["tickets"]


def test_5_ticket_mayor_al_limite():
    prestar = {"tickets": 2, "plazo_dias": 15, "monto_max": 10.0, "servicios": ["estacionamiento"], "motivo": None}
    v = validar_solicitud(prestar, "estacionamiento", 13.0, saldo_wallet=5.0)
    assert v == {"resultado": "parcial", "motivo": None, "credito": 10.0, "saldo": 3.0}
    assert validar_solicitud(prestar, "estacionamiento", 13.0, saldo_wallet=1.0)["motivo"] == "saldo_insuficiente"
    assert validar_solicitud(prestar, "estacionamiento", 4.0, saldo_wallet=0)["resultado"] == "aprobada"
    assert validar_solicitud(prestar, "seguro", 4.0, saldo_wallet=0)["motivo"] == "servicio_no_cubierto"
    assert validar_solicitud({**prestar, "tickets": 0}, "estacionamiento", 4.0, 0)["motivo"] == "maximo_en_uso"


def test_5b_tickets_y_pagos_de_servicios_son_cupos_distintos():
    # Confiable: 3 tickets (movilidad) + 1 pago de servicios (facturas); nunca un cupo en dinero
    assert (C.NIVELES[2]["tickets"], C.NIVELES[2]["servicios_cupo"]) == (3, 1)
    assert (C.NIVELES[3]["tickets"], C.NIVELES[3]["servicios_cupo"]) == (5, 3)
    assert C.NIVELES[0]["servicios_cupo"] == C.NIVELES[1]["servicios_cupo"] == 0
    prestar = prestar_para(True, 2, [ticket(hace(2), servicio="luz")], False)
    assert prestar["tickets"] == 3 and prestar["servicios_cupo"] == 0
    assert validar_solicitud(prestar, "internet", 4.0, 0)["motivo"] == "servicios_en_uso"
    assert validar_solicitud(prestar, "estacionamiento", 4.0, 0)["resultado"] == "aprobada"
    prestar = prestar_para(True, 2, [ticket(hace(2)) for _ in range(3)], False)
    assert prestar["tickets"] == 0 and prestar["servicios_cupo"] == 1
    assert validar_solicitud(prestar, "estacionamiento", 4.0, 0)["motivo"] == "maximo_en_uso"
    assert validar_solicitud(prestar, "luz", 4.0, 0)["resultado"] == "aprobada"


def test_6_fallo_tecnico():
    u = usuario()
    tickets, eventos = historial_puntual()
    t = ticket(hace(7))                     # vence hoy
    pausado = pausar_por_fallo_tecnico(t)
    assert pausado["estado"] == "pausa_tecnica"
    assert pausado["fecha_vencimiento"] == t["fecha_vencimiento"] + timedelta(days=C.EXTENSION_FALLO_TECNICO_DIAS)
    for dia in range(1, 12):
        r = procesar_usuario(u, tickets + [pausado], HOY + timedelta(days=dia))
        assert r["eventos"] == [] and r["usuario"]["modo_recuperacion"] is False
        assert r["tickets"][-1]["estado"] == "pausa_tecnica" and r["tickets"][-1]["comision"] == 0
    futuro = HOY + timedelta(days=5)
    assert calcular_score(eventos, tickets + [pausado], u, futuro) == calcular_score(eventos, tickets, u, futuro)


def test_7_nunca_usa_el_credito():
    u = usuario()
    eventos = facturas(6) + [evento(hace(d), "recarga", None, 30) for d in range(0, 180, 15)]
    perfil, decision = evaluar_usuario(u, eventos, [], HOY)
    razones = {r["senal"]: r["aporte"] for r in perfil["razones"]}
    assert razones["friccion"] == 0
    assert razones["puntualidad"] == C.PESOS["puntualidad"]
    assert perfil["habilitado"] and perfil["segmento"] == C.SEG_ENFRIAMIENTO
    assert decision["prestar"]["tickets"] >= 1


def test_8_ticket_en_disputa():
    u = usuario()
    tickets, eventos = historial_puntual()
    disputa = ticket(hace(20), estado="disputa")     # venció hace 13 días
    r = procesar_usuario(u, tickets + [disputa], HOY)
    assert r["eventos"] == [] and r["cambios"] == []
    con, _ = evaluar_usuario(u, eventos, tickets + [disputa], HOY)
    sin, _ = evaluar_usuario(u, eventos, tickets, HOY)
    assert con["trust_score"] == sin["trust_score"]
    assert con["segmento"] != C.SEG_EN_RIESGO and con["estado_mora"] == "al_dia"


def test_9_wallet_insuficiente_en_mora():
    u = usuario(saldo_wallet=1.0)
    t = ticket(hace(7 + C.MORA_DIA), estado="atrasado", monto=4.0)
    t["comision"] = comision_por_desfase(t)
    r = procesar_usuario(u, [t], HOY)
    t2 = r["tickets"][0]
    assert t2["estado"] == "mora" and t2["monto_pagado"] == 1.0
    assert deuda(t2) == round(cuota(t) + t["comision"] - 1.0, 2)
    assert r["usuario"]["saldo_wallet"] == 0 and r["usuario"]["modo_recuperacion"] is True

    r2 = procesar_usuario(r["usuario"], r["tickets"], HOY + timedelta(days=1))
    assert r2["eventos"] == [] and r2["usuario"]["modo_recuperacion"] is True


def test_10_score_siempre_entre_0_y_100():
    peor = usuario(cedula_verificada=False, vehiculo_verificado=False, fecha_registro=HOY)
    eventos = [evento(hace(i % 89), "rechazo_fondos") for i in range(50)]
    eventos += [evento(hace(i % 89), "pago_servicio", "luz", a_tiempo=False) for i in range(50)]
    tickets = [ticket(hace(80), estado="mora") for _ in range(10)]
    # La fricción tiene piso (−10), así que la constancia de tanta actividad deja unos pocos puntos
    assert 0 <= calcular_score(eventos, tickets, peor, HOY)["trust_score"] < 10

    mejor = usuario(fecha_registro=hace(3000))
    tickets, eventos = historial_puntual(n_tickets=40, cada=2, dias_vs_vencimiento=-5)
    eventos += [evento(hace(d), "recarga") for d in range(0, 90, 3)]
    assert calcular_score(eventos, tickets, mejor, HOY)["trust_score"] == 100

    rng = random.Random(7)
    tipos = ["pago_servicio", "recarga", "rechazo_fondos", "uso_ticket", "repago_ticket"]
    estados = ["abierto", "gracia", "atrasado", "mora", "disputa", "pausa_tecnica"]
    for _ in range(300):
        u = usuario(cedula_verificada=rng.random() < .5, fecha_registro=hace(rng.randint(0, 2000)))
        evs = [evento(hace(rng.randint(-5, 400)), rng.choice(tipos), a_tiempo=rng.choice([True, False, None]))
               for _ in range(rng.randint(0, 120))]
        tks = []
        for _ in range(rng.randint(0, 15)):
            t = ticket(hace(rng.randint(0, 200)), estado=rng.choice(estados + ["pagado"]))
            if t["estado"] == "pagado":
                t["fecha_pago"] = t["fecha_uso"] + timedelta(days=rng.randint(0, 40))
            tks.append(t)
        score = calcular_score(evs, tks, u, HOY)
        assert 0 <= score["trust_score"] <= 100
        assert len(score["razones"]) == 6
