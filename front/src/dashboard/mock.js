// Datos simulados de Credirecto. SOLO se usan si VITE_MOCK=1 (ver datos.js).
// Respetan exactamente las formas de /API.md y los valores de ejemplo de disenos/dashboard/.
import { ApiError } from '../api.js'

const espera = (ms) => new Promise((r) => setTimeout(r, ms))
const copia = (x) => JSON.parse(JSON.stringify(x))
const r1 = (n) => Math.round(n * 10) / 10
const r2 = (n) => Math.round(n * 100) / 100

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const iso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
const deIso = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d) }
const sumarDias = (s, n) => { const f = deIso(s); f.setDate(f.getDate() + n); return iso(f) }
const corta = (s) => { const f = deIso(s); return `${f.getDate()} ${MESES[f.getMonth()]}` }

// Generador pseudoaleatorio con semilla (mismos datos en cada carga)
function rng(semilla) {
  let a = semilla
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HOY_INICIAL = '2026-10-31'
const NOMBRES_NIVEL = ['Inicial', 'Básico', 'Confiable', 'Premium']
const MAX_NIVEL = [5, 5, 10, 20]
const TICKETS_NIVEL = [1, 2, 3, 4]
const PLAZO_NIVEL = [7, 14, 15, 30]
const SERVICIOS_NIVEL = [
  ['estacionamiento'],
  ['estacionamiento', 'parquimetro', 'peaje'],
  ['estacionamiento', 'parquimetro', 'peaje', 'luz', 'internet', 'telefono'],
  ['estacionamiento', 'parquimetro', 'peaje', 'luz', 'internet', 'telefono', 'seguro'],
]

// ---------------------------------------------------------------- estado del reloj
let estado
function estadoInicial() {
  return {
    hoy: HOY_INICIAL,
    bitacora: [{ fecha: HOY_INICIAL, mensaje: 'Worker listo · 500 scores al día · 0 créditos congelados' }],
    config: null, // se llena con configInicial()
  }
}

// ---------------------------------------------------------------- usuarios (500)
const NOMBRES = ['Luis', 'Andrea', 'Carla', 'Jorge', 'Paola', 'Ricardo', 'Sofía', 'Diego', 'Mariana', 'Héctor', 'Lucía',
  'Óscar', 'Daniela', 'Fernando', 'Isabel', 'Manuel', 'Patricia', 'Alejandro', 'Verónica', 'Samuel', 'Elena', 'Tomás',
  'Natalia', 'Eduardo', 'Rosa', 'Arturo', 'Camila', 'Iván', 'Beatriz', 'Julio', 'Adriana', 'Simón', 'Teresa', 'Gustavo',
  'Mónica', 'Rubén', 'Claudia', 'Wilmer', 'Yelitza', 'Néstor']

// [id, nombre, score, nivel, segmento, usados, total, deuda, días de atraso] (tabla del diseño 05)
const FIJOS = [
  ['u_0142', 'María', 76, 2, 'Puntual', 1, 3, 4.79, 0],
  ['u_0007', 'Pedro', 84, 3, 'Conductor diario', 2, 4, 24.6, 0],
  ['u_0219', 'Ana', 63, 2, 'Conductor diario', 3, 3, 17.2, 0],
  ['u_0415', 'Valentina', 58, 1, 'Puntual', 1, 2, 3.9, 0],
  ['u_0388', 'Daniel', 52, 1, 'Nuevo', 1, 2, 4.1, 0],
  ['u_0056', 'Gabriela', 47, 1, 'En enfriamiento', 0, 2, 0, 0],
  ['u_0271', 'Rafael', 34, 0, 'En riesgo', 1, 1, 5.25, 3],
  ['u_0090', 'Miguel', 29, 0, 'En riesgo', 1, 1, 5.25, 9],
  ['u_0488', 'José', 22, 0, 'Nuevo', 0, 1, 0, 0],
  ['u_0333', 'Carmen', 18, null, 'Sin crédito', 0, 0, 0, 0],
]

function filaUsuario(id, nombre, score, nivel, segmento, usados, total, deuda, atraso) {
  const hab = nivel !== null
  return {
    user_id: id, nombre, trust_score: score, nivel, nivel_nombre: hab ? NOMBRES_NIVEL[nivel] : null,
    segmento, habilitado: hab, tickets_usados: hab ? usados : 0, tickets_total: hab ? total : 0,
    monto_max: hab ? MAX_NIVEL[nivel] : 0, deuda, dias_atraso: atraso, modo_recuperacion: atraso >= 8,
  }
}

function generarUsuarios() {
  const azar = rng(142)
  // Cupos del diseño: 96/104/78/34 por nivel y 60/101/72/41/38 por segmento (suman 312), 188 en espera
  const niveles = [...Array(96).fill(0), ...Array(104).fill(1), ...Array(78).fill(2), ...Array(34).fill(3)]
  const segs = [...Array(60).fill('Conductor diario'), ...Array(101).fill('Puntual'), ...Array(72).fill('Nuevo'),
    ...Array(41).fill('En enfriamiento'), ...Array(38).fill('En riesgo')]
  const quitar = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1) }
  FIJOS.forEach((f) => { if (f[3] !== null) { quitar(niveles, f[3]); quitar(segs, f[4]) } })
  const barajar = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
  barajar(niveles); barajar(segs)

  const fijos = new Map(FIJOS.map((f) => [f[0], f]))
  const libres = []
  for (let i = 1; i <= 500; i++) {
    const id = 'u_' + String(i).padStart(4, '0')
    if (!fijos.has(id)) libres.push(id)
  }
  // Repartimos los 490 ids libres: primero los habilitados que faltan, luego los que esperan
  barajar(libres)
  const resto = libres.map((id, k) => {
    const nombre = NOMBRES[Math.floor(azar() * NOMBRES.length)]
    if (k < niveles.length) {
      const nivel = niveles[k], seg = segs[k]
      const base = [10, 40, 60, 80][nivel], ancho = [30, 20, 20, 18][nivel]
      let score = base + Math.floor(azar() * ancho)
      if (seg === 'En riesgo') score = Math.max(5, score - 6)
      const total = TICKETS_NIVEL[nivel]
      const usados = seg === 'En enfriamiento' ? 0 : Math.floor(azar() * (total + 1))
      let atraso = 0
      if (seg === 'En riesgo') atraso = [0, 2, 4, 9, 12][Math.floor(azar() * 5)]
      const deuda = usados ? r2(usados * (1.5 + azar() * (MAX_NIVEL[nivel] - 1.5)) * 1.1) : 0
      return filaUsuario(id, nombre, score, nivel, seg, usados, total, deuda, usados ? atraso : 0)
    }
    return filaUsuario(id, nombre, 5 + Math.floor(azar() * 40), null, 'Sin crédito', 0, 0, 0, 0)
  })
  // Los del diseño primero (como en el diseño), luego el resto por id
  resto.sort((a, b) => a.user_id.localeCompare(b.user_id))
  return [...FIJOS.map((f) => filaUsuario(...f)), ...resto]
}
const USUARIOS = generarUsuarios()

