# API de Ritmo · contrato entre back y front

Base: `http://localhost:8000` (en el front, `import.meta.env.VITE_API_URL`). JSON en todas las respuestas.
CORS abierto. Errores: `{"detail": "texto legible en español"}` con 404 (no existe), 409 (regla de negocio), 422 (datos inválidos).

Convenciones:
- **Montos siempre en USD** (número). El front muestra Bs multiplicando por `tasa_bs` (viene en `/salud` y `/config`).
- Fechas `"YYYY-MM-DD"`. Porcentajes de 0 a 100 con 1 decimal (`87.4`), o `null` si no hay datos.
- Niveles: `0 Inicial · 1 Básico · 2 Confiable · 3 Premium`. Un usuario no habilitado tiene `nivel: null`.
- Segmentos: `"Sin crédito" | "En riesgo" | "Nuevo" | "En enfriamiento" | "Conductor diario" | "Puntual"`.
- Estados de ticket: `abierto | gracia | atrasado | mora | pagado | disputa | pausa_tecnica`.
  `gracia` = días 1–2 tras el vencimiento (sin comisión); `atrasado` = días 3–7 (ya con comisión);
  `mora` = día 8+ → el usuario entra en **modo recuperación**.

---

## Comunes

### `GET /salud`
```json
{"ok": true, "hoy": "2026-10-31", "tasa_bs": 380.0}
```

### `GET /reloj`
```json
{"hoy": "2026-10-31",
 "bitacora": [{"fecha": "2026-10-31", "mensaje": "Worker listo · 500 scores al día · 0 créditos congelados"}]}
```
Bitácora más reciente primero (máx. 30).

### `POST /simular-dia?dias=1`  (dias 1..60)
Avanza el reloj; cada día: usos y pagos de los usuarios sintéticos según su perfil, worker de gracia/comisión/mora, recálculo de todos.
```json
{"desde": "2026-10-31", "hoy": "2026-11-01", "dias": 1,
 "totales": {"solicitudes": 120, "tickets": 98, "pagos": 87, "comisiones": 3, "nuevas_moras": 1,
             "congelados": 1, "habilitados": 2, "subieron_nivel": 5, "bajaron_nivel": 1},
 "bitacora": [{"fecha": "2026-11-01", "mensaje": "Comisiones aplicadas: 3 · tickets congelados: 1 · 500 scores recalculados (5 suben de nivel) · usuarios habilitados: 2"}],
 "cambios": [{"fecha": "2026-11-01", "user_id": "u_0007", "tipo": "comision", "ticket_id": 12, "monto": 0.25}]}
```
`cambios[].tipo` ∈ `pago, gracia, comision, mora, debito_wallet, congelado, descongelado, habilitado`.

### `POST /reset`
Recarga los datos sintéticos y vuelve el reloj al 2026-10-31. Tarda ~1 min.
```json
{"hoy": "2026-10-31", "usuarios": 500, "tickets": 4321, "eventos": 30000, "segundos": 40.2}
```

---

## Dashboard

### `GET /resumen`  (vista 01)
```json
{"hoy": "2026-10-31", "desde": "2026-08-09", "ritmo_desde": "2026-09-07", "hay_datos": true,
 "kpis": {
   "usuarios_totales": 500, "habilitados": 312, "en_espera": 188, "pct_habilitados": 62.4,
   "monto_prestado": 9840.0,
   "repago_a_tiempo": 87.4, "repago_delta_pp": 1.2,
   "mora": 4.1, "mora_delta_pp": 0.1,
   "comisiones": 412.0, "reuso": 71.0, "perdida_esperada": 403.0},
 "comparativo": [
   {"metrica": "Repago a tiempo", "unidad": "pct", "regla_actual": 74.2, "ritmo": 87.4, "mejor_si_sube": true},
   {"metrica": "Mora", "unidad": "pct", "regla_actual": 11.8, "ritmo": 4.1, "mejor_si_sube": false},
   {"metrica": "Monto prestado", "unidad": "usd", "regla_actual": 7120.0, "ritmo": 9840.0, "mejor_si_sube": true},
   {"metrica": "Reuso", "unidad": "pct", "regla_actual": 52.0, "ritmo": 71.0, "mejor_si_sube": true},
   {"metrica": "Pérdida esperada", "unidad": "usd", "regla_actual": 840.0, "ritmo": 403.0, "mejor_si_sube": false},
   {"metrica": "Comisiones cobradas", "unidad": "usd", "regla_actual": 604.0, "ritmo": 412.0, "mejor_si_sube": true},
   {"metrica": "Usuarios habilitados", "unidad": "n", "regla_actual": 500, "ritmo": 312, "mejor_si_sube": true}],
 "semanal": [{"desde": "2026-08-09", "etiqueta": "9 ago", "repago_a_tiempo": 76.0, "mora": 10.2}]}
```
- `kpis.repago_a_tiempo` y `kpis.mora` son de la **última semana**; los `*_delta_pp` comparan con la semana anterior.
- Montos (`monto_prestado`, `comisiones`, `perdida_esperada`) y `reuso` son de las **últimas 12 semanas**.
- `comparativo`: "regla actual" = los mismos usuarios con 2 tickets, 7 días, solo estacionamiento, sin gracia ni descuentos. La diferencia la calcula el front (pp para `pct`, % para `usd`, resta para `n`).
- `semanal`: 12 puntos, el último es la semana que termina hoy. `hay_datos: false` → estado vacío del diseño.

