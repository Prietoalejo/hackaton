"""Reglas sueltas del motor que no son casos borde."""
from datetime import date, timedelta

from app import config as C
from app.motor.club import puntos_de_cuota
from app.motor.cobros import oferta_quincena
from app.motor.decisiones import decidir, racha
from app.motor.niveles import nivel_por_score, repagos_a_tiempo
from app.motor.perfil import evaluar_usuario
from app.motor.quincena import calcular_quincena, fecha_de_quincena
from app.motor.score import calcular_score, es_anticipado
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
    premios = decidir(ctx, tickets + [t], eventos + ev, HOY)["premiar"]
    assert [p["tipo"] for p in premios][:3] == ["racha", "multiplicador", "puntos"]
    # Los puntos son los del Club PagoDirecto (×1,5 por pagar antes), no un sistema nuevo
    puntos = next(p for p in premios if p["tipo"] == "puntos")
    assert puntos["puntos"] == int(C.PUNTOS_POR_PAGO * C.MULTIPLICADOR_PUNTOS)
    assert C.CLUB_NOMBRE in puntos["detalle"]

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
    sin_topes = {"umbral_basico": 0, "umbral_confiable": 0, "umbral_premium": 0, "repagos_premium": 0,
                 "ruta_basico": 1, "ruta_confiable": 1, "ruta_premium": 1}
    with C.con_valores(sin_topes):
        todo_premium, _ = evaluar_usuario(usuario(), eventos, tickets, HOY)
        assert todo_premium["nivel"] == 3
    assert evaluar_usuario(usuario(), eventos, tickets, HOY)[0]["nivel"] == normal["nivel"]
    with C.con_valores({"req_vehiculo": True}):
        assert not evaluar_usuario(usuario(vehiculo_verificado=False), facturas(), [], HOY)[0]["habilitado"]


def test_niveles_amarrados_a_las_rutas_del_club():
    from app.motor.club import calcular_club, nivel_credirecto_por_club
    # Rutas reales del Club PagoDirecto y la que exige cada nivel de Credirecto
    assert [r["ruta"] for r in C.RUTAS_CLUB][:4] == ["Ruta Colonial", "Ruta Falcón", "Ruta del Café", "Ruta de Paria"]
    assert [nivel_credirecto_por_club(n) for n in range(len(C.RUTAS_CLUB))] == [0, 1, 2, 3, 3, 3, 3]
    # 9 pagos = 900 pts: sigue en Turista · Ruta Colonial; 10 pagos completan la ruta (+500 de bono)
    pagos = [evento(hace(i + 1), "pago_servicio", "luz", 5.0, a_tiempo=True) for i in range(10)]
    assert calcular_club(pagos[:9], [], HOY)["texto"] == "Turista · Ruta Colonial"
    club = calcular_club(pagos, [], HOY)
    assert club["texto"] == "Caminante · Ruta Falcón" and club["puntos"] == 1500
    # Con score y repagos de Premium, el Club lo deja en el nivel de su ruta
    tickets, eventos = historial_puntual()
    with C.con_valores({"umbral_basico": 0, "umbral_confiable": 0, "umbral_premium": 0, "repagos_premium": 0}):
        perfil, _ = evaluar_usuario(usuario(), eventos, tickets, HOY)
        assert perfil["nivel"] == nivel_credirecto_por_club(perfil["club"]["nivel_club"]) < 3
        assert perfil["progreso"]["ruta_requerida"].startswith(C.RUTAS_CLUB[C.RUTA_MINIMA_POR_NIVEL[perfil["nivel"] + 1]]["nivel"])


def test_motor_de_beneficios_personaliza_la_ruta():
    from app.motor.beneficios import calcular_beneficios
    from app.motor.club import calcular_club
    tickets, eventos = historial_puntual()
    club = calcular_club(eventos, tickets, HOY)
    base = C.RUTAS_CLUB[club["nivel_club"]]["walletback_pct"]

    def walletback(**perfil):
        b = calcular_beneficios({"trust_score": 70, "segmento": C.SEG_PUNTUAL, "quincena": [], **perfil},
                                club, eventos, tickets, HOY)
        return b, b["beneficios"][0]["personal"]

    puntual, w_puntual = walletback()
    assert puntual["factor"] > 1 and w_puntual > base                      # paga a tiempo: más que la base
    riesgo, w_riesgo = walletback(segmento=C.SEG_EN_RIESGO, trust_score=30)
    assert w_riesgo < base and riesgo["factor"] >= C.VALORES["beneficio_min_pct"] / 100   # menos, con piso
    assert {r["senal"] for r in riesgo["razones"]} >= {"riesgo", "score"}
    mora, w_mora = walletback(modo_recuperacion=True)
    assert mora["pausa"] and w_mora == 0 and mora["a_tu_medida"]["tipo"] == "recuperacion"
    assert walletback(segmento=C.SEG_CONDUCTOR)[0]["a_tu_medida"]["tipo"] == "ticket_extra"
    with C.con_valores({"beneficio_max_pct": 100}):
        assert walletback()[0]["factor"] == 1.0                            # el tope es configurable


def test_mover_a_quincena_no_convierte_un_pago_tardio_en_anticipado():
    t = ticket(hace(10), monto=4.0, vence=hace(10) + timedelta(days=15))   # vencía hace 3 días; se movió +8
    pagado, _, _ = aplicar_pago(t, 100, HOY, nivel=2)
    assert pagado["estado"] == "pagado" and pagado["descuento"] == 0       # a tiempo, pero no antes
    assert not es_anticipado(pagado) and puntos_de_cuota(pagado) == C.PUNTOS_POR_PAGO
    antes = ticket(hace(2), monto=4.0, vence=hace(2) + timedelta(days=15))  # paga antes de la fecha original
    pagado, _, _ = aplicar_pago(antes, 100, HOY, nivel=2)
    assert pagado["descuento"] > 0 and es_anticipado(pagado)


def test_tickets_de_centimos_no_suman_puntos_racha_ni_repagos():
    chico, ev_chico = ticket_pagado(hace(5), dias_vs_vencimiento=-2, monto=0.01)
    normal, ev_normal = ticket_pagado(hace(5), dias_vs_vencimiento=-2, monto=C.MONTO_MIN_PREMIO)
    assert puntos_de_cuota(chico) == 0 and puntos_de_cuota(normal) > 0
    assert repagos_a_tiempo([chico]) == 0 and repagos_a_tiempo([normal]) == 1
    pago_chico = [e for e in ev_chico if e["tipo"] == "repago_ticket"]
    assert racha(pago_chico, HOY)["pagos"] == 0


def test_racha_cuenta_dias_no_pagos():
    lunes = HOY - timedelta(days=HOY.weekday())
    mismo_dia = [evento(lunes, "repago_ticket", monto=5.0, a_tiempo=True) for _ in range(3)]
    assert racha(mismo_dia, HOY)["pagos"] == 1 and not racha(mismo_dia, HOY)["multiplicador"]
    tres_dias = [evento(lunes + timedelta(days=i), "repago_ticket", monto=5.0, a_tiempo=True) for i in range(3)]
    assert racha(tres_dias, HOY)["multiplicador"]
