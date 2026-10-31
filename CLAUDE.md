# Credirecto × Ritmo — guía para programar

Este proyecto implementa dos cosas:

1. **App móvil (PagoDirecto)**: 9 pantallas de Credirecto + notificaciones push.
2. **Ritmo**: dashboard web interno (desktop 1440 px) que calcula un Trust Score por usuario y decide a quién habilitar Credirecto, cuántos tickets darle, qué comunicarle y cómo premiarlo.

Los diseños de referencia están en `disenos/`. Implementa las pantallas para que se vean igual que esos archivos.

## Cómo leer los archivos de `disenos/`

Son HTML exportados de una herramienta de diseño. No se ejecutan tal cual:

- Ignora `<script src="./support.js">`, la etiqueta `<x-dc>` y `<helmet>` (dentro de `<helmet>` están la fuente y las clases CSS: úsalas).
- `<sc-if value="{{x}}">` = render condicional. `<sc-for list="{{xs}}" as="x">` = lista.
- `{{nombre}}` = dato dinámico. Sus valores de ejemplo están en el `<script type="text/x-dc" data-dc-script>` al final de cada archivo (método `renderVals()`), junto con la lógica de estado (pestañas, filtros, simulación, reloj de demo).
- Los estilos están en línea (`style="..."`): son la fuente de verdad para tamaños, colores y espaciados.
- `data-props` define variantes de una pantalla (por ejemplo `vista` en el home, `supera_maximo` en el pago, `estado` en el Resumen).

## Sistema visual

### App móvil (copia fiel del estilo PagoDirecto)
- Fuente: **Outfit** (Google Fonts), pesos 400–800.
- Fondo `#F3F4F8`; tarjetas blancas, radio 28 px, sombra `0 8px 28px rgba(21,21,43,.06)`.
- Texto `#15152B`; secundario `#6B6B80`.
- Rosa primario `#FF1F5A` (botones píldora, texto ≥ 18 px bold); botón secundario `#E8EAF0`.
- Credirecto: tarjeta casi negra `#121412`→`#232623` con brillo lima `#C6F432`.
- Wallet: degradado `#FF1F5A` → `#A3165E` → `#3A1350`.
- Positivo `#3B6B00` sobre `#F1FBD2`; negativo `#D6104D` sobre `#FFE3EA`.
- Encabezado: botón circular volver (izq.), título centrado, botón soporte (der.).
- Barra inferior: Home, Movimientos, [mascota al centro, 96 px reservados], Mis pagos, Menú.
- Pantalla base 390 × 844.

### Dashboard Ritmo (plano, sin efectos)
- Misma fuente Outfit. Fondo `#F3F4F8`; tarjetas blancas con borde `1px #E3E5EA`, radio 12 px, **sin sombras ni degradados**.
- Primario `#15152B`; positivo `#3F6212`/`#4D7C0F` sobre `#EEF4E4`; negativo `#B42318` sobre `#FDECEC`; enlaces `#1F4FB8`.
- Menú lateral fijo de 248 px con las 6 vistas; en móvil se apila arriba.
- Montos en USD con equivalente en Bs debajo en gris.

## Reglas de negocio

### Tickets (cómo ve el usuario su crédito)
- **1 ticket = 1 pago a crédito** (un estacionamiento, un peaje, una recarga o una factura).
- El crédito **nunca** se muestra como cupo en bolívares. Los Bs solo aparecen en cuotas y comprobantes.
- Un ticket se renueva cuando el usuario paga su cuota.

| Nivel | Score | Tickets | Máx. por ticket | Servicios |
|---|---|---|---|---|
| Credirecto Inicial | < 40 | 1 | $5 | Estacionamiento |
| Credirecto Básico | 40–59 | 2 | $5 | + parquímetros y peajes |
| Credirecto Confiable | 60–79 | 3 | $10 | + luz, internet y teléfono |
| Credirecto Premium | ≥ 80 | 4 | $20 | + seguros |

- Para **bajar** de nivel, el score debe quedar 5 puntos bajo el umbral (margen).
- Si un pago supera el máximo por ticket: el ticket cubre hasta el máximo y el resto se paga con saldo.
- Los nombres de nivel del Club ("Nivel Turista", rutas, racha) son otra cosa; no mezclarlos.

### Trust Score (0–100)
Puntualidad 40 + Constancia 20 + Antigüedad 15 + Anticipados 15 + Verificación 10 − Fricción (hasta 10). Todos los pesos son configurables.

### Cobros
- Gasto administrativo 10 % de la cuota; descuento por nivel: Confiable 25 %, Premium 50 %.
- Gracia: 2 días sin comisión tras el vencimiento.
- Después: comisión por desfase 5 %, mínimo $0,25.
- Mora desde el día 8 → **modo recuperación**: la app queda limitada a recargar y pagar; cada recarga paga primero la deuda y lo que sobra queda en la wallet; salida de estacionamientos y peajes siguen disponibles.
- Quincena: si el usuario recarga habitualmente los días 15 y 30, se le ofrece mover la cuota a esa fecha.

### Habilitación de Credirecto
Cédula verificada + vehículo verificado + 2 pagos de servicios a tiempo + 30 días en PagoDirecto (todo configurable).

### Premios
Pagar antes del vencimiento: +1 en la racha y puntos ×1,5 en el Club.

