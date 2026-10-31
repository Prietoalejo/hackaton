"""Reglas sueltas del motor que no son casos borde."""
from datetime import date, timedelta

from app import config as C
from app.motor.cobros import oferta_quincena
from app.motor.decisiones import decidir, racha
from app.motor.niveles import nivel_por_score
from app.motor.perfil import evaluar_usuario
from app.motor.quincena import calcular_quincena, fecha_de_quincena
from app.motor.score import calcular_score
from app.worker.mora import aplicar_pago
from tests.fabrica import HOY, evento, facturas, hace, historial_puntual, ticket, ticket_pagado, usuario


def test_razones_con_maximos_y_score_redondeado():
    tickets, eventos = historial_puntual()
    eventos.append(evento(hace(3), "rechazo_fondos"))
    s = calcular_score(eventos, tickets, usuario(), HOY)
    assert [r["senal"] for r in s["razones"]] == ["puntualidad", "constancia", "antiguedad", "anticipados",
                                                   "verificacion", "friccion"]
    assert {r["senal"]: r["max"] for r in s["razones"]}["friccion"] == C.FRICCION_MAX
    assert abs(s["trust_score"] - sum(r["aporte"] for r in s["razones"])) <= 1


def test_margen_para_bajar():
    assert nivel_por_score(62) == 2
    assert nivel_por_score(57, nivel_anterior=2) == 2      # 3 bajo el umbral: conserva
    assert nivel_por_score(54, nivel_anterior=2) == 1      # 6 bajo el umbral: baja
    assert nivel_por_score(30, nivel_anterior=3) == 0
    assert nivel_por_score(81, nivel_anterior=1) == 3      # subir no tiene margen


def test_quincena():
    eventos = [evento(date(2026, m, d), "recarga") for m in (8, 9, 10) for d in (15, 31 if m != 9 else 30)]
    assert calcular_quincena(eventos, HOY) == [15, 30]
    assert calcular_quincena(eventos[:3], HOY) == C.QUINCENA_DEFECTO
    assert fecha_de_quincena(2026, 2, 30) == date(2026, 2, 28)


def test_oferta_quincena_respeta_el_plazo_del_nivel():
    t = ticket(HOY)                                       # vence el 7 nov
    assert oferta_quincena(t, 2, [15, 30]) == date(2026, 11, 15)   # Confiable: hasta 15 días
    assert oferta_quincena(t, 0, [15, 30]) is None                 # Inicial: 7 días
    assert oferta_quincena(t, 3, [1, 15]) == date(2026, 11, 15)


def test_descuento_por_nivel_si_paga_antes():
    t = ticket(hace(3), monto=10.0)                       # vence en 4 días
    pagado, evento_pago, aplicado = aplicar_pago(t, 100, HOY, nivel=2)
    assert pagado["estado"] == "pagado" and pagado["descuento"] == round(t["gasto_admin"] * 0.25, 2)
    assert aplicado == round(10.0 + t["gasto_admin"] - pagado["descuento"], 2)
    assert evento_pago["a_tiempo"] is True
    sin, _, _ = aplicar_pago(t, 100, t["fecha_vencimiento"], nivel=2)   # el día de cobro ya no hay descuento
    assert sin["descuento"] == 0


def test_racha_semanal():
    lunes = HOY - timedelta(days=HOY.weekday())
    eventos = [evento(lunes, "pago_servicio", "luz", a_tiempo=True),
               evento(lunes + timedelta(days=1), "repago_ticket", a_tiempo=True),
               evento(lunes - timedelta(days=1), "repago_ticket", a_tiempo=True)]
    r = racha(eventos, HOY)
    assert {k: r[k] for k in ("pagos", "meta", "quedan_dias", "multiplicador")} == \
        {"pagos": 2, "meta": 3, "quedan_dias": 6 - HOY.weekday(), "multiplicador": False}
    assert [d["pago"] for d in r["dias"]] == [True, True, False, False, False, False, False]


def _contexto(u, tickets, eventos, hoy, nivel_anterior=None):
    perfil, _ = evaluar_usuario(u, eventos, tickets, hoy, nivel_anterior)
    return {**perfil, "usuario": u, "nivel_anterior": nivel_anterior}


def test_comunicar_prioridades():
    u = usuario()
    tickets, eventos = historial_puntual()
    abierto = ticket(hace(5))                             # vence en 2 días
    d = decidir(_contexto(u, tickets + [abierto], eventos, HOY), tickets + [abierto], eventos, HOY)
    assert d["comunicar"]["tipo"] == "recordatorio" and d["comunicar"]["canal"] == "push"

    vencido = ticket(hace(8), estado="gracia")            # venció ayer
    d = decidir(_contexto(u, tickets + [vencido], eventos, HOY), tickets + [vencido], eventos, HOY)
    assert d["comunicar"]["tipo"] == "gracia"

    wisi = usuario(canal_preferido="wisi")
    hoy_uso = ticket(HOY)
    ctx = _contexto(wisi, tickets + [hoy_uso], eventos, HOY)
    if oferta_quincena(hoy_uso, ctx["nivel"], ctx["quincena"]):
        d = decidir(ctx, tickets + [hoy_uso], eventos, HOY)
        assert d["comunicar"]["tipo"] == "mover_quincena" and d["comunicar"]["canal"] == "wisi"


def test_premiar_pago_anticipado():
    u = usuario()
    tickets, eventos = historial_puntual()
    t, ev = ticket_pagado(hace(4), dias_vs_vencimiento=-3)    # pagado hoy, 3 días antes
    assert t["fecha_pago"] == HOY
    ctx = _contexto(u, tickets + [t], eventos + ev, HOY, nivel_anterior=1)
    tipos = [p["tipo"] for p in decidir(ctx, tickets + [t], eventos + ev, HOY)["premiar"]]
    assert tipos[:3] == ["racha", "multiplicador", "puntos"]

    ctx = _contexto(u, tickets, eventos, HOY, nivel_anterior=ctx["nivel"])
    assert decidir(ctx, tickets, eventos, HOY)["premiar"] == []    # usar no se premia


def test_segmento_en_riesgo_por_pago_con_comision():
    u = usuario()
    tickets, eventos = historial_puntual()
    t, ev = ticket_pagado(hace(20), dias_vs_vencimiento=C.GRACIA_DIAS + 1)
    perfil, _ = evaluar_usuario(u, eventos + ev, tickets + [t], HOY)
    assert perfil["segmento"] == C.SEG_EN_RIESGO
    t, ev = ticket_pagado(hace(20), dias_vs_vencimiento=C.GRACIA_DIAS)   # dentro de la gracia: no
    perfil, _ = evaluar_usuario(u, eventos + ev, tickets + [t], HOY)
    assert perfil["segmento"] != C.SEG_EN_RIESGO


def test_configuracion_editable():
    tickets, eventos = historial_puntual()
    normal, _ = evaluar_usuario(usuario(), eventos, tickets, HOY)
    with C.con_valores({"umbral_basico": 0, "umbral_confiable": 0, "umbral_premium": 0, "repagos_premium": 0}):
        todo_premium, _ = evaluar_usuario(usuario(), eventos, tickets, HOY)
        assert todo_premium["nivel"] == 3
    assert evaluar_usuario(usuario(), eventos, tickets, HOY)[0]["nivel"] == normal["nivel"]
    with C.con_valores({"req_vehiculo": True}):
        assert not evaluar_usuario(usuario(vehiculo_verificado=False), facturas(), [], HOY)[0]["habilitado"]