// ---------------------------------------------------------------- ficha de usuario
const MARIA = {
  user_id: 'u_0142', nombre: 'María', alias: '@maria.r',
  habilitado: true, habilitado_desde: '2026-06-02', cohorte: '2026-06',
  nivel: 2, nivel_nombre: 'Confiable', segmento: 'Puntual', quincena: [15, 30],
  club: 'Caminante · Ruta Colonial', saldo_wallet: 0.0036, modo_recuperacion: false, estado_mora: 'al_dia',
  trust_score: 76,
  razones: [
    { senal: 'puntualidad', nombre: 'Puntualidad', aporte: 38.0, max: 40 },
    { senal: 'constancia', nombre: 'Constancia', aporte: 16.7, max: 20 },
    { senal: 'antiguedad', nombre: 'Antigüedad', aporte: 10.0, max: 15 },
    { senal: 'anticipados', nombre: 'Anticipados', aporte: 4.5, max: 15 },
    { senal: 'verificacion', nombre: 'Verificación', aporte: 10.0, max: 10 },
    { senal: 'friccion', nombre: 'Fricción', aporte: -3.0, max: -10 },
  ],
  checklist: [
    { requisito: 'cedula', nombre: 'Cédula verificada', ok: true, detalle: null },
    { requisito: 'vehiculo', nombre: 'Vehículo verificado', ok: true, detalle: null },
    { requisito: 'pagos', nombre: '2 pagos de servicios a tiempo', ok: true, detalle: '2 de 2' },
    { requisito: 'dias', nombre: '30 días en PagoDirecto', ok: true, detalle: null },
  ],
  tickets: { total: 3, usados: 1, disponibles: 2, monto_max: 10.0, servicios: SERVICIOS_NIVEL[2] },
  progreso: { siguiente_nivel: 3, siguiente_nombre: 'Premium', faltan_puntos: 4, repagos_hechos: 5, repagos_requeridos: 10, faltan_repagos: 5 },
  racha: { pagos: 2, meta: 3, quedan_dias: 4, multiplicador: false },
  deuda_total: 4.79,
  tickets_abiertos: [{
    id: 4433, codigo: '0DFF7B1', servicio: 'estacionamiento', comercio: 'C.C. El Tolón',
    fecha_uso: '2026-10-26', vence: '2026-11-15', estado: 'abierto', dias_atraso: 0,
    monto: 4.36, gasto_admin: 0.44, comision: 0.0, cuota: 4.79, pagado: 0.0, deuda: 4.79,
    descuento_si_anticipa: 0.11, gracia_hasta: '2026-11-17', comision_si_atrasa: 0.25, oferta_quincena: null,
  }],
  decisiones: {
    prestar: { tickets: 2, plazo_dias: 15, monto_max: 10.0, servicios: SERVICIOS_NIVEL[2], motivo: null },
    comunicar: {
      tipo: 'recordatorio', nombre: 'Recordatorio',
      mensaje: 'Tu cuota de Credirecto vence en 2 días. Paga tu cuota y tu ticket vuelve a estar disponible.',
      canal: 'push', fecha: '2026-11-13', oferta_quincena: '2026-11-15',
    },
    premiar: [
      { tipo: 'racha', detalle: 'Racha +1' },
      { tipo: 'multiplicador', detalle: 'puntos ×1,5' },
      { tipo: 'descuento_nivel', detalle: '−25 % gasto administrativo', monto: 0.11 },
    ],
  },
  notificaciones: [{ fecha: '2026-10-20', tipo: 'subida_nivel', titulo: 'Nuevo nivel', mensaje: '¡Subiste a Credirecto Confiable! Ahora tienes 3 tickets y puedes pagar luz e internet.', canal: 'push' }],
  linea_de_tiempo: [
    { fecha: '2026-10-26', tipo: 'Ticket', texto: 'Ticket 1 · Estacionamiento C.C. El Tolón · cuota 15 nov', monto: 4.79 },
    { fecha: '2026-10-20', tipo: 'Mensaje', texto: 'Push: «¡Subiste a Credirecto Confiable! Ahora tienes 3 tickets y puedes pagar luz e internet.»', monto: null },
    { fecha: '2026-10-20', tipo: 'Nivel', texto: 'Básico → Confiable (score 61) · de 2 a 3 tickets', monto: null },
    { fecha: '2026-10-12', tipo: 'Pago', texto: 'Cuota pagada 3 días antes · ticket renovado · racha +1', monto: 4.5 },
    { fecha: '2026-10-10', tipo: 'Mensaje', texto: 'Push: «Paga tu cuota y tu ticket vuelve a estar disponible.»', monto: null },
    { fecha: '2026-10-03', tipo: 'Ticket', texto: 'Ticket 2 · Peaje Tazón', monto: 4.5 },
    { fecha: '2026-09-30', tipo: 'Pago', texto: 'Cuota pagada el día de cobro · ticket renovado', monto: 4.2 },
  ],
}