## Datos de ejemplo (coherentes en todas las pantallas)
- Tasa: **1 USD = Bs 380**.
- 500 usuarios: 312 habilitados (Inicial 96, Básico 104, Confiable 78, Premium 34) y 188 en espera.
- Usuaria de ejemplo **u_0142 · María**: score 76, Confiable, segmento Puntual, quincena 15 y 30, 2 de 3 tickets disponibles, racha 2 de 3, Club "Caminante · Ruta Colonial".
- Su cuota: Ticket 1 · Estacionamiento C.C. El Tolón · vence 15 nov · Bs 1.821,02 (Bs 1.655,47 + gasto adm. Bs 165,55).

## Índice de pantallas

App (`disenos/app/`): 01 home sin Credirecto (carrusel con checklist) · 02 home habilitado (carrusel con tickets) · 03 detalle (tickets, cuotas/movimientos, camino a Premium, servicios) · 04 pago con ticket · 05 mover cuota a la quincena · 06 comprobante de pago anticipado · 07 racha · 08 período de gracia · 09 modo recuperación · 10 notificaciones push.

Dashboard (`disenos/dashboard/`): 01 Resumen (KPIs, Ritmo vs. regla actual, gráfico semanal) · 02 Cohortes (mapa de calor) · 03 Segmentos y niveles · 04 Decisiones · 05 Usuarios (tabla + ficha) · 06 Configuración (parámetros, simular, reloj de demo).

## Forma de trabajar
- Primero los componentes compartidos (tokens, tarjetas, botones, encabezado, barra inferior, menú lateral), luego pantalla por pantalla.
- Centraliza las reglas de negocio (niveles, score, cobros) en un solo módulo con la configuración, para que la vista Configuración de Ritmo las edite.
- Usa los datos de ejemplo de arriba como mocks hasta que exista el backend.
- Después de cada pantalla, compárala con su archivo en `disenos/`.

---

# Back (Ritmo) · cómo está hecho

El back implementa las reglas de esta guía. Contrato JSON: `API.md`. Cómo correrlo: `README.md`.

## Estructura

```
back/
├── app/
│   ├── main.py            # FastAPI: endpoints de API.md
│   ├── config.py          # TODOS los parámetros; los de la vista Configuración se editan en caliente
│   ├── db.py              # SQLAlchemy (psycopg2), tablas y helpers de lectura/escritura
│   ├── reloj.py           # fecha simulada: nunca se usa datetime.now() en la lógica
│   ├── metricas.py        # consultas de las vistas del dashboard
│   ├── motor/             # funciones puras: score, habilitacion, niveles, segmentos, quincena, cobros, decisiones, perfil
│   └── worker/mora.py     # gracia, comisión, mora; pagos y recargas; simulación de días
├── datos/
│   ├── schema.sql
│   ├── comportamiento.py  # comportamiento determinista de los usuarios sintéticos
│   └── generar.py         # 500 usuarios, historial 1 may – 31 oct 2026, dos mundos
└── tests/                 # casos borde y reglas del motor (sin base de datos)
```

Las funciones de `motor/` son puras: reciben datos y la fecha `hoy`, no tocan la base.

## Reglas implementadas (y decisiones donde la guía no lo decía)

- **Habilitación**: cédula + vehículo + `req_pagos` pagos de servicios a tiempo + `req_dias` días. Configurable.
- **Score**: pesos de la guía. Verificación = 5 por cédula + 5 por vehículo. Fricción = −1 por rechazo de
  fondos y −1 por día de atraso en 90 días, con piso −10. Anticipado = pagar 1+ días antes del vencimiento.
- **Niveles**: por score con margen de 5 para bajar. Además, repagos a tiempo para subir
  (Básico 1, Confiable 3, Premium 10, sacado del "Camino a Premium 5 de 10") y 2 meses para Premium.
- **Cuotas**: cuota = monto + gasto administrativo (10 %). Vencimiento = uso + 7 días; se puede mover a la
  quincena si cae dentro del plazo máximo del nivel. Pagar antes del vencimiento aplica el descuento
  del nivel sobre el gasto administrativo.
- **Atraso**: días 1–2 gracia; día 3 comisión (5 % de la cuota, mín. $0,25, una vez); día 8 mora →
  modo recuperación: no puede pedir crédito, se debita la wallet y cada recarga paga primero la deuda.
  Al saldar, sale del modo recuperación y recupera los tickets de su nivel.
- **Segmentos** (en orden): Sin crédito (no habilitado), En riesgo (deuda vencida, pagó con comisión o
  2+ rechazos en 30 días, o el score cayó 5+ en 7 días), Nuevo (<30 días habilitado), En enfriamiento
  (21+ días sin usar), Conductor diario (movilidad en 4+ días por semana), Puntual (el resto).
- **Mensajes** (uno por día, por prioridad): aviso de mora, comisión, gracia, recordatorio (2 días antes),
  mover a quincena (el día del uso), falta poco para subir (el día que paga y queda a un repago).
  Van por el canal preferido del usuario; el aviso de mora va por push y Wisi.
- **Premios**: racha (pagos a tiempo en la semana, meta 3 → ×1,5), ×1,5 por pagar antes, puntos del
  Club (100 por pago), descuento por nivel, subida de nivel. Usar el crédito no se premia.
- **Regla actual vs. Ritmo**: el generador simula los mismos usuarios con la regla actual (2 tickets,
  7 días, solo estacionamiento, para todos) y guarda sus métricas en `metricas_regla_actual`.
  Ritmo empieza a decidir el 7 sep 2026.
- **Datos sintéticos**: 500 usuarios (u_0001…u_0500); `u_0142` María, `u_0333` Carmen y `u_0007` Pedro
  son de historia y no se mueven solos al avanzar el reloj.
