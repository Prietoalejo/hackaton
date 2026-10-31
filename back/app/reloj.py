"""Fecha simulada. La lógica de negocio nunca usa datetime.now() ni date.today(): usa esto."""
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app import db


def leer(conn) -> date:
    fecha = conn.execute(select(db.reloj.c.fecha_actual).where(db.reloj.c.id == 1)).scalar()
    if fecha is None:
        raise RuntimeError("La tabla reloj está vacía. Corre `python -m datos.generar`.")
    return fecha


def fijar(conn, fecha: date) -> None:
    stmt = pg_insert(db.reloj).values(id=1, fecha_actual=fecha)
    conn.execute(stmt.on_conflict_do_update(index_elements=[db.reloj.c.id],
                                            set_={"fecha_actual": fecha}))


def avanzar(conn, dias: int = 1) -> date:
    nueva = leer(conn) + timedelta(days=dias)
    fijar(conn, nueva)
    return nueva
