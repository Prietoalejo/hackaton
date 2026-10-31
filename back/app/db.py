"""Engine de SQLAlchemy, tablas y helpers de lectura y escritura. El motor nunca importa este módulo."""
import os
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import (BigInteger, Boolean, Column, Date, Integer, MetaData, Numeric, Table, Text,
                        bindparam, create_engine, delete, func, select, update)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import insert as pg_insert

BACK = Path(__file__).resolve().parents[1]
load_dotenv(BACK / ".env")

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise RuntimeError("Falta DATABASE_URL en back/.env (ver .env.example).")
        _engine = create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)
    return _engine


# --- Tablas (espejo de datos/schema.sql; el DDL vive allá) ---------------------------

metadata = MetaData()

reloj = Table("reloj", metadata, Column("id", Integer, primary_key=True), Column("fecha_actual", Date))

usuarios = Table(
    "usuarios", metadata,
    Column("id", Text, primary_key=True), Column("nombre", Text), Column("alias", Text),
    Column("fecha_registro", Date), Column("cedula_verificada", Boolean), Column("vehiculo_verificado", Boolean),
    Column("saldo_wallet", Numeric(12, 4)), Column("perfil_sintetico", Text), Column("quincenero", Boolean),
    Column("canal_preferido", Text), Column("club", Text), Column("habilitado_desde", Date),
    Column("modo_recuperacion", Boolean),
)

eventos = Table(
    "eventos", metadata,
    Column("id", BigInteger, primary_key=True), Column("user_id", Text), Column("fecha", Date),
    Column("tipo", Text), Column("servicio", Text), Column("monto", Numeric(12, 2)),
    Column("ticket_id", BigInteger), Column("a_tiempo", Boolean),
)

tickets = Table(
    "tickets", metadata,
    Column("id", BigInteger, primary_key=True), Column("user_id", Text), Column("servicio", Text),
    Column("comercio", Text), Column("monto", Numeric(12, 2)), Column("gasto_admin", Numeric(12, 2)),
    Column("fecha_uso", Date), Column("fecha_vencimiento", Date), Column("fecha_pago", Date),
    Column("estado", Text), Column("comision", Numeric(12, 2)), Column("descuento", Numeric(12, 2)),
    Column("monto_pagado", Numeric(12, 2)), Column("pago_planeado", Date),
)

perfiles = Table(
    "perfiles", metadata,
    Column("user_id", Text, primary_key=True), Column("trust_score", Integer), Column("razones", JSONB),
    Column("habilitado", Boolean), Column("nivel", Integer), Column("segmento", Text),
    Column("estado_mora", Text), Column("quincena", ARRAY(Integer)), Column("actualizado", Date),
    Column("ajuste_cupo", Integer),
)

decisiones = Table(
    "decisiones", metadata,
    Column("id", BigInteger, primary_key=True), Column("user_id", Text), Column("fecha", Date),
    Column("prestar", JSONB), Column("comunicar", JSONB(none_as_null=False)), Column("premiar", JSONB),
)

historial_niveles = Table(
    "historial_niveles", metadata,
    Column("user_id", Text, primary_key=True), Column("fecha", Date, primary_key=True),
    Column("trust_score", Integer), Column("habilitado", Boolean), Column("nivel", Integer),
    Column("segmento", Text),
)

solicitudes = Table(
    "solicitudes", metadata,
    Column("id", BigInteger, primary_key=True), Column("user_id", Text), Column("fecha", Date),
    Column("servicio", Text), Column("monto", Numeric(12, 2)), Column("resultado", Text),
    Column("motivo", Text), Column("ticket_id", BigInteger),
)

metricas_regla_actual = Table(
    "metricas_regla_actual", metadata,
    Column("fecha", Date, primary_key=True), Column("prestado", Numeric(12, 2)), Column("usos", Integer),
    Column("usos_reusados", Integer), Column("vencidos", Integer), Column("a_tiempo", Integer),
    Column("llegaron_a_mora", Integer), Column("comisiones", Numeric(12, 2)), Column("deuda_mora", Numeric(12, 2)),
    Column("habilitados", Integer),
)

bitacora = Table("bitacora", metadata, Column("id", BigInteger, primary_key=True), Column("fecha", Date),
                 Column("mensaje", Text))

configuracion = Table("configuracion", metadata, Column("id", Integer, primary_key=True),
                      Column("valores", JSONB), Column("fecha", Date), Column("por", Text))

TABLAS_DE_DATOS = ["decisiones", "historial_niveles", "solicitudes", "perfiles", "eventos", "tickets",
                   "usuarios", "metricas_regla_actual", "bitacora", "reloj"]


# --- Lectura -------------------------------------------------------------------------

def a_dict(fila) -> dict:
    """Fila de SQLAlchemy → dict con números como float."""
    return {k: (float(v) if isinstance(v, Decimal) else v) for k, v in dict(fila).items()}


def cargar_usuarios(conn, user_id=None) -> dict:
    q = select(usuarios).order_by(usuarios.c.id)
    if user_id is not None:
        q = q.where(usuarios.c.id == user_id)
    return {f["id"]: a_dict(f) for f in conn.execute(q).mappings()}


def _agrupar(conn, tabla, orden, user_id=None) -> dict:
    q = select(tabla).order_by(*orden)
    if user_id is not None:
        q = q.where(tabla.c.user_id == user_id)
    grupos = defaultdict(list)
    for f in conn.execute(q).mappings():
        grupos[f["user_id"]].append(a_dict(f))
    return grupos


def cargar_eventos(conn, user_id=None) -> dict:
    return _agrupar(conn, eventos, [eventos.c.fecha, eventos.c.id], user_id)