### `GET /cohortes`  (vista 02)
```json
{"hoy": "2026-10-31", "semanas": 12, "habilitados": 312, "ritmo_desde": "2026-09-07",
 "cohortes": [
   {"cohorte": "2026-05", "etiqueta": "May 2026", "usuarios": 58,
    "semanas": [{"semana": 1, "repago_a_tiempo": 71.2, "reuso": 61.0}, {"semana": 12, "repago_a_tiempo": null, "reuso": null}]}],
 "mejor_semana4": {"repago_a_tiempo": {"etiqueta": "Oct 2026", "valor": 91.0}, "reuso": {"etiqueta": "Oct 2026", "valor": 80.0}},
 "peor_semana4":  {"repago_a_tiempo": {"etiqueta": "May 2026", "valor": 72.0}, "reuso": {"etiqueta": "May 2026", "valor": 55.0}}}
```
`null` = la cohorte aún no llega a esa semana (celda punteada "—").

### `GET /segmentos`  (vista 03)
```json
{"hoy": "2026-10-31", "habilitados": 312, "total": 500, "margen_bajada": 5,
 "niveles": [{"nivel": 0, "nombre": "Credirecto Inicial", "rango": "score < 40", "usuarios": 96,
              "tickets": 1, "servicios_cupo": 0, "monto_max": 5.0, "servicios": ["estacionamiento"],
              "servicios_texto": "Estacionamiento"}],
 "segmentos": [{"segmento": "Conductor diario", "descripcion": "paga estacionamiento 4+ días por semana", "usuarios": 60}],
 "semana": {"desde": "2026-10-25", "hasta": "2026-10-31", "subieron": 41, "bajaron": 12,
            "movimientos": [{"de": "Inicial", "a": "Básico", "usuarios": 19, "sube": true}]}}
```

### `GET /decisiones`  (vista 04, semana que termina hoy)
```json
{"desde": "2026-10-25", "hasta": "2026-10-31",
 "solicitudes": {"total": 1284, "aprobadas": 1046, "parciales": 142, "rechazadas": 96,
                 "motivos": [{"motivo": "Máximo de tickets en uso", "usuarios": 38}]},
 "habilitaciones": {"semana": 23, "recientes": [{"user_id": "u_0488", "nombre": "José", "fecha": "2026-10-31", "nivel": 0}]},
 "en_espera": {"total": 188, "faltantes": [{"requisito": "Verificar su vehículo", "usuarios": 81}]},
 "mensajes": {"enviados": 674, "pct_pagan_48h": 81.0,
              "por_tipo": [{"tipo": "recordatorio", "nombre": "Recordatorio", "descripcion": "2 días antes, a su hora habitual",
                            "push": 298, "wisi": 114, "total": 412, "pct_pagan_48h": 78.0}]},
 "premios": {"rachas": 167, "multiplicadores": 94, "puntos": 48300, "descuentos": 212, "descuentos_monto": 96.4}}
```
`solicitudes.motivos` ordenados de mayor a menor. Tipos de mensaje: `recordatorio, mover_quincena, gracia, comision, aviso_mora, falta_poco`.

### `GET /usuarios?q=&nivel=&segmento=&limit=50&offset=0`  (vista 05, tabla; también el selector de la app)
`nivel` = 0..3 o `espera`. `q` busca por id o nombre.
```json
{"total": 500,
 "usuarios": [{"user_id": "u_0142", "nombre": "María", "trust_score": 76, "nivel": 2, "nivel_nombre": "Confiable",
               "segmento": "Puntual", "habilitado": true, "tickets_usados": 1, "tickets_total": 3, "monto_max": 10.0,
               "deuda": 4.79, "dias_atraso": 0, "modo_recuperacion": false}]}
```

