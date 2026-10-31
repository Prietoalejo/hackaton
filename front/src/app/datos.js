// Capa de datos de la app: usa la API real (api.js) o, si VITE_MOCK=1, los datos simulados de mock.js.
// Si la API falla sin mock, el error sube tal cual (las pantallas lo muestran; nunca caemos a los mocks).
import { api } from '../api.js'
import { fijarTasa } from '../formato.js'
import { apiMock } from './mock.js'

export const MOCK = import.meta.env.VITE_MOCK === '1'
const fuente = MOCK ? apiMock : api

export const datos = {
  salud: () => fuente.salud().then((s) => { fijarTasa(s.tasa_bs); return s }),
  usuarios: (params) => fuente.usuarios(params),
  usuario: (id) => fuente.usuario(id),
  simularDia: (dias = 1) => fuente.simularDia(dias),
  crearTicket: (cuerpo) => fuente.crearTicket(cuerpo),
  moverAQuincena: (ticketId) => fuente.moverAQuincena(ticketId),
  pagar: (cuerpo) => fuente.pagar(cuerpo),
  recargar: (cuerpo) => fuente.recargar(cuerpo),
}

/** Mensaje legible de cualquier error (ApiError trae .detail en español) */
export const mensajeError = (e) =>
  e?.detail || (e instanceof TypeError ? 'No pudimos conectar con el servidor. Revisa que la API esté encendida.' : e?.message) ||
  'No se pudo completar la operación.'
