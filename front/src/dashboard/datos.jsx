// Capa de datos del dashboard.
// - Usa api.* normalmente.
// - Usa los mocks SOLO si VITE_MOCK=1 (no hay otro camino: si la API falla se muestra el error).
// - DemoProvider guarda una "versión" que sube tras "Avanzar un día" / "Reiniciar demo" / guardar config,
//   y useDatos la incluye en sus dependencias para que todas las vistas vuelvan a pedir sus datos.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { fijarTasa } from '../formato.js'

export const USAR_MOCK = import.meta.env.VITE_MOCK === '1'

let mockPromesa
const cargarMock = () => (mockPromesa ||= import('./mock.js').then((m) => m.mockApi))

/** Misma interfaz que api.js; con VITE_MOCK=1 delega en mock.js (cargado bajo demanda). */
export const fuente = USAR_MOCK
  ? new Proxy({}, { get: (_, metodo) => async (...args) => (await cargarMock())[metodo](...args) })
  : api

const DemoCtx = createContext(null)

export function DemoProvider({ children }) {
  const [version, setVersion] = useState(0)
  const [tasa, setTasa] = useState(380)
  // ocupado: null | 'dia' | 'reset'
  const [ocupado, setOcupado] = useState(null)
  const [aviso, setAviso] = useState(null) // { tipo: 'ok' | 'error', texto }
  const ocupadoRef = useRef(null)

  useEffect(() => {
    fuente.salud().then((s) => { fijarTasa(s.tasa_bs); setTasa(s.tasa_bs) }).catch(() => {})
  }, [version])

  const refrescar = useCallback(() => setVersion((v) => v + 1), [])

  const correr = useCallback(async (tipo, fn, textoOk) => {
    if (ocupadoRef.current) return null
    ocupadoRef.current = tipo
    setOcupado(tipo)
    setAviso(null)
    try {
      const r = await fn()
      setAviso({ tipo: 'ok', texto: textoOk(r) })
      setVersion((v) => v + 1)
      return r
    } catch (e) {
      setAviso({ tipo: 'error', texto: e?.detail || e?.message || 'No se pudo completar la operación.' })
      return null
    } finally {
      ocupadoRef.current = null
      setOcupado(null)
    }
  }, [])

  const avanzar = useCallback((dias = 1) => correr('dia', () => fuente.simularDia(dias),
    (r) => `Reloj avanzado ${r.dias} ${r.dias === 1 ? 'día' : 'días'}.`), [correr])

  const reiniciar = useCallback(() => correr('reset', () => fuente.reset(),
    (r) => `Demo reiniciada: ${r.usuarios} usuarios en ${Math.round(r.segundos)} s.`), [correr])

  return (
    <DemoCtx.Provider value={{ version, tasa, ocupado, aviso, setAviso, refrescar, avanzar, reiniciar }}>
      {children}
    </DemoCtx.Provider>
  )
}

export const useDemo = () => useContext(DemoCtx)

/**
 * Pide datos con fn(fuente) y los vuelve a pedir cuando cambian deps o la versión de la demo.
 * Mientras recarga conserva los datos anteriores (cargando = true) para no parpadear.
 */
export function useDatos(fn, deps = []) {
  const { version } = useDemo()
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let vivo = true
    setEstado((e) => ({ ...e, cargando: true, error: null }))
    Promise.resolve()
      .then(() => fn(fuente))
      .then((datos) => { if (vivo) setEstado({ datos, cargando: false, error: null }) })
      .catch((error) => { if (vivo) setEstado({ datos: null, cargando: false, error }) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version, tick])

  const recargar = useCallback(() => setTick((t) => t + 1), [])
  return { ...estado, recargar }
}