### `GET /usuarios/{id}`  (ficha del dashboard y todas las pantallas de la app)
```json
{"user_id": "u_0142", "nombre": "María", "alias": "@maria.r",
 "habilitado": true, "habilitado_desde": "2026-06-02", "cohorte": "2026-06",
 "nivel": 2, "nivel_nombre": "Confiable", "segmento": "Puntual", "quincena": [15, 30],
 "club": "Viajero · Ruta del Café", "saldo_wallet": 0.0036, "modo_recuperacion": false, "estado_mora": "al_dia",
 "trust_score": 76,
 "razones": [{"senal": "puntualidad", "nombre": "Puntualidad", "aporte": 38.0, "max": 40},
             {"senal": "friccion", "nombre": "Fricción", "aporte": -3.0, "max": -10}],
 "checklist": [{"requisito": "cedula", "nombre": "Cédula verificada", "ok": true, "detalle": null},
               {"requisito": "vehiculo", "nombre": "Verifica tu vehículo", "ok": false, "detalle": null},
               {"requisito": "pagos", "nombre": "2 pagos de servicios a tiempo", "ok": false, "detalle": "1 de 2"},
               {"requisito": "dias", "nombre": "30 días en PagoDirecto", "ok": true, "detalle": null}],
 "tickets": {"total": 3, "usados": 1, "disponibles": 2, "monto_max": 10.0,
             "servicios": ["estacionamiento", "parquimetro", "peaje", "luz", "internet", "telefono"]},
 "servicios_cupo": {"total": 1, "usados": 0, "disponibles": 1, "cubre": ["luz", "internet", "telefono"]},
 "club_puntos": {"nombre": "Club PagoDirecto", "nivel_club": 2, "nivel_nombre": "Viajero", "ruta": "Ruta del Café",
                 "texto": "Viajero · Ruta del Café", "puntos": 4800, "puntos_credirecto": 650,
                 "siguiente": {"nivel_club": 3, "nivel_nombre": "Conocedor", "ruta": "Ruta de Paria", "desde": 11000, "faltan": 6200},
                 "puntos_por_pago": 100, "multiplicador": 1.5},
 "progreso": {"siguiente_nivel": 3, "siguiente_nombre": "Premium", "faltan_puntos": 4,
              "repagos_hechos": 5, "repagos_requeridos": 10, "faltan_repagos": 5},
 "racha": {"pagos": 2, "meta": 3, "quedan_dias": 4, "multiplicador": false},
 "deuda_total": 4.79,
 "tickets_abiertos": [{
   "id": 4433, "codigo": "0DFF7B1", "servicio": "estacionamiento", "comercio": "C.C. El Tolón",
   "fecha_uso": "2026-10-31", "vence": "2026-11-07", "estado": "abierto", "dias_atraso": 0,
   "monto": 4.36, "gasto_admin": 0.44, "comision": 0.0, "cuota": 4.79, "pagado": 0.0, "deuda": 4.79,
   "descuento_si_anticipa": 0.11, "gracia_hasta": "2026-11-09",
   "comision_si_atrasa": 0.25, "oferta_quincena": "2026-11-15"}],
 "decisiones": {
   "prestar": {"tickets": 2, "servicios_cupo": 1, "plazo_dias": 15, "monto_max": 10.0, "servicios": ["estacionamiento", "..."], "motivo": null},
   "comunicar": {"tipo": "recordatorio", "nombre": "Recordatorio", "mensaje": "Tu cuota de Credirecto vence en 2 días. Paga tu cuota y tu ticket vuelve a estar disponible.",
                 "canal": "push", "fecha": "2026-11-05", "oferta_quincena": "2026-11-15"},
   "premiar": [{"tipo": "racha", "detalle": "+1 racha"}]},
 "notificaciones": [{"fecha": "2026-10-20", "tipo": "subida_nivel", "titulo": "Nuevo nivel",
                     "mensaje": "¡Subiste a Credirecto Confiable! Ahora tienes 3 tickets y 1 pago de servicios para luz, internet y teléfono.", "canal": "push"}],
 "linea_de_tiempo": [{"fecha": "2026-10-31", "tipo": "Ticket", "texto": "Ticket · Estacionamiento C.C. El Tolón · cuota 7 nov", "monto": 4.79}]}
```
- `prestar.motivo` ∈ `null | "no_habilitado" | "modo_recuperacion" | "deuda_vencida"`. `comunicar` puede ser `null`.
- `oferta_quincena`: fecha a la que se puede mover la cuota (o `null`). `progreso` es `null` en Premium o no habilitado.
- `linea_de_tiempo[].tipo` ∈ `Ticket, Pago, Mensaje, Nivel, Comisión, Mora, Recarga` (más reciente primero, máx. 40).
- `premiar[].tipo` ∈ `racha, multiplicador, puntos (trae "puntos"), descuento_nivel (trae "monto"), subida_nivel (trae "nuevo_nivel")`.
- `tickets` es el cupo de movilidad (estacionamiento, parquímetro, peaje); `servicios_cupo` el de facturas (luz, internet, teléfono, seguro).
  `tickets.servicios` sigue listando todo lo que cubre el nivel.
