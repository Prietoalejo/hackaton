"""Parámetros de negocio de Credirecto.

Todos los números de negocio viven aquí. Los que aparecen en la vista Configuración del dashboard
están en `EDITABLES`: se pueden cambiar en caliente con `aplicar(valores)` (lo hace PUT /config).
El motor siempre lee los valores como `config.X` en el momento de calcular, así que un cambio
aplicado se nota en el siguiente cálculo.
"""
from contextlib import contextmanager
from datetime import date

# --- Editables desde el dashboard -----------------------------------------------------
# (clave, grupo, etiqueta, unidad, valor por defecto, paso)
EDITABLES = [
    ("peso_puntualidad", "Pesos del score", "Puntualidad", "pts", 40, 1),
    ("peso_constancia", "Pesos del score", "Constancia", "pts", 20, 1),
    ("peso_antiguedad", "Pesos del score", "Antigüedad", "pts", 15, 1),
    ("peso_anticipados", "Pesos del score", "Anticipados", "pts", 15, 1),
    ("peso_verificacion", "Pesos del score", "Verificación", "pts", 10, 1),
    ("friccion_max", "Pesos del score", "Fricción máxima", "pts", -10, 1),

    ("umbral_basico", "Umbrales de nivel", "Básico desde", "pts", 40, 1),
    ("umbral_confiable", "Umbrales de nivel", "Confiable desde", "pts", 60, 1),
    ("umbral_premium", "Umbrales de nivel", "Premium desde", "pts", 80, 1),
    ("margen_bajada", "Umbrales de nivel", "Margen para bajar", "pts", 5, 1),

    ("tickets_inicial", "Tickets por nivel", "Inicial", "", 1, 1),
    ("tickets_basico", "Tickets por nivel", "Básico", "", 2, 1),
    ("tickets_confiable", "Tickets por nivel", "Confiable", "", 3, 1),
    ("tickets_premium", "Tickets por nivel", "Premium", "", 5, 1),

    ("servicios_inicial", "Pagos de servicios por nivel", "Inicial", "", 0, 1),
    ("servicios_basico", "Pagos de servicios por nivel", "Básico", "", 0, 1),
    ("servicios_confiable", "Pagos de servicios por nivel", "Confiable", "", 1, 1),
    ("servicios_premium", "Pagos de servicios por nivel", "Premium", "", 3, 1),

    ("max_inicial", "Máximo por ticket", "Inicial", "USD", 5.0, 1),
    ("max_basico", "Máximo por ticket", "Básico", "USD", 5.0, 1),
    ("max_confiable", "Máximo por ticket", "Confiable", "USD", 10.0, 1),
    ("max_premium", "Máximo por ticket", "Premium", "USD", 20.0, 1),

    ("plazo_inicial", "Plazos máximos", "Inicial", "días", 7, 1),
    ("plazo_basico", "Plazos máximos", "Básico", "días", 14, 1),
    ("plazo_confiable", "Plazos máximos", "Confiable", "días", 15, 1),
    ("plazo_premium", "Plazos máximos", "Premium", "días", 30, 1),

    # Nivel del Club PagoDirecto (1 Turista, 2 Caminante, 3 Viajero, 4 Conocedor…) que exige cada nivel
    ("ruta_basico", "Ruta del Club para cada nivel", "Básico desde", "nivel", 2, 1),
    ("ruta_confiable", "Ruta del Club para cada nivel", "Confiable desde", "nivel", 3, 1),
    ("ruta_premium", "Ruta del Club para cada nivel", "Premium desde", "nivel", 4, 1),

    # Motor de beneficios del Club: el beneficio de cada ruta × un factor personal acotado
    ("beneficio_min_pct", "Motor de beneficios del Club", "Beneficio mínimo de la ruta", "%", 50, 5),
    ("beneficio_max_pct", "Motor de beneficios del Club", "Beneficio máximo de la ruta", "%", 150, 5),
    ("bono_puntualidad_pct", "Motor de beneficios del Club", "Puntualidad (± si paga a tiempo o no)", "%", 15, 5),
    ("bono_anticipados_pct", "Motor de beneficios del Club", "Paga antes del vencimiento", "%", 15, 5),
    ("bono_racha_pct", "Motor de beneficios del Club", "Racha de la semana completa", "%", 10, 5),
    ("bono_score_pct", "Motor de beneficios del Club", "Trust Score alto (± si es bajo)", "%", 10, 5),
    ("castigo_riesgo_pct", "Motor de beneficios del Club", "Segmento En riesgo", "%", 30, 5),

    ("repagos_basico", "Repagos a tiempo para subir", "Básico", "", 1, 1),
    ("repagos_confiable", "Repagos a tiempo para subir", "Confiable", "", 3, 1),
    ("repagos_premium", "Repagos a tiempo para subir", "Premium", "", 10, 1),

    ("gracia_dias", "Cobros y mora", "Gracia sin comisión", "días", 2, 1),
    ("gasto_admin_pct", "Cobros y mora", "Gasto administrativo", "%", 10, 1),
    ("descuento_confiable_pct", "Cobros y mora", "Descuento Confiable", "%", 25, 1),
    ("descuento_premium_pct", "Cobros y mora", "Descuento Premium", "%", 50, 1),
    ("comision_pct", "Cobros y mora", "Comisión por desfase", "%", 5, 1),
    ("comision_min", "Cobros y mora", "Comisión mínima", "USD", 0.25, 0.05),
    ("mora_dia", "Cobros y mora", "Inicio de mora, día", "", 8, 1),

    ("req_cedula", "Requisitos para habilitar", "Cédula verificada", "", True, None),
    ("req_vehiculo", "Requisitos para habilitar", "Vehículo verificado", "", True, None),
    ("req_pagos", "Requisitos para habilitar", "Pagos de servicios a tiempo", "", 2, 1),
    ("req_dias", "Requisitos para habilitar", "Días en PagoDirecto", "días", 30, 1),

    ("quinceneros_pct", "Datos de la prueba", "Usuarios «quinceneros»", "%", 35, 1),
]
DEFAULTS = {clave: valor for clave, _, _, _, valor, _ in EDITABLES}
VALORES = dict(DEFAULTS)   # valores activos