def cargar_tickets(conn, user_id=None) -> dict:
    return _agrupar(conn, tickets, [tickets.c.fecha_uso, tickets.c.id], user_id)


def foto_de_historial(conn, condicion, elegir=func.max, user_id=None) -> dict:
    """{user_id: fila} de la foto del historial de fecha `elegir` (max o min) entre las que cumplen `condicion`."""
    h = historial_niveles
    q = select(h.c.user_id, elegir(h.c.fecha).label("fecha")).where(condicion).group_by(h.c.user_id)
    if user_id is not None:
        q = q.where(h.c.user_id == user_id)
    elegidas = q.subquery()
    filas = conn.execute(select(h).join(
        elegidas, (h.c.user_id == elegidas.c.user_id) & (h.c.fecha == elegidas.c.fecha))).mappings()
    return {f["user_id"]: dict(f) for f in filas}


def contexto_anterior(conn, hoy, user_id=None) -> tuple:
    """(nivel de la última foto antes de hoy, score de hace 7 días) por usuario."""
    from datetime import timedelta
    h = historial_niveles
    previas = foto_de_historial(conn, h.c.fecha < hoy, func.max, user_id)
    hace_7 = foto_de_historial(conn, h.c.fecha <= hoy - timedelta(days=7), func.max, user_id)
    return ({u: f["nivel"] for u, f in previas.items()},
            {u: f["trust_score"] for u, f in hace_7.items()})


def siguiente_id(conn, tabla) -> int:
    return (conn.execute(select(func.max(tabla.c.id))).scalar() or 0) + 1


# --- Escritura -----------------------------------------------------------------------

def guardar_resultados(conn, resultados, hoy) -> None:
    """Guarda perfiles, foto diaria y decisiones. `resultados` = [(perfil, decision), ...]."""
    if not resultados:
        return
    filas_perfil = [{k: p[k] for k in perfiles.c.keys()} for p, _ in resultados]
    stmt = pg_insert(perfiles)
    conn.execute(stmt.on_conflict_do_update(
        index_elements=[perfiles.c.user_id],
        set_={c: stmt.excluded[c] for c in perfiles.c.keys() if c != "user_id"},
    ), filas_perfil)

    filas_foto = [{"user_id": p["user_id"], "fecha": hoy, "trust_score": p["trust_score"],
                   "habilitado": p["habilitado"], "nivel": p["nivel"], "segmento": p["segmento"]}
                  for p, _ in resultados]
    stmt = pg_insert(historial_niveles)
    conn.execute(stmt.on_conflict_do_update(
        index_elements=[historial_niveles.c.user_id, historial_niveles.c.fecha],
        set_={c: stmt.excluded[c] for c in ("trust_score", "habilitado", "nivel", "segmento")},
    ), filas_foto)

    ids = [p["user_id"] for p, _ in resultados]
    conn.execute(delete(decisiones).where(decisiones.c.fecha == hoy, decisiones.c.user_id.in_(ids)))
    conn.execute(decisiones.insert(), [
        {"user_id": p["user_id"], "fecha": hoy, "prestar": d["prestar"],
         "comunicar": d["comunicar"], "premiar": d["premiar"]}
        for p, d in resultados
    ])


def _insertar(conn, tabla, filas, con_id=False) -> None:
    if filas:
        cols = [c for c in tabla.c.keys() if con_id or c != "id"]
        conn.execute(tabla.insert(), [{c: f.get(c) for c in cols} for f in filas])


def insertar_eventos(conn, nuevos) -> None:
    _insertar(conn, eventos, nuevos)


def insertar_tickets(conn, nuevos) -> None:
    """Inserta tickets con su id ya asignado y deja la secuencia al día."""
    if nuevos:
        _insertar(conn, tickets, nuevos, con_id=True)
        conn.exec_driver_sql("select setval(pg_get_serial_sequence('tickets', 'id'), "
                             "(select coalesce(max(id), 1) from tickets))")


def insertar_solicitudes(conn, nuevas) -> None:
    _insertar(conn, solicitudes, nuevas)


def anotar_bitacora(conn, fecha, mensaje) -> None:
    conn.execute(bitacora.insert().values(fecha=fecha, mensaje=mensaje))


def actualizar_tickets(conn, lista) -> None:
    if not lista:
        return
    campos = ["estado", "comision", "descuento", "monto_pagado", "fecha_pago", "fecha_vencimiento"]
    conn.execute(
        update(tickets).where(tickets.c.id == bindparam("b_id")).values(
            **{c: bindparam(f"b_{c}") for c in campos}),
        [{"b_id": t["id"], **{f"b_{c}": t[c] for c in campos}} for t in lista],
    )


def actualizar_usuarios(conn, lista) -> None:
    if not lista:
        return
    campos = ["saldo_wallet", "modo_recuperacion", "habilitado_desde"]
    conn.execute(
        update(usuarios).where(usuarios.c.id == bindparam("b_id")).values(
            **{c: bindparam(f"b_{c}") for c in campos}),
        [{"b_id": u["id"], **{f"b_{c}": u[c] for c in campos}} for u in lista],
    )


def leer_config(conn):
    fila = conn.execute(select(configuracion).where(configuracion.c.id == 1)).mappings().first()
    return dict(fila) if fila else None


def guardar_config(conn, valores, fecha, por) -> None:
    stmt = pg_insert(configuracion).values(id=1, valores=valores, fecha=fecha, por=por)
    conn.execute(stmt.on_conflict_do_update(index_elements=[configuracion.c.id],
                                            set_={"valores": valores, "fecha": fecha, "por": por}))
