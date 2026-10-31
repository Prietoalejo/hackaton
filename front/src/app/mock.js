// Datos simulados de la app mientras el backend no responde con el contrato de API.md.
// Solo se usan si VITE_MOCK=1 (ver datos.js). Las fichas respetan la forma exacta de GET /usuarios/{id}
// y las respuestas imitan POST /tickets, /tickets/{id}/quincena, /pagos y /recargas.
import { ApiError } from '../api.js'
import { NIVELES } from '../formato.js'
import { diasEntre, sumarDias } from './util.js'

const TASA = 380
let hoy = '2026-10-31'
let siguienteId = 5000
let siguienteRef = 418207

// Redondeo a 6 decimales: evita ruido de coma flotante sin perder céntimos de Bs
const rd = (n) => Math.round(n * 1e6) / 1e6
const clonar = (x) => JSON.parse(JSON.stringify(x))
const esperar = (ms = 180) => new Promise((ok) => setTimeout(ok, ms))
const codigo = () => Math.random().toString(16).slice(2, 9).toUpperCase().padEnd(7, '0')

// tickets = movilidad; servicios_cupo = pagos de facturas (luz, internet, teléfono, seguros)
const NIVEL_CONF = [
  { tickets: 1, servicios_cupo: 0, monto_max: 5, servicios: ['estacionamiento'], descuento: 0 },
  { tickets: 2, servicios_cupo: 0, monto_max: 5, servicios: ['estacionamiento', 'parquimetro', 'peaje'], descuento: 0 },
  { tickets: 3, servicios_cupo: 1, monto_max: 10, servicios: ['estacionamiento', 'parquimetro', 'peaje', 'luz', 'internet', 'telefono'], descuento: 25 },
  { tickets: 5, servicios_cupo: 3, monto_max: 20, servicios: ['estacionamiento', 'parquimetro', 'peaje', 'luz', 'internet', 'telefono', 'seguro'], descuento: 50 },
]
const FACTURAS = ['luz', 'internet', 'telefono', 'seguro']
const esFactura = (s) => FACTURAS.includes(s)
const PUNTOS_POR_PAGO = 100
// Rutas del Club (igual que C.RUTAS_CLUB del back) y el nivel de Credirecto que permite cada una
const RUTAS_CLUB = [
  ['Turista', 'Ruta Colonial', 0, 1.0, 0, 0], ['Caminante', 'Ruta Falcón', 1000, 1.5, 1, 1],
  ['Viajero', 'Ruta del Café', 4000, 2.0, 1, 2], ['Conocedor', 'Ruta de Paria', 11000, 2.5, 2, 3],
  ['Explorador', 'Ruta de Los Llanos', 24000, 3.0, 2, 3], ['Trotamundo', 'Ruta Andina', 45000, 3.5, 3, 3],
  ['Baqueano', 'Ruta del Zulia', 76000, 4.0, 4, 3],
]
/** club_puntos completo a partir del texto "Viajero · Ruta del Café" del perfil */
function clubDe(p) {
  const n = Math.max(0, RUTAS_CLUB.findIndex(([nivel]) => (p.club || '').startsWith(nivel)))
  const [nivel, ruta, desde] = RUTAS_CLUB[n]
  const sig = RUTAS_CLUB[n + 1]
  const puntos = p.puntos_club ?? Math.min(desde + 800, sig ? sig[2] - 1 : desde + 800)
  const credirecto = p.puntos_credirecto ?? 0
  const bonos = n * 500
  return {
    nombre: 'Club PagoDirecto', nivel_club: n, nivel_nombre: nivel, ruta, texto: `${nivel} · ${ruta}`, puntos,
    puntos_credirecto: credirecto, puntos_por_pago: PUNTOS_POR_PAGO, multiplicador: 1.5, bono_ruta: 500,
    siguiente: sig ? { nivel_club: n + 1, nivel_nombre: sig[0], ruta: sig[1], desde: sig[2], faltan: sig[2] - puntos } : null,
    desglose: { servicios: Math.max(0, puntos - credirecto - bonos), credirecto, rutas: bonos },
    rutas: RUTAS_CLUB.map(([nv, rt, ds, wb, tg, cn], i) => ({
      nivel_club: i, nivel_nombre: nv, ruta: rt, desde: ds, walletback_pct: wb, tickets_gratis: tg, credirecto_nivel: cn,
      estado: i < n ? 'completada' : i === n ? 'actual' : 'bloqueada',
    })),
  }
}
const MONTO_MIN_PREMIO = 0.5 // USD: cuotas menores no suman puntos, racha ni repagos (igual que el back)
const NOMBRE_SERV = {
  estacionamiento: 'Estacionamiento', parquimetro: 'Parquímetro', peaje: 'Peaje', luz: 'Luz',
  internet: 'Internet', telefono: 'Teléfono', seguro: 'Seguro',
}
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const corta = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MESES[m - 1]}` }

// Igual que config.ofrecer_quincena del back: apagado, la cuota vence en su fecha
const OFRECER_QUINCENA = false

/** Próxima fecha de quincena después del vencimiento (máx. 10 días) o null */
function ofertaQuincena(quincena, vence) {
  if (!OFRECER_QUINCENA || !quincena?.length) return null
  for (let i = 0; i <= 10; i++) {
    const f = sumarDias(vence, i)
    const [a, m, d] = f.split('-').map(Number)
    const ultimo = new Date(a, m, 0).getDate()
    if (quincena.some((q) => Math.min(q, ultimo) === d)) return i === 0 ? null : f
  }
  return null
}

/** Crea un ticket con la forma de tickets_abiertos[] */
function nuevoTicket({ id, codigo: cod, servicio, comercio, fecha_uso, vence, monto, nivel, quincena }) {
  const gasto = rd(monto * 0.1)
  const cuota = rd(monto + gasto)
  const desc = NIVEL_CONF[nivel ?? 0].descuento
  return {
    id, codigo: cod || codigo(), servicio, comercio, fecha_uso, vence, estado: 'abierto', dias_atraso: 0,
    monto: rd(monto), gasto_admin: gasto, comision: 0.0, cuota, pagado: 0.0, deuda: cuota,
    descuento_si_anticipa: rd(gasto * desc / 100), gracia_hasta: sumarDias(vence, 2),
    comision_si_atrasa: rd(Math.max(0.25, cuota * 0.05)), oferta_quincena: ofertaQuincena(quincena, vence),
  }
}

/** Ficha base con todos los campos del contrato */
function ficha(p) {
  const conf = p.nivel === null ? null : NIVEL_CONF[p.nivel]
  return {
    user_id: p.user_id, nombre: p.nombre, alias: p.alias,
    habilitado: p.nivel !== null, habilitado_desde: p.habilitado_desde ?? null, cohorte: p.cohorte,
    nivel: p.nivel, nivel_nombre: p.nivel === null ? null : NIVELES[p.nivel], segmento: p.segmento,
    quincena: p.quincena, club: p.club, saldo_wallet: p.saldo_wallet ?? 0.0036,
    modo_recuperacion: false, estado_mora: 'al_dia', trust_score: p.trust_score,
    razones: p.razones,
    checklist: p.checklist,
    tickets: conf
      ? { total: conf.tickets, usados: 0, disponibles: conf.tickets, monto_max: conf.monto_max, servicios: [...conf.servicios] }
      : { total: 0, usados: 0, disponibles: 0, monto_max: 0, servicios: [] },
    servicios_cupo: conf
      ? { total: conf.servicios_cupo, usados: 0, disponibles: conf.servicios_cupo, cubre: conf.servicios.filter(esFactura) }
      : { total: 0, usados: 0, disponibles: 0, cubre: [] },
    club_puntos: clubDe(p),
    beneficios: p.beneficios ?? null,
    progreso: p.progreso ?? null,
    racha: p.racha,
    deuda_total: 0,
    tickets_abiertos: p.tickets_abiertos || [],
    decisiones: {
      prestar: conf
        ? { tickets: conf.tickets, servicios_cupo: conf.servicios_cupo, plazo_dias: p.plazo_dias ?? 7, monto_max: conf.monto_max, servicios: [...conf.servicios], motivo: null }
        : { tickets: 0, servicios_cupo: 0, plazo_dias: 0, monto_max: 0, servicios: [], motivo: 'no_habilitado' },
      comunicar: p.comunicar ?? null,
      premiar: p.premiar ?? [],
    },
    notificaciones: p.notificaciones || [],
    linea_de_tiempo: p.linea_de_tiempo || [],
  }
}

const razones = (p, c, a, an, v, f) => [
  { senal: 'puntualidad', nombre: 'Puntualidad', aporte: p, max: 40 },
  { senal: 'constancia', nombre: 'Constancia', aporte: c, max: 20 },
  { senal: 'antiguedad', nombre: 'Antigüedad', aporte: a, max: 15 },
  { senal: 'anticipados', nombre: 'Anticipados', aporte: an, max: 15 },
  { senal: 'verificacion', nombre: 'Verificación', aporte: v, max: 10 },
  { senal: 'friccion', nombre: 'Fricción', aporte: f, max: -10 },
]
const checklistCompleto = [
  { requisito: 'cedula', nombre: 'Cédula verificada', ok: true, detalle: null },
  { requisito: 'vehiculo', nombre: 'Vehículo verificado', ok: true, detalle: null },
  { requisito: 'pagos', nombre: '2 pagos de servicios a tiempo', ok: true, detalle: '2 de 2' },
  { requisito: 'dias', nombre: '30 días en PagoDirecto', ok: true, detalle: null },
]

// ---------- Fichas de ejemplo ----------
const maria = ficha({
  user_id: 'u_0142', nombre: 'María', alias: '@maria.r', habilitado_desde: '2026-06-02', cohorte: '2026-06',
  nivel: 2, segmento: 'Puntual', quincena: [15, 30], club: 'Viajero · Ruta del Café', trust_score: 76, puntos_credirecto: 650, puntos_club: 4800,
  beneficios: { ruta: 'Viajero · Ruta del Café', factor: 1.15, pausa: false,
    razones: [{ senal: 'puntualidad', efecto: 0.15, texto: 'Paga a tiempo el 100% de sus pagos' }],
    beneficios: [{ tipo: 'walletback', nombre: 'Walletback', unidad: '%', base: 2, personal: 2.3, estimado_mes: 0.62 },
      { tipo: 'tickets_gratis', nombre: 'Tickets gratis de estacionamiento al mes', unidad: '', base: 1, personal: 1 }],
    a_tu_medida: { tipo: 'cuota_sin_gasto', nombre: '1 cuota al mes sin gasto administrativo', detalle: 'Porque pagas antes o el día de cobro.' } },
  razones: razones(38, 16, 9, 9, 10, -3), checklist: checklistCompleto,
  progreso: { siguiente_nivel: 3, siguiente_nombre: 'Premium', faltan_puntos: 4, repagos_hechos: 5, repagos_requeridos: 10, faltan_repagos: 5,
    ruta_requerida: 'Conocedor · Ruta de Paria', faltan_pts_club: 6200 },
  racha: { pagos: 2, meta: 3, quedan_dias: 4, multiplicador: false },
  // Cuota de ejemplo de CLAUDE.md: Bs 1.655,47 + gasto adm. Bs 165,55 = Bs 1.821,02
  tickets_abiertos: [nuevoTicket({ id: 4433, codigo: '0DFF7B1', servicio: 'estacionamiento', comercio: 'C.C. El Tolón',
    fecha_uso: '2026-10-29', vence: '2026-11-05', monto: 1655.47 / TASA, nivel: 2, quincena: [15, 30] })],
  comunicar: null,
  premiar: [{ tipo: 'racha', detalle: '+1 racha' }, { tipo: 'descuento_nivel', detalle: '−25 % en gasto administrativo', monto: 0.11 }],
  notificaciones: [
    { fecha: '2026-10-29', tipo: 'falta_poco', titulo: 'Credirecto', canal: 'push',
      mensaje: 'Te falta 1 pago a tiempo para activar el ×1,5 en el Club.' },
    { fecha: '2026-10-20', tipo: 'subida_nivel', titulo: 'Nuevo nivel', canal: 'push',
      mensaje: '¡Subiste a Credirecto Confiable! Ahora tienes 3 tickets y 1 pago de servicios para luz, internet y teléfono.' },
  ],
  linea_de_tiempo: [
    { fecha: '2026-10-29', tipo: 'Ticket', texto: 'Ticket · Estacionamiento C.C. El Tolón · cuota 5 nov', monto: 4.79 },
    { fecha: '2026-10-28', tipo: 'Pago', texto: 'Pago · Cuota Estacionamiento C.C. Sambil · 3 días antes', monto: 3.59 },
    { fecha: '2026-10-26', tipo: 'Pago', texto: 'Pago · Cuota Peaje Tazón · 2 días antes', monto: 1.32 },
    { fecha: '2026-10-21', tipo: 'Ticket', texto: 'Ticket · Estacionamiento C.C. Sambil · cuota 28 oct', monto: 3.59 },
    { fecha: '2026-10-20', tipo: 'Nivel', texto: 'Subió a Credirecto Confiable', monto: null },
    { fecha: '2026-10-19', tipo: 'Ticket', texto: 'Ticket · Peaje Tazón · cuota 26 oct', monto: 1.32 },
  ],
})

const carmen = ficha({
  user_id: 'u_0333', nombre: 'Carmen', alias: '@carmen.p', cohorte: '2026-10', nivel: null, segmento: 'Sin crédito',
  quincena: [], club: 'Turista · Ruta Colonial', trust_score: 31, saldo_wallet: 0.0036,
  razones: razones(14, 6, 1, 0, 5, -1),
  checklist: [
    { requisito: 'cedula', nombre: 'Cédula verificada', ok: true, detalle: null },
    { requisito: 'vehiculo', nombre: 'Verifica tu vehículo', ok: false, detalle: null },
    { requisito: 'pagos', nombre: '2 pagos de servicios a tiempo', ok: false, detalle: '1 de 2' },
    { requisito: 'dias', nombre: '30 días en PagoDirecto', ok: false, detalle: '18 de 30' },
  ],
  racha: { pagos: 0, meta: 3, quedan_dias: 0, multiplicador: false },
  comunicar: { tipo: 'falta_poco', nombre: 'Falta poco', canal: 'push', fecha: '2026-10-31', oferta_quincena: null,
    mensaje: 'Verifica tu vehículo y estás más cerca de activar tu Credirecto.' },
  notificaciones: [
    { fecha: '2026-10-30', tipo: 'falta_poco', titulo: 'Credirecto', canal: 'push',
      mensaje: 'Verifica tu vehículo y estás más cerca de activar tu Credirecto.' },
  ],
  linea_de_tiempo: [{ fecha: '2026-10-25', tipo: 'Recarga', texto: 'Recarga de wallet', monto: 5.0 }],
})

const pedro = ficha({
  user_id: 'u_0007', nombre: 'Pedro', alias: '@pedro.g', habilitado_desde: '2026-07-14', cohorte: '2026-07',
  nivel: 1, segmento: 'En riesgo', quincena: [15, 30], club: 'Caminante · Ruta Falcón', trust_score: 41,
  razones: razones(12, 10, 7, 2, 10, -8), checklist: checklistCompleto,
  progreso: { siguiente_nivel: 2, siguiente_nombre: 'Confiable', faltan_puntos: 19, repagos_hechos: 1, repagos_requeridos: 6, faltan_repagos: 5,
    ruta_requerida: 'Viajero · Ruta del Café', faltan_pts_club: 1400 },
  racha: { pagos: 0, meta: 3, quedan_dias: 0, multiplicador: false },
  tickets_abiertos: [nuevoTicket({ id: 3120, codigo: 'A41C9E2', servicio: 'estacionamiento', comercio: 'C.C. Sambil Chacao',
    fecha_uso: '2026-10-16', vence: '2026-10-23', monto: 4.36, nivel: 1, quincena: [15, 30] })],
  comunicar: { tipo: 'aviso_mora', nombre: 'Aviso de mora', canal: 'push', fecha: '2026-10-31', oferta_quincena: null,
    mensaje: 'Con una recarga pagas tu cuota y recuperas tu Credirecto. La salida de estacionamientos sigue disponible.' },
  notificaciones: [
    { fecha: '2026-10-31', tipo: 'aviso_mora', titulo: 'Credirecto', canal: 'push',
      mensaje: 'Con una recarga pagas tu cuota y recuperas tu Credirecto. La salida de estacionamientos sigue disponible.' },
    { fecha: '2026-10-26', tipo: 'comision', titulo: 'Credirecto', canal: 'push',
      mensaje: 'Se sumó una comisión de Bs 95,00 a tu cuota. Págala cuando puedas y tu ticket vuelve.' },
    { fecha: '2026-10-24', tipo: 'gracia', titulo: 'Credirecto', canal: 'push',
      mensaje: 'Tu cuota venció ayer. Tienes 2 días sin comisión: a cualquiera le pasa.' },
  ],
  linea_de_tiempo: [
    { fecha: '2026-10-31', tipo: 'Mora', texto: 'Entró en modo recuperación', monto: null },
    { fecha: '2026-10-26', tipo: 'Comisión', texto: 'Comisión por desfase · Ticket A41C9E2', monto: 0.25 },
    { fecha: '2026-10-16', tipo: 'Ticket', texto: 'Ticket · Estacionamiento C.C. Sambil Chacao · cuota 23 oct', monto: 4.8 },
  ],
})

const andrea = ficha({
  user_id: 'u_0058', nombre: 'Andrea', alias: '@andrea.m', habilitado_desde: '2026-05-11', cohorte: '2026-05',
  nivel: 2, segmento: 'Conductor diario', quincena: [15, 30], club: 'Viajero · Ruta del Café', trust_score: 68,
  razones: razones(32, 18, 10, 4, 10, -6), checklist: checklistCompleto,
  progreso: { siguiente_nivel: 3, siguiente_nombre: 'Premium', faltan_puntos: 12, repagos_hechos: 3, repagos_requeridos: 10, faltan_repagos: 7,
    ruta_requerida: 'Conocedor · Ruta de Paria', faltan_pts_club: 5300 },
  racha: { pagos: 1, meta: 3, quedan_dias: 2, multiplicador: false },
  tickets_abiertos: [nuevoTicket({ id: 4290, codigo: '7BE21C0', servicio: 'estacionamiento', comercio: 'C.C. El Tolón',
    fecha_uso: '2026-10-23', vence: '2026-10-30', monto: 1655.47 / TASA, nivel: 2, quincena: [] })],
  comunicar: { tipo: 'gracia', nombre: 'Gracia', canal: 'push', fecha: '2026-10-31', oferta_quincena: null,
    mensaje: 'Tu cuota venció ayer. Tienes 2 días sin comisión.' },
  notificaciones: [
    { fecha: '2026-10-31', tipo: 'gracia', titulo: 'Credirecto', canal: 'push',
      mensaje: 'Tu cuota venció ayer. Tienes 2 días sin comisión: a cualquiera le pasa.' },
    { fecha: '2026-10-28', tipo: 'recordatorio', titulo: 'Credirecto', canal: 'push',
      mensaje: 'Tu cuota de Credirecto vence en 2 días. Paga tu cuota y tu ticket vuelve a estar disponible.' },
  ],
  linea_de_tiempo: [
    { fecha: '2026-10-27', tipo: 'Pago', texto: 'Pago · Cuota Parquímetro Chacao · a tiempo', monto: 1.1 },
    { fecha: '2026-10-23', tipo: 'Ticket', texto: 'Ticket · Estacionamiento C.C. El Tolón · cuota 30 oct', monto: 4.79 },
  ],
})

const fichas = { u_0142: maria, u_0333: carmen, u_0007: pedro, u_0058: andrea }

// ---------- Reglas mínimas (worker de gracia/comisión/mora) ----------
function recalcular(f) {
  if (!f.habilitado) return f
  for (const t of f.tickets_abiertos) {
    if (t.estado === 'pausa_tecnica' || t.estado === 'disputa') continue
    const d = diasEntre(t.vence, hoy)
    t.dias_atraso = Math.max(0, d)
    if (d <= 0) t.estado = 'abierto'
    else if (d <= 2) t.estado = 'gracia'
    else {
      t.estado = d >= 8 ? 'mora' : 'atrasado'
      if (!t.comision) t.comision = t.comision_si_atrasa
    }
    t.deuda = rd(t.cuota + t.comision - t.pagado)
  }
  const ts = f.tickets_abiertos
  f.tickets.usados = Math.min(ts.filter((t) => !esFactura(t.servicio)).length, f.tickets.total)
  f.tickets.disponibles = f.tickets.total - f.tickets.usados
  f.servicios_cupo.usados = Math.min(ts.filter((t) => esFactura(t.servicio)).length, f.servicios_cupo.total)
  f.servicios_cupo.disponibles = f.servicios_cupo.total - f.servicios_cupo.usados
  f.deuda_total = rd(ts.reduce((s, t) => s + t.deuda, 0))
  const hay = (e) => ts.some((t) => t.estado === e)
  f.modo_recuperacion = hay('mora')
  f.estado_mora = hay('mora') ? 'mora' : hay('atrasado') ? 'atrasado' : hay('gracia') ? 'gracia' : 'al_dia'
  f.decisiones.prestar.motivo = f.modo_recuperacion ? 'modo_recuperacion' : hay('atrasado') ? 'deuda_vencida' : null
  return f
}
Object.values(fichas).forEach(recalcular)

const resumen = (f) => ({
  user_id: f.user_id, nombre: f.nombre, trust_score: f.trust_score, nivel: f.nivel, nivel_nombre: f.nivel_nombre,
  segmento: f.segmento, habilitado: f.habilitado, tickets_usados: f.tickets.usados, tickets_total: f.tickets.total,
  servicios_usados: f.servicios_cupo.usados, servicios_total: f.servicios_cupo.total,
  monto_max: f.tickets.monto_max, deuda: f.deuda_total,
  dias_atraso: Math.max(0, ...f.tickets_abiertos.map((t) => t.dias_atraso)), modo_recuperacion: f.modo_recuperacion,
})

function buscar(id) {
  const f = fichas[id]
  if (!f) throw new ApiError(404, 'No encontramos ese usuario.')
  return f
}

// ---------- API simulada (misma firma que api.js) ----------
export const apiMock = {
  async salud() { await esperar(60); return { ok: true, hoy, tasa_bs: TASA } },

  async usuarios({ q = '', limit = 50 } = {}) {
    await esperar()
    const t = q.trim().toLowerCase()
    const lista = Object.values(fichas)
      .filter((f) => !t || f.user_id.includes(t) || f.nombre.toLowerCase().includes(t))
      .map(resumen)
    return { total: lista.length, usuarios: lista.slice(0, limit) }
  },

  async usuario(id) { await esperar(); return clonar(recalcular(buscar(id))) },

  async simularDia(dias = 1) {
    await esperar(300)
    const desde = hoy
    hoy = sumarDias(hoy, dias)
    Object.values(fichas).forEach(recalcular)
    return {
      desde, hoy, dias,
      totales: { solicitudes: 0, tickets: 0, pagos: 0, comisiones: 0, nuevas_moras: 0, congelados: 0, habilitados: 0, subieron_nivel: 0, bajaron_nivel: 0 },
      bitacora: [{ fecha: hoy, mensaje: 'Simulación local (mock): reloj avanzado y tickets recalculados' }],
      cambios: [],
    }
  },

  async crearTicket({ user_id, servicio, monto, comercio }) {
    await esperar(350)
    const f = recalcular(buscar(user_id))
    if (!f.habilitado) throw new ApiError(409, 'Aún no tienes Credirecto. Completa los pasos que faltan para activarlo.')
    if (f.modo_recuperacion) throw new ApiError(409, 'Tu Credirecto está en pausa mientras pagas tu cuota pendiente. Con una recarga lo recuperas.')
    if (f.estado_mora === 'atrasado') throw new ApiError(409, 'Tienes una cuota vencida. Págala y tus tickets vuelven a estar disponibles.')
    if (!f.tickets.servicios.includes(servicio)) throw new ApiError(409, `Tu nivel ${f.nivel_nombre} todavía no cubre ${NOMBRE_SERV[servicio] || servicio}.`)
    if (esFactura(servicio)) {
      if (f.servicios_cupo.total <= 0) throw new ApiError(409, `Credirecto ${f.nivel_nombre} todavía no incluye pagos de servicios.`)
      if (f.servicios_cupo.disponibles <= 0) throw new ApiError(409, 'Ya estás usando tus pagos de servicios con crédito. Paga esa cuota y vuelve a estar disponible.')
    } else if (f.tickets.disponibles <= 0) throw new ApiError(409, 'Tus tickets están en uso. Paga una cuota y tu ticket vuelve a estar disponible.')
    if (!(monto > 0)) throw new ApiError(422, 'Ingresa un monto mayor a cero.')
    const cubierto = Math.min(monto, f.tickets.monto_max)
    const conSaldo = rd(monto - cubierto)
    if (conSaldo > f.saldo_wallet + 1e-9) throw new ApiError(409, 'El monto supera lo que cubre tu ticket y no tienes saldo suficiente para el resto. Recarga tu wallet e inténtalo de nuevo.')
    f.saldo_wallet = rd(f.saldo_wallet - conSaldo)
    const t = nuevoTicket({ id: siguienteId++, servicio, comercio, fecha_uso: hoy, vence: sumarDias(hoy, f.decisiones.prestar.plazo_dias || 7),
      monto: cubierto, nivel: f.nivel, quincena: f.quincena })
    f.tickets_abiertos.push(t)
    f.linea_de_tiempo.unshift({ fecha: hoy, tipo: 'Ticket', texto: `Ticket · ${NOMBRE_SERV[servicio]} ${comercio} · cuota ${corta(t.vence)}`, monto: t.cuota })
    recalcular(f)
    return { ticket: clonar(t), cubierto_por_credito: rd(cubierto), pagado_con_saldo: conSaldo, usuario: clonar(f) }
  },

  async moverAQuincena(ticketId) {
    await esperar()
    const f = Object.values(fichas).find((x) => x.tickets_abiertos.some((t) => t.id === Number(ticketId)))
    const t = f?.tickets_abiertos.find((x) => x.id === Number(ticketId))
    if (!t) throw new ApiError(404, 'No encontramos ese ticket.')
    if (!t.oferta_quincena) throw new ApiError(409, 'Este ticket no tiene una fecha de quincena disponible.')
    t.vence_original = t.vence_original || t.vence // el anticipado se mide contra la fecha original
    t.vence = t.oferta_quincena
    t.gracia_hasta = sumarDias(t.vence, 2)
    t.oferta_quincena = null
    recalcular(f)
    return { ticket: clonar(t), usuario: clonar(f) }
  },

  async pagar({ user_id, ticket_id, monto, origen = 'usuario' }) {
    await esperar(350)
    const f = recalcular(buscar(user_id))
    const t = f.tickets_abiertos.find((x) => x.id === Number(ticket_id))
    if (!t) throw new ApiError(404, 'No encontramos esa cuota.')
    if (origen === 'fallo_tecnico') {
      t.estado = 'pausa_tecnica'; t.vence = sumarDias(t.vence, 2)
      return { aplicado: 0, deuda_restante: t.deuda, comprobante: null, ticket: clonar(t), usuario: clonar(f) }
    }
    if (!(monto > 0)) throw new ApiError(422, 'Ingresa un monto mayor a cero.')
    const dias = diasEntre(hoy, t.vence)
    const diasAntes = diasEntre(hoy, t.vence_original || t.vence)
    const anticipado = diasAntes > 0
    const premia = t.monto >= MONTO_MIN_PREMIO
    const descuento = anticipado ? t.descuento_si_anticipa : 0
    const aPagar = rd(t.deuda - descuento)
    const total = rd(Math.min(monto, aPagar))
    const completo = total >= aPagar - 0.005
    const rachaAntes = f.racha.pagos
    let puntos = 0
    if (completo) {
      f.tickets_abiertos = f.tickets_abiertos.filter((x) => x.id !== t.id)
      if (dias >= 0 && premia) {
        // La racha cuenta días con pago, no pagos: varias cuotas el mismo día suman 1
        if (f.racha_ultimo_dia !== hoy) f.racha.pagos = Math.min(f.racha.meta, f.racha.pagos + 1)
        f.racha_ultimo_dia = hoy
        f.racha.multiplicador = f.racha.pagos >= f.racha.meta
        // Puntos del mismo Club PagoDirecto: ×1,5 si paga antes o completó la racha
        puntos = Math.round(PUNTOS_POR_PAGO * (anticipado || f.racha.multiplicador ? 1.5 : 1))
        f.club_puntos.puntos_credirecto += puntos
      }
      if (f.progreso && premia) {
        f.progreso.repagos_hechos = Math.min(f.progreso.repagos_requeridos, f.progreso.repagos_hechos + 1)
        f.progreso.faltan_repagos = f.progreso.repagos_requeridos - f.progreso.repagos_hechos
      }
    } else {
      t.pagado = rd(t.pagado + total)
    }
    f.linea_de_tiempo.unshift({ fecha: hoy, tipo: 'Pago', texto: `Pago · Cuota ${NOMBRE_SERV[t.servicio]} ${t.comercio}${anticipado ? ` · ${diasAntes} días antes` : ''}`, monto: total })
    recalcular(f)
    const comprobante = {
      referencia: `CD-${String(siguienteRef++).padStart(9, '0')}`, fecha: hoy, dias_antes: Math.max(0, diasAntes),
      anticipado: anticipado && completo, cuota: t.monto, gasto_admin: t.gasto_admin, descuento: completo ? descuento : 0,
      descuento_pct: NIVEL_CONF[f.nivel].descuento, comision: t.comision, total, ahorro: completo ? descuento : 0,
      racha_antes: rachaAntes, racha_despues: f.racha.pagos, ticket_disponible: completo,
      puntos_club: puntos, club: f.club,
    }
    return { aplicado: total, deuda_restante: completo ? 0 : t.deuda, comprobante, ticket: clonar(t), usuario: clonar(f) }
  },

  async recargar({ user_id, monto }) {
    await esperar(350)
    const f = recalcular(buscar(user_id))
    if (!(monto > 0)) throw new ApiError(422, 'Ingresa un monto mayor a cero.')
    let resto = monto
    let aDeuda = 0
    for (const t of [...f.tickets_abiertos].sort((a, b) => (a.vence < b.vence ? -1 : 1))) {
      if (t.dias_atraso <= 0 || resto <= 0) continue
      const abono = Math.min(resto, t.deuda)
      t.pagado = rd(t.pagado + abono); resto = rd(resto - abono); aDeuda = rd(aDeuda + abono)
      if (t.pagado >= t.cuota + t.comision - 0.005) f.tickets_abiertos = f.tickets_abiertos.filter((x) => x.id !== t.id)
    }
    f.saldo_wallet = rd(f.saldo_wallet + resto)
    f.linea_de_tiempo.unshift({ fecha: hoy, tipo: 'Recarga', texto: 'Recarga de wallet', monto })
    recalcular(f)
    const restante = rd(f.tickets_abiertos.filter((t) => t.dias_atraso > 0).reduce((s, t) => s + t.deuda, 0))
    return { aplicado_a_deuda: aDeuda, a_wallet: rd(resto), deuda_restante: restante, saldo_wallet: f.saldo_wallet, usuario: clonar(f) }
  },
}