# --- Fijos ---------------------------------------------------------------------------
TASA_BS = 380.0                  # 1 USD = Bs 380 (datos de ejemplo)
VENTANA_DIAS = 90                # historial que mira el score
PUNTUALIDAD_SIN_HISTORIAL = 0.5  # proporción usada si no hay pagos en la ventana
CONSTANCIA_SEMANAS = 12
ANTIGUEDAD_MESES_MAX = 12
FRICCION_POR_RECHAZO = -1        # por cada rechazo de fondos en la ventana
FRICCION_POR_DIA_ATRASO = -1     # por cada día de atraso en la ventana
DIAS_ANTICIPADO = 1              # pagar 1+ días antes del vencimiento = anticipado
X_MESES_HISTORIAL = 2            # meses en PagoDirecto para Premium
PLAZO_BASE_DIAS = 7              # vencimiento por defecto: uso + 7 días
EXTENSION_FALLO_TECNICO_DIAS = 2
QUINCENA_DEFECTO = [15, 30]
QUINCENA_MIN_EVENTOS = 4
FIN_DE_MES_DESDE = 28            # los días 28 a 31 cuentan como "fin de mes"
DIA_FIN_DE_MES = 30
RITMO_DESDE = date(2026, 9, 7)   # día en que Credirecto empezó a decidir en los datos sintéticos

NOMBRES_NIVEL = ["Inicial", "Básico", "Confiable", "Premium"]
SERVICIOS = ["estacionamiento", "parquimetro", "peaje", "luz", "internet", "telefono", "seguro"]
# El crédito tiene dos cupos: tickets (movilidad) y pagos de servicios (facturas). No hay cupo en dinero.
SERVICIOS_MOVILIDAD = ["estacionamiento", "parquimetro", "peaje"]
SERVICIOS_FACTURA = ["luz", "internet", "telefono", "seguro"]
SERVICIOS_POR_NIVEL = {
    0: ["estacionamiento"],
    1: ["estacionamiento", "parquimetro", "peaje"],
    2: ["estacionamiento", "parquimetro", "peaje", "luz", "internet", "telefono"],
    3: ["estacionamiento", "parquimetro", "peaje", "luz", "internet", "telefono", "seguro"],
}
SERVICIOS_TEXTO = {0: "Estacionamiento", 1: "+ parquímetros y peajes",
                   2: "+ luz, internet y teléfono", 3: "+ seguros"}