// Ficha genérica coherente con la fila de la tabla
function fichaGenerica(u) {
  const azar = rng(parseInt(u.user_id.slice(2), 10))
  const hab = u.habilitado
  const nivel = u.nivel
  const friccion = hab ? (u.dias_atraso > 0 ? -6 : -2) : -1
  const factor = Math.min(1, (u.trust_score - friccion) / 100)
  const pesos = [['puntualidad', 'Puntualidad', 40], ['constancia', 'Constancia', 20], ['antiguedad', 'Antigüedad', 15],
    ['anticipados', 'Anticipados', 15], ['verificacion', 'Verificación', 10]]
  const razones = pesos.map(([senal, nombre, max]) => ({ senal, nombre, aporte: r1(max * factor), max }))
  razones.push({ senal: 'friccion', nombre: 'Fricción', aporte: friccion, max: -10 })

  const pagosOk = hab ? 2 : Math.floor(azar() * 3)
  const checklist = [
    { requisito: 'cedula', nombre: 'Cédula verificada', ok: hab || azar() > 0.15, detalle: null },
    { requisito: 'vehiculo', nombre: hab ? 'Vehículo verificado' : 'Verifica tu vehículo', ok: hab || azar() > 0.5, detalle: null },
    { requisito: 'pagos', nombre: '2 pagos de servicios a tiempo', ok: pagosOk >= 2, detalle: `${Math.min(pagosOk, 2)} de 2` },
    { requisito: 'dias', nombre: '30 días en PagoDirecto', ok: hab || azar() > 0.1, detalle: null },
  ]
  const disponibles = hab ? u.tickets_total - u.tickets_usados : 0
  const progreso = hab && nivel < 3 ? (() => {
    const umbral = [40, 60, 80][nivel]
    const req = [3, 6, 10][nivel]
    const hechos = Math.min(req, Math.floor(azar() * (req + 1)))
    return { siguiente_nivel: nivel + 1, siguiente_nombre: NOMBRES_NIVEL[nivel + 1], faltan_puntos: Math.max(0, umbral - u.trust_score),
      repagos_hechos: hechos, repagos_requeridos: req, faltan_repagos: req - hechos }
  })() : null

  const vence = sumarDias(HOY_INICIAL, 3 + Math.floor(azar() * 10) - (u.dias_atraso ? 10 + u.dias_atraso : 0))
  const abiertos = u.deuda > 0 ? [{
    id: 1000 + parseInt(u.user_id.slice(2), 10), codigo: Math.floor(azar() * 0xFFFFFFF).toString(16).toUpperCase(),
    servicio: 'estacionamiento', comercio: 'C.C. Sambil Chacao', fecha_uso: sumarDias(vence, -(PLAZO_NIVEL[nivel] || 7)), vence,
    estado: u.dias_atraso >= 8 ? 'mora' : u.dias_atraso >= 3 ? 'atrasado' : u.dias_atraso > 0 ? 'gracia' : 'abierto',
    dias_atraso: u.dias_atraso, monto: r2(u.deuda / 1.1), gasto_admin: r2(u.deuda - u.deuda / 1.1), comision: u.dias_atraso >= 3 ? 0.25 : 0,
    cuota: u.deuda, pagado: 0, deuda: u.deuda, descuento_si_anticipa: 0, gracia_hasta: sumarDias(vence, 2), comision_si_atrasa: 0.25, oferta_quincena: null,
  }] : []

  let motivo = null
  if (!hab) motivo = 'no_habilitado'
  else if (u.modo_recuperacion) motivo = 'modo_recuperacion'
  else if (u.dias_atraso >= 3) motivo = 'deuda_vencida'

  const comunicar = !hab
    ? { tipo: 'falta_poco', nombre: 'Falta poco', mensaje: 'Verifica tu vehículo y activa Credirecto.', canal: 'push', fecha: sumarDias(HOY_INICIAL, 1), oferta_quincena: null }
    : u.modo_recuperacion
      ? { tipo: 'aviso_mora', nombre: 'Aviso de mora', mensaje: 'Recarga tu wallet para salir del modo recuperación.', canal: 'wisi', fecha: HOY_INICIAL, oferta_quincena: null }
      : abiertos.length
        ? { tipo: 'recordatorio', nombre: 'Recordatorio', mensaje: 'Tu cuota de Credirecto vence en 2 días.', canal: 'push', fecha: sumarDias(vence, -2), oferta_quincena: null }
        : null

  const premiar = hab && !motivo && abiertos.length
    ? [{ tipo: 'racha', detalle: 'Racha +1' }, ...(nivel >= 2 ? [{ tipo: 'descuento_nivel', detalle: `−${nivel === 3 ? 50 : 25} % gasto administrativo`, monto: 0.1 }] : [])]
    : []

  const linea = []
  if (abiertos.length) linea.push({ fecha: abiertos[0].fecha_uso, tipo: 'Ticket', texto: `Ticket · Estacionamiento C.C. Sambil Chacao · cuota ${corta(vence)}`, monto: u.deuda })
  if (u.modo_recuperacion) linea.unshift({ fecha: sumarDias(vence, 8), tipo: 'Mora', texto: 'Entró en modo recuperación', monto: null })
  if (hab) linea.push({ fecha: '2026-10-05', tipo: 'Pago', texto: 'Cuota pagada · ticket renovado', monto: 3.8 })
  linea.push({ fecha: '2026-09-15', tipo: hab ? 'Nivel' : 'Mensaje', texto: hab ? `Habilitado en Credirecto ${NOMBRES_NIVEL[0]}` : 'Push: «Te falta poco para activar Credirecto.»', monto: null })

  return {
    user_id: u.user_id, nombre: u.nombre, alias: '@' + u.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + u.user_id.slice(-2),
    habilitado: hab, habilitado_desde: hab ? '2026-07-14' : null, cohorte: hab ? '2026-07' : null,
    nivel, nivel_nombre: u.nivel_nombre, segmento: u.segmento, quincena: azar() > 0.6 ? [15, 30] : [],
    club: 'Turista · Ruta Centro', saldo_wallet: 0, modo_recuperacion: u.modo_recuperacion,
    estado_mora: u.modo_recuperacion ? 'mora' : u.dias_atraso >= 3 ? 'atrasado' : u.dias_atraso > 0 ? 'gracia' : 'al_dia',
    trust_score: u.trust_score, razones, checklist,
    tickets: { total: u.tickets_total, usados: u.tickets_usados, disponibles, monto_max: u.monto_max, servicios: hab ? SERVICIOS_NIVEL[nivel] : [] },
    progreso, racha: { pagos: hab ? Math.floor(azar() * 3) : 0, meta: 3, quedan_dias: 5, multiplicador: false },
    deuda_total: u.deuda, tickets_abiertos: abiertos,
    decisiones: {
      prestar: { tickets: motivo ? 0 : disponibles, plazo_dias: hab ? PLAZO_NIVEL[nivel] : 0, monto_max: hab ? u.monto_max : 0,
        servicios: hab && !motivo ? SERVICIOS_NIVEL[nivel] : [], motivo },
      comunicar, premiar,
    },
    notificaciones: [], linea_de_tiempo: linea,
  }
}

