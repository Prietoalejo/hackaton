// Utilidades de formato propias del dashboard (complementan ../formato.js).
import { entero, pct, usd } from '../formato.js'

export const MENOS = '−'

/** Número con 1 decimal, sin ",0" si es entero: 13,2 · 19 */
export const numAuto = (n) => {
  const r = Math.round(Number(n || 0) * 10) / 10
  const d = Number.isInteger(r) ? 0 : 1
  return r.toLocaleString('es-VE', { minimumFractionDigits: d, maximumFractionDigits: d })
}

/** "87,4 %" o "71 %" (quita el ",0"); null → "—" */
export const pctAuto = (n) => {
  if (n === null || n === undefined) return '—'
  const r = Math.round(n * 10) / 10
  return pct(r, Number.isInteger(r) ? 0 : 1)
}

/** Formatea un valor según la unidad del contrato (pct | usd | n) */
export const valorUnidad = (unidad, v) => {
  if (v === null || v === undefined) return '—'
  if (unidad === 'pct') return pctAuto(v)
  if (unidad === 'usd') return usd(v, 0)
  return entero(v)
}

/**
 * Diferencia entre dos valores según el contrato:
 * pp para pct, % relativo para usd y resta para n. Color según mejor_si_sube.
 */
export function diferencia(unidad, antes, despues, mejorSiSube) {
  let d
  if (unidad === 'usd') d = antes ? ((despues - antes) / Math.abs(antes)) * 100 : 0
  else d = despues - antes
  const cero = Math.abs(d) < (unidad === 'n' ? 0.5 : 0.05)
  let cuerpo
  if (unidad === 'pct') cuerpo = numAuto(Math.abs(d)) + ' pp'
  else if (unidad === 'usd') cuerpo = entero(Math.round(Math.abs(d))) + ' %'
  else cuerpo = entero(Math.abs(d))
  const color = cero ? '#6B6B80' : (d > 0) === mejorSiSube ? '#3F6212' : '#B42318'
  const texto = cero ? 'Sin cambio' : (d > 0 ? '▲ +' : '▼ ' + MENOS) + cuerpo
  return { d, texto, color, cero }
}

/** "1 ticket" / "3 tickets" */
export const tickets = (n) => `${n} ${n === 1 ? 'ticket' : 'tickets'}`
/** "3 tickets + 1 servicio": lo que da un nivel (tickets = movilidad, servicios = facturas) */
export const cupo = (t, s) => (s > 0 ? `${tickets(t)} + ${s} ${s === 1 ? 'servicio' : 'servicios'}` : tickets(t))

/** Lista legible: "a, b y c" */
export const listaY = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' y ' + xs[xs.length - 1])

/** Color del score (verde ≥ 60, gris 40–59, rojo < 40) como en la tabla de usuarios */
export const colorScore = (s) => (s >= 60 ? '#4D7C0F' : s >= 40 ? '#9AA0B4' : '#B42318')
