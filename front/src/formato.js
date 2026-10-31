// Formatos compartidos (es-VE). Los montos llegan en USD; la tasa viene de GET /salud.
let tasa = 380

export const fijarTasa = (t) => { if (t) tasa = t }
export const tasaBs = () => tasa

const num = (n, d = 2) => Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: d, maximumFractionDigits: d })

/** "$4,79" */
export const usd = (n, d = 2) => '$' + num(n, d)
/** "Bs 1.821,02" a partir de un monto en USD */
export const bs = (montoUsd, d = 2) => 'Bs ' + num(montoUsd * tasa, d)
/** "87,4 %" */
export const pct = (n, d = 1) => (n === null || n === undefined ? '—' : num(n, d) + ' %')
export const entero = (n) => num(n, 0)

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre',
  'octubre', 'noviembre', 'diciembre']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

/** "2026-11-15" → Date local (sin desfase de zona horaria) */
export const aFecha = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d) }
/** "15 nov" */
export const fechaCorta = (iso) => { const f = aFecha(iso); return `${f.getDate()} ${MESES[f.getMonth()]}` }
/** "15 de noviembre" */
export const fechaLarga = (iso) => { const f = aFecha(iso); return `${f.getDate()} de ${MESES_LARGOS[f.getMonth()]}` }
/** "Sáb 31 oct 2026" */
export const fechaReloj = (iso) => {
  const f = aFecha(iso)
  const dia = DIAS[f.getDay()].slice(0, 3)
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`
}
/** "Sábado 31 de octubre de 2026" */
export const fechaRelojLarga = (iso) => {
  const f = aFecha(iso)
  const dia = DIAS[f.getDay()]
  return `${dia[0].toUpperCase()}${dia.slice(1)} ${f.getDate()} de ${MESES_LARGOS[f.getMonth()]} de ${f.getFullYear()}`
}
/** "12-11-2026" */
export const fechaNumerica = (iso) => iso.split('-').reverse().join('-')

export const NIVELES = ['Inicial', 'Básico', 'Confiable', 'Premium']
export const SERVICIOS = {
  estacionamiento: 'Estacionamiento', parquimetro: 'Parquímetros', peaje: 'Peajes', luz: 'Luz',
  internet: 'Internet', telefono: 'Teléfono', seguro: 'Seguros',
}