// ---------------------------------------------------------------- vistas del dashboard
const REP = [76, 77.5, 78.6, 79.2, 81, 82.4, 84.1, 85, 85.9, 86.8, 86.2, 87.4]
const MORA = [10.2, 9.8, 9.3, 8.6, 7.4, 6.6, 5.9, 5.2, 4.8, 4.4, 4.0, 4.1]

function resumen() {
  const hoy = estado.hoy
  const semanal = REP.map((rep, i) => {
    const desde = sumarDias(hoy, -6 - 7 * (11 - i))
    return { desde, etiqueta: corta(desde), repago_a_tiempo: rep, mora: MORA[i] }
  })
  return {
    hoy, desde: semanal[0].desde, ritmo_desde: '2026-09-07', hay_datos: true,
    kpis: {
      usuarios_totales: 500, habilitados: 312, en_espera: 188, pct_habilitados: 62.4,
      monto_prestado: 9840.0, repago_a_tiempo: 87.4, repago_delta_pp: 1.2, mora: 4.1, mora_delta_pp: 0.1,
      comisiones: 412.0, reuso: 71.0, perdida_esperada: 403.0,
    },
    comparativo: [
      { metrica: 'Repago a tiempo', unidad: 'pct', regla_actual: 74.2, ritmo: 87.4, mejor_si_sube: true },
      { metrica: 'Mora', unidad: 'pct', regla_actual: 11.8, ritmo: 4.1, mejor_si_sube: false },
      { metrica: 'Monto prestado', unidad: 'usd', regla_actual: 7120.0, ritmo: 9840.0, mejor_si_sube: true },
      { metrica: 'Reuso', unidad: 'pct', regla_actual: 52.0, ritmo: 71.0, mejor_si_sube: true },
      { metrica: 'Pérdida esperada', unidad: 'usd', regla_actual: 840.0, ritmo: 403.0, mejor_si_sube: false },
      { metrica: 'Comisiones cobradas', unidad: 'usd', regla_actual: 604.0, ritmo: 412.0, mejor_si_sube: true },
      { metrica: 'Usuarios habilitados', unidad: 'n', regla_actual: 500, ritmo: 312, mejor_si_sube: true },
    ],
    semanal,
  }
}

