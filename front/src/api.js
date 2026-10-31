// Cliente de la API de Credirecto. El contrato está en /API.md.
const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

async function pedir(metodo, ruta, cuerpo) {
  const res = await fetch(BASE + ruta, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  const datos = await res.json().catch(() => null)
  if (!res.ok) {
    const detalle = typeof datos?.detail === 'string' ? datos.detail : 'No se pudo completar la operación.'
    throw new ApiError(res.status, detalle)
  }
  return datos
}

const qs = (params) => {
  const p = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return p.length ? '?' + new URLSearchParams(p).toString() : ''
}

export const api = {
  salud: () => pedir('GET', '/salud'),
  reloj: () => pedir('GET', '/reloj'),
  simularDia: (dias = 1) => pedir('POST', `/simular-dia?dias=${dias}`),
  reset: () => pedir('POST', '/reset'),

  resumen: () => pedir('GET', '/resumen'),
  cohortes: () => pedir('GET', '/cohortes'),
  segmentos: () => pedir('GET', '/segmentos'),
  decisiones: () => pedir('GET', '/decisiones'),
  usuarios: (params) => pedir('GET', '/usuarios' + qs(params)),
  usuario: (id) => pedir('GET', `/usuarios/${encodeURIComponent(id)}`),
  config: () => pedir('GET', '/config'),
  guardarConfig: (valores) => pedir('PUT', '/config', { valores }),
  simularConfig: (valores) => pedir('POST', '/config/simular', { valores }),

  crearTicket: (cuerpo) => pedir('POST', '/tickets', cuerpo),
  moverAQuincena: (ticketId) => pedir('POST', `/tickets/${ticketId}/quincena`),
  pagar: (cuerpo) => pedir('POST', '/pagos', cuerpo),
  recargar: (cuerpo) => pedir('POST', '/recargas', cuerpo),
  disputar: (ticketId) => pedir('POST', `/tickets/${ticketId}/disputa`),
}
