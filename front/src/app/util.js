// Utilidades de la app Credirecto (fechas, tickets y montos en Bs).
import { aFecha, tasaBs } from '../formato.js'

/** Date → "YYYY-MM-DD" (hora local) */
export const aISO = (f) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`

/** Suma n días a una fecha ISO */
export const sumarDias = (iso, n) => {
  const f = aFecha(iso)
  f.setDate(f.getDate() + n)
  return aISO(f)
}

/** Días de a → b (positivo si b es posterior) */
export const diasEntre = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000)

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre',
  'Octubre', 'Noviembre', 'Diciembre']

/** "Jueves, 12 de noviembre" */
export const fechaPantallaBloqueo = (iso) => {
  const f = aFecha(iso)
  return `${DIAS[f.getDay()]}, ${f.getDate()} de ${MESES[f.getMonth()].toLowerCase()}`
}
/** "Noviembre 2026" */
export const mesAnio = (iso) => {
  const f = aFecha(iso)
  return `${MESES[f.getMonth()]} ${f.getFullYear()}`
}

/** Hora local tipo "7:48 p. m." */
export const horaAhora = () => {
  const f = new Date()
  const h = f.getHours()
  const m = String(f.getMinutes()).padStart(2, '0')
  return `${h % 12 || 12}:${m} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

/** Texto en Bs escrito por el usuario → número. Acepta "1.520,00", "1520,5", "1520.50" o "1520". */
export const parseBs = (texto) => {
  const t = String(texto || '').replace(/[^\d,.]/g, '')
  if (!t) return 0
  if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.')) || 0
  if (/^\d+\.\d{1,2}$/.test(t)) return Number(t) || 0
  return Number(t.replace(/\./g, '')) || 0
}

/** Bs → USD con la tasa vigente (redondeo a 6 decimales para no perder céntimos de Bs) */
export const bsAUsd = (montoBs) => Math.round((montoBs / tasaBs()) * 1e6) / 1e6

/** USD → número en Bs con 2 decimales para un campo de texto ("1.520,00") */
export const usdATextoBs = (usdMonto) =>
  Number(usdMonto * tasaBs()).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Tickets abiertos en orden de uso (el primero es "Ticket 1") */
export const ticketsOrdenados = (ficha) =>
  [...(ficha?.tickets_abiertos || [])].sort((a, b) =>
    a.fecha_uso === b.fecha_uso ? a.id - b.id : a.fecha_uso < b.fecha_uso ? -1 : 1)

/**
 * Nombre visible de una cuota según su cupo: "Ticket 2" (movilidad) o "Pago de servicios 1" (facturas).
 * Cada cupo se numera aparte, en orden de uso.
 */
export const nombreCuota = (ficha, id) => {
  const orden = ticketsOrdenados(ficha)
  const t = orden.find((x) => x.id === id)
  const factura = t ? esFactura(t.servicio) : false
  const i = orden.filter((x) => esFactura(x.servicio) === factura).findIndex((x) => x.id === id)
  return `${factura ? 'Pago de servicios' : 'Ticket'} ${i < 0 ? 1 : i + 1}`
}

/** Ticket con el vencimiento más cercano */
export const proximoTicket = (ficha) =>
  [...(ficha?.tickets_abiertos || [])].sort((a, b) => (a.vence < b.vence ? -1 : a.vence > b.vence ? 1 : 0))[0] || null

export const ticketEnGracia = (ficha) => (ficha?.tickets_abiertos || []).find((t) => t.estado === 'gracia') || null

/** ¿El día de esa fecha es uno de los días habituales de recarga (quincena)? */
export const esDiaDeCobro = (ficha, iso) => {
  const q = ficha?.quincena || []
  if (!q.length || !iso) return false
  const f = aFecha(iso)
  const ultimo = new Date(f.getFullYear(), f.getMonth() + 1, 0).getDate()
  return q.some((d) => Math.min(d, ultimo) === f.getDate())
}

/** "Estacionamiento C.C. El Tolón" */
export const NOMBRE_SERVICIO = {
  estacionamiento: 'Estacionamiento', parquimetro: 'Parquímetro', peaje: 'Peaje', luz: 'Luz',
  internet: 'Internet', telefono: 'Teléfono', seguro: 'Seguro',
}
export const descripcionTicket = (t) => `${NOMBRE_SERVICIO[t.servicio] || t.servicio} ${t.comercio}`.trim()

/** Orden y nivel mínimo de cada servicio (tabla de CLAUDE.md) */
export const SERVICIOS_NIVEL = [
  { clave: 'estacionamiento', nombre: 'Estacionamiento', nivel: 0 },
  { clave: 'parquimetro', nombre: 'Parquímetros', nivel: 1 },
  { clave: 'peaje', nombre: 'Peajes', nivel: 1 },
  { clave: 'luz', nombre: 'Luz', nivel: 2 },
  { clave: 'internet', nombre: 'Internet', nivel: 2 },
  { clave: 'telefono', nombre: 'Teléfono', nivel: 2 },
  { clave: 'seguro', nombre: 'Seguros', nivel: 3 },
]

/** Dos cupos: tickets para movilidad y pagos de servicios para facturas (nunca un monto en Bs) */
export const SERVICIOS_FACTURA = ['luz', 'internet', 'telefono', 'seguro']
export const esFactura = (servicio) => SERVICIOS_FACTURA.includes(servicio)
/** Cupo de pagos de servicios de la ficha (vacío si el back aún no lo manda) */
export const cupoServicios = (ficha) => ficha?.servicios_cupo || { total: 0, usados: 0, disponibles: 0, cubre: [] }

/** Lo que trae cada nivel (para "Camino a …") */
export const BENEFICIO_NIVEL = [
  'Inicial: 1 ticket para estacionamiento.',
  'Básico: 2 tickets para estacionamiento, parquímetros y peajes.',
  'Confiable: 3 tickets + 1 pago de servicios (luz, internet o teléfono).',
  'Premium: 5 tickets + 3 pagos de servicios, incluidos seguros.',
]

/** Fondo de las tarjetas Credirecto (casi negro con brillo lima); cada diseño mueve el brillo */
export const fondoCD = (forma = '120% 75% at 85% 110%', a = 0.55, p1 = 28, p2 = 62) =>
  `radial-gradient(${forma},#C6F432 0%,rgba(150,200,20,${a}) ${p1}%,rgba(22,24,22,0) ${p2}%),linear-gradient(160deg,#232623 0%,#121412 70%)`

export const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