function cohortes() {
  // Misma fórmula que el diseño 02 para que el mapa se vea igual
  const coh = [
    ['2026-05', 'May 2026', 58, 12, 71, 61], ['2026-06', 'Jun 2026', 54, 12, 73, 63], ['2026-07', 'Jul 2026', 49, 12, 75, 64],
    ['2026-08', 'Ago 2026', 52, 12, 78, 67], ['2026-09', 'Sep 2026', 57, 8, 85, 76], ['2026-10', 'Oct 2026', 42, 4, 88, 80],
  ]
  const val = (m, rb, ub, w, ci) => {
    const jit = ((ci * 7 + w * 3) % 5) * 0.4 - 0.8
    if (m === 'rep') return r1(Math.min(96, rb + w * (ci >= 4 ? 0.6 : 0.9) + (w > 5 && ci < 4 ? 2.5 : 0) + jit))
    return r1(Math.max(28, ub - w * (ci >= 4 ? 1.6 : 2.6) + jit))
  }
  const lista = coh.map(([cohorte, etiqueta, usuarios, nSem, rb, ub], ci) => ({
    cohorte, etiqueta, usuarios,
    semanas: Array.from({ length: 12 }, (_, i) => {
      const w = i + 1
      return w > nSem
        ? { semana: w, repago_a_tiempo: null, reuso: null }
        : { semana: w, repago_a_tiempo: val('rep', rb, ub, w, ci), reuso: val('reu', rb, ub, w, ci) }
    }),
  }))
  const extremo = (campo, mejor) => {
    const s4 = lista.map((c) => ({ etiqueta: c.etiqueta, valor: c.semanas[3][campo] })).sort((a, b) => b.valor - a.valor)
    const x = mejor ? s4[0] : s4[s4.length - 1]
    return { etiqueta: x.etiqueta, valor: Math.round(x.valor) }
  }
  return {
    hoy: estado.hoy, semanas: 12, habilitados: 312, ritmo_desde: '2026-09-07', cohortes: lista,
    mejor_semana4: { repago_a_tiempo: extremo('repago_a_tiempo', true), reuso: extremo('reuso', true) },
    peor_semana4: { repago_a_tiempo: extremo('repago_a_tiempo', false), reuso: extremo('reuso', false) },
  }
}

