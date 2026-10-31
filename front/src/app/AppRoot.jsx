// Banco de pruebas de la app móvil Credirecto: panel de pruebas a la izquierda (arriba en pantallas
// angostas) y un teléfono de 390×844 con la pantalla actual. Rutas anidadas bajo /app.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { AppCtx } from './contexto.js'
import { datos, mensajeError, MOCK } from './datos.js'
import PanelPruebas from './PanelPruebas.jsx'
import Home from './pantallas/Home.jsx'
import Detalle from './pantallas/Detalle.jsx'
import PagoTicket from './pantallas/PagoTicket.jsx'
import Quincena from './pantallas/Quincena.jsx'
import Club from './pantallas/Club.jsx'
import Comprobante from './pantallas/Comprobante.jsx'
import Racha from './pantallas/Racha.jsx'
import Gracia from './pantallas/Gracia.jsx'
import Notificaciones from './pantallas/Notificaciones.jsx'
import './app.css'

const CLAVE = 'credirecto.usuario'
const leer = () => { try { return localStorage.getItem(CLAVE) } catch { return null } }
const guardar = (id) => { try { localStorage.setItem(CLAVE, id) } catch { /* sin almacenamiento */ } }

export default function AppRoot() {
  const navegar = useNavigate()
  const [userId, setUserId] = useState(() => leer() || 'u_0142')
  const [ficha, setFicha] = useState(null)
  const [error, setError] = useState(null)
  const [hoy, setHoy] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [avanzando, setAvanzando] = useState(false)
  const [resultadoDia, setResultadoDia] = useState(null)
  const pedido = useRef(0)
  const timerAviso = useRef(null)

  /** Vuelve a pedir la ficha del usuario actual (se llama después de cada acción) */
  const recargarFicha = useCallback(async (id = userId) => {
    const n = ++pedido.current
    try {
      const f = await datos.usuario(id)
      if (n === pedido.current) { setFicha(f); setError(null) }
      return f
    } catch (e) {
      if (n === pedido.current) setError(mensajeError(e))
      return null
    }
  }, [userId])

  const avisar = useCallback((texto) => {
    setAviso(texto)
    clearTimeout(timerAviso.current)
    timerAviso.current = setTimeout(() => setAviso(null), 4200)
  }, [])

  useEffect(() => {
    datos.salud().then((s) => setHoy(s.hoy)).catch((e) => setError(mensajeError(e)))
    return () => clearTimeout(timerAviso.current)
  }, [])

  useEffect(() => { setFicha(null); setError(null); recargarFicha(userId) }, [userId, recargarFicha])

  const elegirUsuario = (id) => {
    guardar(id)
    setUserId(id)
    navegar('/app')
  }

  const avanzarDia = async () => {
    setAvanzando(true)
    try {
      const r = await datos.simularDia(1)
      setHoy(r.hoy)
      const t = r.totales || {}
      setResultadoDia(`${r.desde} → ${r.hoy} · pagos ${t.pagos ?? 0} · comisiones ${t.comisiones ?? 0} · nuevas moras ${t.nuevas_moras ?? 0}`)
      await recargarFicha()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setAvanzando(false)
    }
  }

  const ctx = useMemo(() => ({ userId, ficha, hoy, recargarFicha, avisar }), [userId, ficha, hoy, recargarFicha, avisar])

  return (
    <AppCtx.Provider value={ctx}>
      <div className="cd-raiz">
        <PanelPruebas userId={userId} elegirUsuario={elegirUsuario} hoy={hoy} avanzarDia={avanzarDia} avanzando={avanzando}
          resultadoDia={resultadoDia} ficha={ficha} error={error} mock={MOCK} />
        <div className="cd-telefono">
          <div className="cd-pantalla">
            {ficha ? (
              <Routes>
                <Route index element={<Home />} />
                <Route path="detalle" element={<Detalle />} />
                <Route path="pago" element={<PagoTicket />} />
                <Route path="quincena/:ticketId" element={<Quincena />} />
                <Route path="comprobante" element={<Comprobante />} />
                <Route path="racha" element={<Racha />} />
                <Route path="club" element={<Club />} />
                <Route path="gracia/:ticketId" element={<Gracia />} />
                <Route path="notificaciones" element={<Notificaciones />} />
                <Route path="*" element={<Navigate to="/app" replace />} />
              </Routes>
            ) : (
              <Cargando error={error} reintentar={() => recargarFicha()} />
            )}
            {aviso && <div className="cd-toast" role="status" onClick={() => setAviso(null)}>{aviso}</div>}
          </div>
        </div>
      </div>
    </AppCtx.Provider>
  )
}

function Cargando({ error, reintentar }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32, textAlign: 'center' }}>
      {error ? (
        <>
          <div style={{ fontSize: 20, fontWeight: 700 }}>No pudimos cargar tu información</div>
          <div className="cd-error">{error}</div>
          <button onClick={reintentar} style={{ height: 50, padding: '0 28px', border: 0, borderRadius: 999, background: '#FF1F5A', color: '#fff', font: "700 17px 'Outfit',sans-serif" }}>Reintentar</button>
        </>
      ) : (
        <div className="cd-mut" style={{ fontSize: 16 }}>Cargando…</div>
      )}
    </div>
  )
}