def cupo_de(servicio) -> str:
    """"tickets" para movilidad, "servicios" para facturas: cada uno gasta de su propio cupo."""
    return "servicios" if servicio in SERVICIOS_FACTURA else "tickets"

# Regla actual (antes de Credirecto): igual para todos
REGLA_ACTUAL = {"tickets": 2, "servicios_cupo": 0, "plazo_dias": 7, "monto_max": 5.0, "servicios": ["estacionamiento"]}

# --- Segmentos -----------------------------------------------------------------------
SEG_SIN_CREDITO = "Sin crédito"
SEG_EN_RIESGO = "En riesgo"
SEG_NUEVO = "Nuevo"
SEG_ENFRIAMIENTO = "En enfriamiento"
SEG_CONDUCTOR = "Conductor diario"
SEG_PUNTUAL = "Puntual"
SEGMENTOS = [SEG_CONDUCTOR, SEG_PUNTUAL, SEG_NUEVO, SEG_ENFRIAMIENTO, SEG_EN_RIESGO, SEG_SIN_CREDITO]
DESCRIPCION_SEGMENTO = {
    SEG_CONDUCTOR: "paga estacionamiento 4+ días por semana",
    SEG_PUNTUAL: "paga antes o el día de cobro",
    SEG_NUEVO: "menos de 30 días con crédito",
    SEG_ENFRIAMIENTO: "sin usar el crédito en 21+ días",
    SEG_EN_RIESGO: "atraso o score cayendo",
    SEG_SIN_CREDITO: "aún no habilitados",
}
RIESGO_DIAS = 30             # atraso o 2+ rechazos en los últimos 30 días
RIESGO_RECHAZOS = 2
RIESGO_CAIDA_SCORE = 5       # el score cayó 5+ puntos en 7 días
NUEVO_DIAS = 30              # menos de 30 días habilitado
ENFRIAMIENTO_DIAS = 21       # sin usar el crédito en 21+ días
CONDUCTOR_DIAS_SEMANA = 4    # pagos de movilidad en 4+ días distintos por semana...
CONDUCTOR_SEMANAS = 4        # ...en promedio de las últimas 4 semanas

# --- Comunicar y premiar ---------------------------------------------------------------
DIAS_RECORDATORIO = 2
# Los puntos NO son un sistema nuevo: se suman al saldo de puntos del Club PagoDirecto (el de
# Hitos / Beneficios / Puntos y el progreso de la ruta). Credirecto solo dice cuántos aporta.
CLUB_NOMBRE = "Club PagoDirecto"
PUNTOS_POR_PAGO = 100        # pts del Club por pago (servicio en PagoDirecto o cuota de Credirecto a tiempo)
BONO_RUTA_COMPLETADA = 500   # "+500 puntos obtenidos" al completar una ruta
# Niveles y rutas del Club tal como están en la app (pts para desbloquear cada ruta). El Club anuncia
# 10 niveles "de Turista a Leyenda"; la app muestra hoy estos 7, los 3 últimos aún no están publicados.
# walletback_pct y tickets_gratis son el beneficio BASE de cada ruta (supuesto: el Club no publica los
# valores). El motor de beneficios (motor/beneficios.py) lo personaliza por usuario.
RUTAS_CLUB = [
    {"nivel": "Turista", "ruta": "Ruta Colonial", "desde": 0, "walletback_pct": 1.0, "tickets_gratis": 0},
    {"nivel": "Caminante", "ruta": "Ruta Falcón", "desde": 1000, "walletback_pct": 1.5, "tickets_gratis": 1},
    {"nivel": "Viajero", "ruta": "Ruta del Café", "desde": 4000, "walletback_pct": 2.0, "tickets_gratis": 1},
    {"nivel": "Conocedor", "ruta": "Ruta de Paria", "desde": 11000, "walletback_pct": 2.5, "tickets_gratis": 2},
    {"nivel": "Explorador", "ruta": "Ruta de Los Llanos", "desde": 24000, "walletback_pct": 3.0, "tickets_gratis": 2},
    {"nivel": "Trotamundo", "ruta": "Ruta Andina", "desde": 45000, "walletback_pct": 3.5, "tickets_gratis": 3},
    {"nivel": "Baqueano", "ruta": "Ruta del Zulia", "desde": 76000, "walletback_pct": 4.0, "tickets_gratis": 4},
]
BENEFICIO_MIN_PAGOS = 3      # pagos en la ventana para que la puntualidad y los anticipados cuenten
MULTIPLICADOR_PUNTOS = 1.5   # pagar antes del vencimiento o con la racha completa
META_RACHA = 3               # pagos en la semana para activar el ×1,5 (la misma racha del Club)