function segmentos() {
  const L = [
    [0, 'score < 40', 96, 'Estacionamiento'], [1, '40 – 59', 104, '+ parquímetros y peajes'],
    [2, '60 – 79', 78, '+ luz, internet y teléfono'], [3, '≥ 80', 34, '+ seguros'],
  ]
  return {
    hoy: estado.hoy, habilitados: 312, total: 500, margen_bajada: 5,
    niveles: L.map(([nivel, rango, usuarios, texto]) => ({
      nivel, nombre: 'Credirecto ' + NOMBRES_NIVEL[nivel], rango, usuarios, tickets: TICKETS_NIVEL[nivel],
      monto_max: MAX_NIVEL[nivel], servicios: SERVICIOS_NIVEL[nivel], servicios_texto: texto,
    })),
    segmentos: [
      { segmento: 'Conductor diario', descripcion: 'paga estacionamiento 4+ días por semana', usuarios: 60 },
      { segmento: 'Puntual', descripcion: 'paga antes o el día de cobro', usuarios: 101 },
      { segmento: 'Nuevo', descripcion: 'menos de 30 días con crédito', usuarios: 72 },
      { segmento: 'En enfriamiento', descripcion: 'sin usar el crédito en 21+ días', usuarios: 41 },
      { segmento: 'En riesgo', descripcion: 'atraso o score cayendo', usuarios: 38 },
      { segmento: 'Sin crédito', descripcion: 'aún no habilitados', usuarios: 188 },
    ],
    semana: {
      desde: sumarDias(estado.hoy, -6), hasta: estado.hoy, subieron: 41, bajaron: 12,
      movimientos: [
        { de: 'Inicial', a: 'Básico', usuarios: 19, sube: true }, { de: 'Básico', a: 'Confiable', usuarios: 15, sube: true },
        { de: 'Confiable', a: 'Premium', usuarios: 7, sube: true }, { de: 'Premium', a: 'Confiable', usuarios: 2, sube: false },
        { de: 'Confiable', a: 'Básico', usuarios: 4, sube: false }, { de: 'Básico', a: 'Inicial', usuarios: 6, sube: false },
      ],
    },
  }
}

function decisiones() {
  const M = [
    ['recordatorio', 'Recordatorio', '2 días antes, a su hora habitual', 298, 114, 78],
    ['mover_quincena', 'Mover a quincena', 'cuota cae lejos de su recarga', 61, 25, 64],
    ['gracia', 'Gracia', 'día 1 después del vencimiento', 30, 24, 71],
    ['comision', 'Comisión', 'al aplicar el 5 % por desfase', 12, 19, 58],
    ['aviso_mora', 'Aviso de mora', 'día 8, entra en modo recuperación', 6, 12, 39],
    ['falta_poco', 'Falta poco para subir', 'a 1 repago de ganar un ticket más', 60, 13, 83],
  ]
  return {
    desde: sumarDias(estado.hoy, -6), hasta: estado.hoy,
    solicitudes: {
      total: 1284, aprobadas: 1046, parciales: 142, rechazadas: 96,
      motivos: [
        { motivo: 'Sin tickets disponibles', usuarios: 38 }, { motivo: 'Servicio no cubierto por su nivel', usuarios: 27 },
        { motivo: 'Máximo de tickets en uso', usuarios: 19 }, { motivo: 'Deuda vencida', usuarios: 12 },
      ],
    },
    habilitaciones: {
      semana: 23,
      recientes: [
        { user_id: 'u_0488', nombre: 'José', fecha: '2026-10-31', nivel: 0 }, { user_id: 'u_0311', nombre: 'Andrea', fecha: '2026-10-30', nivel: 0 },
        { user_id: 'u_0457', nombre: 'Luis', fecha: '2026-10-29', nivel: 1 }, { user_id: 'u_0102', nombre: 'Carla', fecha: '2026-10-27', nivel: 0 },
      ],
    },
    en_espera: {
      total: 188,
      faltantes: [
        { requisito: 'Verificar su vehículo', usuarios: 81 }, { requisito: 'Hacer 2 pagos de servicios a tiempo', usuarios: 64 },
        { requisito: 'Verificar su cédula', usuarios: 27 }, { requisito: 'Menos de 30 días en PagoDirecto', usuarios: 16 },
      ],
    },
    mensajes: {
      enviados: 674, pct_pagan_48h: 81.0,
      por_tipo: M.map(([tipo, nombre, descripcion, push, wisi, p]) => ({ tipo, nombre, descripcion, push, wisi, total: push + wisi, pct_pagan_48h: p })),
    },
    premios: { rachas: 167, multiplicadores: 94, puntos: 48300, descuentos: 212, descuentos_monto: 96.4 },
  }
}

