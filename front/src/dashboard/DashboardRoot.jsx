// Dashboard de Credirecto: layout común (menú lateral de 248 px + reloj de demo) y rutas anidadas.
import { useEffect, useRef, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { fechaReloj } from '../formato.js'
import { Spinner } from './componentes.jsx'
import { DemoProvider, USAR_MOCK, useDatos, useDemo } from './datos.jsx'
import Resumen from './vistas/Resumen.jsx'
import Cohortes from './vistas/Cohortes.jsx'
import Segmentos from './vistas/Segmentos.jsx'
import Decisiones from './vistas/Decisiones.jsx'
import Usuarios from './vistas/Usuarios.jsx'
import Configuracion from './vistas/Configuracion.jsx'
import './ritmo.css'

const VISTAS = [
  ['resumen', 'Resumen'],
  ['cohortes', 'Cohortes'],
  ['segmentos', 'Segmentos y niveles'],
  ['decisiones', 'Decisiones'],
  ['usuarios', 'Usuarios'],
  ['configuracion', 'Configuración'],
]

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 18px' }}>
      <span style={{ width: 42, height: 42, borderRadius: 8, background: '#15152B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="26" height="18" viewBox="0 0 30 20" fill="none" stroke="#C6F432" strokeWidth="3.2" aria-hidden="true"><rect x="2" y="5" width="15" height="11" rx="5.5" /><rect x="13" y="4" width="15" height="11" rx="5.5" /></svg>
      </span>
      <span><span style={{ display: 'block', fontWeight: 800, fontSize: 19 }}>Credirecto</span><span className="rt-lbl">· Panel interno</span></span>
    </div>
  )
}

/** Bloque "Reloj de demo" con los botones siempre visibles: Avanzar un día y Reiniciar demo. */
function RelojDemo() {
  const { tasa, ocupado, aviso, avanzar, reiniciar } = useDemo()
  const { datos } = useDatos((f) => f.reloj())
  const [confirmar, setConfirmar] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const tConfirmar = useRef()

  // Contador mientras reinicia (tarda ~1 min)
  useEffect(() => {
    if (ocupado !== 'reset') return undefined
    setSegundos(0)
    const t = setInterval(() => setSegundos((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [ocupado])
  useEffect(() => () => clearTimeout(tConfirmar.current), [])

  const pedirReinicio = () => {
    if (!confirmar) {
      setConfirmar(true)
      clearTimeout(tConfirmar.current)
      tConfirmar.current = setTimeout(() => setConfirmar(false), 4000)
      return
    }
    setConfirmar(false)
    reiniciar()
  }

  const tasaTxt = '1 USD = Bs ' + Number(tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const bloqueado = !!ocupado

  return (
    <div style={{ marginTop: 20, background: '#F3F4F8', borderRadius: 10, padding: 14 }}>
      <div className="rt-lbl">Reloj de demo</div>
      <div style={{ fontWeight: 700, marginTop: 2 }}>{datos ? fechaReloj(datos.hoy) : '—'}</div>
      <div className="rt-lbl" style={{ marginTop: 6 }}>{tasaTxt}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        <button type="button" className="rt-btn rt-btn-primario rt-btn-chico" disabled={bloqueado} onClick={() => avanzar(1)}>
          {ocupado === 'dia' ? <><Spinner chico /> Avanzando…</> : 'Avanzar un día'}
        </button>
        <button type="button" className="rt-btn rt-btn-borde rt-btn-chico" disabled={bloqueado} onClick={pedirReinicio}
          style={confirmar ? { borderColor: '#B42318', color: '#B42318' } : undefined}>
          {ocupado === 'reset' ? <><Spinner chico /> Reiniciando… {segundos} s</> : confirmar ? '¿Seguro? Pulsa otra vez' : 'Reiniciar demo'}
        </button>
      </div>

      {ocupado === 'reset' && (
        <div className="rt-lbl" style={{ marginTop: 8, lineHeight: 1.35 }} role="status">Recargando los datos sintéticos. Tarda cerca de 1 minuto.</div>
      )}
      {!ocupado && aviso && (
        <div role={aviso.tipo === 'error' ? 'alert' : 'status'}
          style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.35, fontWeight: 600, color: aviso.tipo === 'error' ? '#B42318' : '#3F6212' }}>
          {aviso.texto}
        </div>
      )}
      {USAR_MOCK && <div className="rt-lbl" style={{ marginTop: 8, fontSize: 11.5 }}>Datos simulados (VITE_MOCK=1)</div>}
    </div>
  )
}

function Menu() {
  return (
    <nav className="rt-side" aria-label="Vistas de Credirecto">
      <Logo />
      {VISTAS.map(([ruta, nombre]) => (
        <NavLink key={ruta} to={`/dashboard/${ruta}`} className={({ isActive }) => (isActive ? 'on' : undefined)}>{nombre}</NavLink>
      ))}
      <RelojDemo />
    </nav>
  )
}

/** Al cambiar de vista (no al abrir una ficha dentro de Usuarios) vuelve arriba. */
function ScrollArriba() {
  const { pathname } = useLocation()
  const vista = pathname.split('/')[2] || ''
  useEffect(() => { window.scrollTo(0, 0) }, [vista])
  return null
}

export default function DashboardRoot() {
  useEffect(() => {
    const anterior = document.title
    document.title = 'Credirecto'
    return () => { document.title = anterior }
  }, [])

  return (
    <DemoProvider>
      <ScrollArriba />
      <div className="rt-wrap">
        <Menu />
        <main className="rt-main">
          <Routes>
            <Route index element={<Navigate to="/dashboard/resumen" replace />} />
            <Route path="resumen" element={<Resumen />} />
            <Route path="cohortes" element={<Cohortes />} />
            <Route path="segmentos" element={<Segmentos />} />
            <Route path="decisiones" element={<Decisiones />} />
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="usuarios/:id" element={<Usuarios />} />
            <Route path="configuracion" element={<Configuracion />} />
            <Route path="*" element={<Navigate to="/dashboard/resumen" replace />} />
          </Routes>
        </main>
      </div>
    </DemoProvider>
  )
}