# Mensajes por prioridad. Tono amable, nunca amenazante.
MENSAJES = {
    "aviso_mora": {"prioridad": 1, "nombre": "Aviso de mora", "descripcion": "día 8, entra en modo recuperación",
                   "mensaje": "Tu crédito está en pausa. Cada recarga paga primero tu cuota y recuperas tus tickets.",
                   "canal": "push+wisi"},
    "comision": {"prioridad": 2, "nombre": "Comisión", "descripcion": "al aplicar el 5 % por desfase",
                 "mensaje": "Se sumó una comisión de {monto} a tu cuota. Págala cuando puedas y todo vuelve a la normalidad.",
                 "canal": "preferido"},
    "gracia": {"prioridad": 3, "nombre": "Gracia", "descripcion": "día 1 después del vencimiento",
               "mensaje": "Tu cuota venció ayer. Tienes {dias} días sin comisión: a cualquiera le pasa.",
               "canal": "preferido"},
    "recordatorio": {"prioridad": 4, "nombre": "Recordatorio", "descripcion": "2 días antes, a su hora habitual",
                     "mensaje": "Tu cuota de Credirecto vence en 2 días. Paga tu cuota y tu ticket vuelve a estar disponible.",
                     "canal": "preferido"},
    "mover_quincena": {"prioridad": 5, "nombre": "Mover a quincena", "descripcion": "cuota cae lejos de su recarga",
                       "mensaje": "Tu cuota vence el {fecha}. ¿La movemos al {dia}, tu día de cobro? Sin costo.",
                       "canal": "preferido"},
    "falta_poco": {"prioridad": 6, "nombre": "Falta poco para subir", "descripcion": "a 1 repago de subir de nivel",
                   "mensaje": "Te falta 1 pago a tiempo para subir de nivel y ganar más tickets.",
                   "canal": "preferido"},
}
MENSAJE_SUBIDA = "¡Subiste a Credirecto {nivel}! Ahora tienes {cupo}{extra}."

# Quien no está habilitado o tiene el crédito congelado no ve la opción de pagar con Credirecto:
# esos intentos no cuentan como solicitudes.
MOTIVOS_SIN_SOLICITUD = ("no_habilitado", "modo_recuperacion")

MOTIVOS_RECHAZO = {
    "no_habilitado": "Aún no está habilitado",
    "modo_recuperacion": "Crédito congelado por mora",
    "deuda_vencida": "Deuda vencida",
    "servicio_no_cubierto": "Servicio no cubierto por su nivel",
    "maximo_en_uso": "Máximo de tickets en uso",
    "servicios_en_uso": "Pagos de servicios en uso",
    "saldo_insuficiente": "Sin saldo para el excedente",
}

# --- Derivados (se recalculan con aplicar) ----------------------------------------------
PESOS = {}
FRICCION_MAX = 0
UMBRALES_NIVEL = {}
MARGEN_BAJADA = 0
NIVELES = {}
REPAGOS_POR_NIVEL = {}
RUTA_MINIMA_POR_NIVEL = {}
GRACIA_DIAS = MORA_DIA = 0
GASTO_ADMIN = COMISION = COMISION_MIN = 0.0
DESCUENTO_NIVEL = {}
REQUISITOS = {}
QUINCENEROS = 0.0