// ---------------------------------------------------------------- configuración
function configInicial() {
  const n = (clave, etiqueta, valor, unidad, paso = 1) => ({ clave, etiqueta, valor, unidad, tipo: 'numero', paso })
  const b = (clave, etiqueta, valor) => ({ clave, etiqueta, valor, unidad: '', tipo: 'booleano', paso: null })
  return {
    tasa_bs: 380.0, guardado: { fecha: '2026-10-28', por: 'Equipo Riesgo' },
    grupos: [
      { titulo: 'Pesos del score', campos: [n('peso_puntualidad', 'Puntualidad', 40, 'pts'), n('peso_constancia', 'Constancia', 20, 'pts'),
        n('peso_antiguedad', 'Antigüedad', 15, 'pts'), n('peso_anticipados', 'Anticipados', 15, 'pts'),
        n('peso_verificacion', 'Verificación', 10, 'pts'), n('peso_friccion', 'Fricción máxima', -10, 'pts')] },
      { titulo: 'Umbrales de nivel', campos: [n('umbral_basico', 'Básico desde', 40, 'pts'), n('umbral_confiable', 'Confiable desde', 60, 'pts'),
        n('umbral_premium', 'Premium desde', 80, 'pts'), n('margen_bajada', 'Margen para bajar', 5, 'pts')] },
      { titulo: 'Tickets por nivel', campos: [n('tickets_inicial', 'Inicial', 1, ''), n('tickets_basico', 'Básico', 2, ''),
        n('tickets_confiable', 'Confiable', 3, ''), n('tickets_premium', 'Premium', 4, '')] },
      { titulo: 'Máximo por ticket', campos: [n('max_inicial', 'Inicial', 5, 'USD'), n('max_basico', 'Básico', 5, 'USD'),
        n('max_confiable', 'Confiable', 10, 'USD'), n('max_premium', 'Premium', 20, 'USD')] },
      { titulo: 'Plazos máximos', campos: [n('plazo_inicial', 'Inicial', 7, 'días'), n('plazo_basico', 'Básico', 14, 'días'),
        n('plazo_confiable', 'Confiable', 15, 'días'), n('plazo_premium', 'Premium', 30, 'días')] },
      { titulo: 'Cobros y mora', campos: [n('gracia_dias', 'Gracia sin comisión', 2, 'días'), n('gasto_admin_pct', 'Gasto administrativo', 10, '%'),
        n('descuento_confiable', 'Descuento Confiable', 25, '%'), n('descuento_premium', 'Descuento Premium', 50, '%'),
        n('comision_pct', 'Comisión por desfase', 5, '%'), n('comision_min', 'Comisión mínima', 0.25, 'USD', 0.05),
        n('mora_dia', 'Inicio de mora, día', 8, '')] },
      { titulo: 'Requisitos para habilitar', campos: [b('req_cedula', 'Cédula verificada', true), b('req_vehiculo', 'Vehículo verificado', true),
        n('req_pagos', 'Pagos de servicios a tiempo', 2, ''), n('req_dias', 'Días en PagoDirecto', 30, 'días')] },
      { titulo: 'Datos de la prueba', campos: [n('pct_quinceneros', 'Usuarios «quinceneros»', 35, '%')] },
    ],
  }
}
const valoresDe = (cfg) => Object.fromEntries(cfg.grupos.flatMap((g) => g.campos.map((c) => [c.clave, c.valor])))

// Modelo de juguete del diseño 06 para que "Simular" responda algo con sentido
function calcular(v) {
  const dm = (v.gracia_dias - 2) * -0.3 + (v.mora_dia - 8) * 0.15 + (v.tickets_confiable * v.max_confiable - 30) * 0.04
    + (v.tickets_premium * v.max_premium - 80) * 0.01 + (v.umbral_premium - 80) * -0.05 + (v.req_pagos - 2) * -0.6
    + (v.req_vehiculo ? 0 : 1.2) + (v.comision_pct - 5) * -0.1
  const mora = Math.max(0.5, 4.1 + dm)
  const rep = Math.min(99, 87.4 - dm * 1.4 + (v.pct_quinceneros - 35) * 0.05)
  const hab = Math.max(0, Math.min(500, Math.round(312 + (2 - v.req_pagos) * 40 + (v.req_vehiculo ? 0 : 81) + (v.req_cedula ? 0 : 27) + (30 - v.req_dias) * 0.5)))
  const prest = 9840 * (1 + (v.tickets_confiable * v.max_confiable - 30) * 0.012 + (v.tickets_premium * v.max_premium - 80) * 0.003
    + (v.tickets_basico * v.max_basico - 10) * 0.01) * (hab / 312)
  return { mora: r1(mora), rep: r1(rep), hab, prest: Math.round(prest) }
}

