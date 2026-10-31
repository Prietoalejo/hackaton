"""¿Puede el usuario usar Credirecto? Checklist configurable en config.REQUISITOS."""
from app import config as C


def pagos_servicio_a_tiempo(eventos) -> int:
    return sum(1 for e in eventos if e["tipo"] == "pago_servicio" and e.get("a_tiempo") is True)


def evaluar_habilitacion(usuario, eventos, hoy) -> dict:
    req = C.REQUISITOS
    pagos = pagos_servicio_a_tiempo(eventos)
    dias = (hoy - usuario["fecha_registro"]).days
    checklist = []
    if req["cedula"]:
        checklist.append({"requisito": "cedula", "nombre": "Cédula verificada",
                          "ok": bool(usuario.get("cedula_verificada")), "detalle": None})
    if req["vehiculo"]:
        ok = bool(usuario.get("vehiculo_verificado"))
        checklist.append({"requisito": "vehiculo", "nombre": "Vehículo verificado" if ok else "Verifica tu vehículo",
                          "ok": ok, "detalle": None})
    if req["pagos"] > 0:
        checklist.append({"requisito": "pagos", "nombre": f"{req['pagos']} pagos de servicios a tiempo",
                          "ok": pagos >= req["pagos"],
                          "detalle": None if pagos >= req["pagos"] else f"{pagos} de {req['pagos']}"})
    if req["dias"] > 0:
        checklist.append({"requisito": "dias", "nombre": f"{req['dias']} días en PagoDirecto",
                          "ok": dias >= req["dias"],
                          "detalle": None if dias >= req["dias"] else f"{max(dias, 0)} de {req['dias']}"})
    return {"habilitado": all(c["ok"] for c in checklist), "checklist": checklist}


FALTANTES = {
    "vehiculo": "Verificar su vehículo",
    "pagos": "Hacer los pagos de servicios a tiempo",
    "cedula": "Verificar su cédula",
    "dias": "Menos días de los requeridos en PagoDirecto",
}