- `club` es el texto del nivel y la ruta del Club ("Viajero · Ruta del Café"); `club_puntos` trae el detalle.
  `club_puntos.puntos_credirecto`: la parte de esos puntos que vino de cuotas de Credirecto.
- `progreso` trae además `ruta_requerida` y `faltan_pts_club`: la ruta del Club que exige el siguiente nivel.
- `beneficios` (motor de beneficios del Club): `{"ruta", "factor" (0–1,5), "pausa", "razones": [{"senal", "efecto", "texto"}],
  "beneficios": [{"tipo": "walletback" | "tickets_gratis", "nombre", "unidad", "base", "personal", "estimado_mes"?}],
  "a_tu_medida": {"tipo", "nombre", "detalle"} | null}`.

### `GET /config` / `PUT /config`  (vista 06)
```json
{"tasa_bs": 380.0, "guardado": {"fecha": "2026-10-28", "por": "Equipo Riesgo"},
 "grupos": [{"titulo": "Pesos del score",
             "campos": [{"clave": "peso_puntualidad", "etiqueta": "Puntualidad", "valor": 40, "unidad": "pts", "tipo": "numero", "paso": 1}]},
            {"titulo": "Requisitos para habilitar",
             "campos": [{"clave": "req_cedula", "etiqueta": "Cédula verificada", "valor": true, "unidad": "", "tipo": "booleano", "paso": null}]}]}
```
`PUT /config` con body `{"valores": {"peso_puntualidad": 35, ...}}` guarda, recalcula a todos y responde igual que `GET`.

### `POST /config/simular`
Body `{"valores": {...}}` (no guarda). Recalcula en memoria niveles y habilitación con esos valores.
```json
{"metricas": [{"metrica": "Mora", "unidad": "pct", "antes": 4.1, "despues": 4.6, "mejor_si_sube": false},
              {"metrica": "Repago a tiempo", "unidad": "pct", "antes": 87.4, "despues": 86.9, "mejor_si_sube": true},
              {"metrica": "Monto prestado", "unidad": "usd", "antes": 9840.0, "despues": 10450.0, "mejor_si_sube": true},
              {"metrica": "Usuarios habilitados", "unidad": "n", "antes": 312, "despues": 340, "mejor_si_sube": true}]}
```

---

## App móvil

### `POST /tickets`  (pantalla 04)
Body `{"user_id": "u_0142", "servicio": "estacionamiento", "monto": 4.0, "comercio": "C.C. Sambil Chacao"}` (monto en USD).
201:
```json
{"ticket": { "...mismo formato que tickets_abiertos[]..." },
 "cubierto_por_credito": 4.0, "pagado_con_saldo": 0.0, "usuario": { "...ficha..." }}
```
409 `detail` legible si: no habilitado, modo recuperación, deuda vencida, servicio no cubierto, máximo de tickets en uso, saldo insuficiente para el excedente.
Si `monto > monto_max`: el ticket cubre `monto_max` y el resto se descuenta de `saldo_wallet`.

### `POST /tickets/{id}/quincena`  (pantalla 05)
Mueve el vencimiento a `oferta_quincena`. 409 si no hay oferta. Responde `{"ticket": {...}, "usuario": {...}}`.

### `POST /pagos`  (pantallas 06 y 08)
Body `{"user_id": "u_0142", "ticket_id": 4433, "monto": 4.79, "origen": "usuario"}` (`origen`: `usuario` | `fallo_tecnico`).
```json
{"aplicado": 4.68, "deuda_restante": 0.0,
 "comprobante": {"referencia": "CD-000418207", "fecha": "2026-11-04", "dias_antes": 3, "anticipado": true,
                 "cuota": 4.36, "gasto_admin": 0.44, "descuento": 0.11, "descuento_pct": 25, "comision": 0.0,
                 "total": 4.68, "ahorro": 0.11, "racha_antes": 2, "racha_despues": 3, "ticket_disponible": true,
                 "puntos_club": 150, "club": "Viajero · Ruta del Café"},
 "ticket": {...}, "usuario": {...}}
```
`fallo_tecnico`: ticket a `pausa_tecnica`, vencimiento +2 días, sin cobro (`comprobante: null`).

### `POST /recargas`  (pantalla 09)
Body `{"user_id": "u_0007", "monto": 10.0}`. Cada recarga paga primero la deuda vencida; lo que sobra va a la wallet.
```json
{"aplicado_a_deuda": 9.25, "a_wallet": 0.75, "deuda_restante": 0.0, "saldo_wallet": 0.75, "usuario": {...}}
```

### `POST /tickets/{id}/disputa`
Pone el ticket en `disputa`. Responde `{"ticket": {...}, "usuario": {...}}`.