function validar(valores) {
  for (const [k, v] of Object.entries(valores || {})) {
    if (typeof v === 'number' && !Number.isFinite(v)) throw new ApiError(422, `El valor de «${k}» no es válido.`)
  }
}

// ---------------------------------------------------------------- API simulada
estado = estadoInicial()
estado.config = configInicial()

export const mockApi = {
  salud: async () => { await espera(80); return { ok: true, hoy: estado.hoy, tasa_bs: 380.0 } },
  reloj: async () => { await espera(150); return copia({ hoy: estado.hoy, bitacora: estado.bitacora.slice(0, 30) }) },
  simularDia: async (dias = 1) => {
    if (dias < 1 || dias > 60) throw new ApiError(422, 'Los días deben estar entre 1 y 60.')
    await espera(500 + dias * 60)
    const desde = estado.hoy
    const nuevas = []
    const tot = { solicitudes: 0, tickets: 0, pagos: 0, comisiones: 0, nuevas_moras: 0, congelados: 0, habilitados: 0, subieron_nivel: 0, bajaron_nivel: 0 }
    for (let i = 1; i <= dias; i++) {
      estado.hoy = sumarDias(estado.hoy, 1)
      const d = (deIso(estado.hoy) - deIso(HOY_INICIAL)) / 86400000
      const com = (d * 3) % 5 + 1, cong = d % 3 === 0 ? 1 : 0, hab = (d * 2) % 4, up = (d * 5) % 7
      tot.solicitudes += 120; tot.tickets += 98; tot.pagos += 87; tot.comisiones += com; tot.congelados += cong
      tot.nuevas_moras += cong; tot.habilitados += hab; tot.subieron_nivel += up; tot.bajaron_nivel += d % 2
      nuevas.unshift({ fecha: estado.hoy, mensaje: `Comisiones aplicadas: ${com} · tickets congelados: ${cong} · 500 scores recalculados (${up} suben de nivel) · usuarios habilitados: ${hab}` })
    }
    estado.bitacora = [...nuevas, ...estado.bitacora].slice(0, 30)
    return copia({ desde, hoy: estado.hoy, dias, totales: tot, bitacora: nuevas, cambios: [] })
  },
  reset: async () => {
    await espera(3000) // el real tarda ~1 min
    const cfg = configInicial()
    estado = estadoInicial()
    estado.config = cfg
    return { hoy: estado.hoy, usuarios: 500, tickets: 4321, eventos: 30000, segundos: 3.0 }
  },

  resumen: async () => { await espera(400); return copia(resumen()) },
  cohortes: async () => { await espera(400); return copia(cohortes()) },
  segmentos: async () => { await espera(300); return copia(segmentos()) },
  decisiones: async () => { await espera(300); return copia(decisiones()) },
  usuarios: async ({ q, nivel, segmento, limit = 50, offset = 0 } = {}) => {
    await espera(250)
    const t = (q || '').trim().toLowerCase()
    const lista = USUARIOS.filter((u) => (!t || u.user_id.includes(t) || u.nombre.toLowerCase().includes(t))
      && (nivel === undefined || nivel === null || nivel === '' || (nivel === 'espera' ? !u.habilitado : u.nivel === Number(nivel)))
      && (!segmento || u.segmento === segmento))
    return copia({ total: lista.length, usuarios: lista.slice(Number(offset), Number(offset) + Number(limit)) })
  },
  usuario: async (id) => {
    await espera(250)
    if (id === 'u_0142') return copia(MARIA)
    const u = USUARIOS.find((x) => x.user_id === id)
    if (!u) throw new ApiError(404, `No existe el usuario ${id}.`)
    return copia(fichaGenerica(u))
  },
  config: async () => { await espera(250); return copia(estado.config) },
  guardarConfig: async (valores) => {
    validar(valores)
    await espera(900)
    estado.config.grupos.forEach((g) => g.campos.forEach((c) => { if (c.clave in valores) c.valor = valores[c.clave] }))
    estado.config.guardado = { fecha: estado.hoy, por: 'Equipo Riesgo' }
    return copia(estado.config)
  },
  simularConfig: async (valores) => {
    validar(valores)
    await espera(900)
    const a = calcular(valoresDe(estado.config))
    const b = calcular({ ...valoresDe(estado.config), ...valores })
    return {
      metricas: [
        { metrica: 'Mora', unidad: 'pct', antes: a.mora, despues: b.mora, mejor_si_sube: false },
        { metrica: 'Repago a tiempo', unidad: 'pct', antes: a.rep, despues: b.rep, mejor_si_sube: true },
        { metrica: 'Monto prestado', unidad: 'usd', antes: a.prest, despues: b.prest, mejor_si_sube: true },
        { metrica: 'Usuarios habilitados', unidad: 'n', antes: a.hab, despues: b.hab, mejor_si_sube: true },
      ],
    }
  },
}