def _derivar():
    g = globals()
    v = VALORES
    g["PESOS"] = {"puntualidad": v["peso_puntualidad"], "constancia": v["peso_constancia"],
                  "antiguedad": v["peso_antiguedad"], "anticipados": v["peso_anticipados"],
                  "verificacion": v["peso_verificacion"]}
    g["FRICCION_MAX"] = -abs(v["friccion_max"])
    g["UMBRALES_NIVEL"] = {1: v["umbral_basico"], 2: v["umbral_confiable"], 3: v["umbral_premium"]}
    g["MARGEN_BAJADA"] = v["margen_bajada"]
    nombres = ["inicial", "basico", "confiable", "premium"]
    g["NIVELES"] = {n: {"tickets": int(v[f"tickets_{k}"]), "servicios_cupo": int(v[f"servicios_{k}"]),
                        "monto_max": float(v[f"max_{k}"]),
                        "plazo_dias": int(v[f"plazo_{k}"]), "servicios": SERVICIOS_POR_NIVEL[n]}
                    for n, k in enumerate(nombres)}
    g["REPAGOS_POR_NIVEL"] = {0: 0, 1: int(v["repagos_basico"]), 2: int(v["repagos_confiable"]),
                              3: int(v["repagos_premium"])}
    # Índice (0 = Turista) en RUTAS_CLUB que exige cada nivel de Credirecto
    g["RUTA_MINIMA_POR_NIVEL"] = {0: 0, 1: int(v["ruta_basico"]) - 1, 2: int(v["ruta_confiable"]) - 1,
                                  3: int(v["ruta_premium"]) - 1}
    g["GRACIA_DIAS"] = int(v["gracia_dias"])
    g["MORA_DIA"] = int(v["mora_dia"])
    g["GASTO_ADMIN"] = v["gasto_admin_pct"] / 100
    g["COMISION"] = v["comision_pct"] / 100
    g["COMISION_MIN"] = float(v["comision_min"])
    g["DESCUENTO_NIVEL"] = {0: 0.0, 1: 0.0, 2: v["descuento_confiable_pct"] / 100, 3: v["descuento_premium_pct"] / 100}
    g["REQUISITOS"] = {"cedula": bool(v["req_cedula"]), "vehiculo": bool(v["req_vehiculo"]),
                       "pagos": int(v["req_pagos"]), "dias": int(v["req_dias"])}
    g["QUINCENEROS"] = v["quinceneros_pct"] / 100


def validar(valores: dict) -> dict:
    """Devuelve los valores limpios (tipos correctos) o lanza ValueError con un texto legible."""
    limpios = {}
    for clave, valor in valores.items():
        if clave not in DEFAULTS:
            raise ValueError(f"Parámetro desconocido: {clave}.")
        defecto = DEFAULTS[clave]
        if isinstance(defecto, bool):
            limpios[clave] = bool(valor)
        else:
            try:
                numero = float(valor)
            except (TypeError, ValueError):
                raise ValueError(f"El valor de {clave} debe ser un número.")
            limpios[clave] = int(numero) if isinstance(defecto, int) and numero.is_integer() else numero
    candidato = {**VALORES, **limpios}
    if not candidato["umbral_basico"] <= candidato["umbral_confiable"] <= candidato["umbral_premium"]:
        raise ValueError("Los umbrales deben ir de menor a mayor: Básico ≤ Confiable ≤ Premium.")
    rutas = [candidato["ruta_basico"], candidato["ruta_confiable"], candidato["ruta_premium"]]
    if rutas != sorted(rutas) or not 1 <= rutas[0] or rutas[-1] > len(RUTAS_CLUB):
        raise ValueError(f"Las rutas del Club van de menor a mayor, entre 1 y {len(RUTAS_CLUB)}.")
    if not candidato["beneficio_min_pct"] <= 100 <= candidato["beneficio_max_pct"]:
        raise ValueError("El beneficio mínimo debe ser ≤ 100 % y el máximo ≥ 100 %.")
    if candidato["mora_dia"] <= candidato["gracia_dias"]:
        raise ValueError("La mora debe empezar después de los días de gracia.")
    return limpios


def aplicar(valores: dict) -> None:
    """Fija los valores activos (los no incluidos vuelven a su valor por defecto)."""
    VALORES.clear()
    VALORES.update(DEFAULTS)
    VALORES.update(valores)
    _derivar()


@contextmanager
def con_valores(cambios: dict):
    """Aplica cambios temporalmente (para simular) y deja todo como estaba al salir."""
    previos = dict(VALORES)
    aplicar({**previos, **cambios})
    try:
        yield
    finally:
        aplicar(previos)


_derivar()
