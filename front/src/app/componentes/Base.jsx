// Piezas compartidas de la app: Pantalla, Encabezado, BarraInferior, Tarjeta, BotonPildora,
// TarjetaCredirecto, Avatar y MensajeError.
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexto.js'
import { fondoCD } from '../util.js'
import {
  IcoHome, IcoMenu, IcoMisPagos, IcoMovimientos, IcoSoporte, IcoUsuario, IcoVolver,
} from './Iconos.jsx'

/**
 * Lienzo de 390×844 con zona desplazable. `pie` queda fijo abajo (botones de acción de los diseños)
 * y `nav` muestra la barra inferior con la mascota. `reserva` = espacio libre al final del contenido.
 */
export function Pantalla({ children, pie, nav, padding = '22px 0 0', reserva, fondo = '#F3F4F8' }) {
  const abajo = reserva ?? (nav ? 120 : pie ? 170 : 40)
  return (
    <div style={{ position: 'absolute', inset: 0, background: fondo }}>
      <div className="cd-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', padding }}>
        {children}
        <div style={{ height: abajo }} aria-hidden="true" />
      </div>
      {pie && (
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 30, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 4 }}>
          {pie}
        </div>
      )}
      {nav && <BarraInferior />}
    </div>
  )
}

/** Botón circular blanco (volver, soporte, notificaciones…) */
export function BotonCircular({ tamano = 50, children, style, ...resto }) {
  return <button className="cd-cb" style={{ width: tamano, height: tamano, ...style }} {...resto}>{children}</button>
}

/** Encabezado: volver (izq.), título centrado, soporte (der.) */
export function Encabezado({ titulo, centro, volverA = '/app', tamano = 50 }) {
  const navegar = useNavigate()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
      <BotonCircular tamano={tamano} aria-label="Volver" onClick={() => navegar(volverA)}><IcoVolver /></BotonCircular>
      {centro ?? <span style={{ fontSize: 19, fontWeight: 600, color: '#5D5D70' }}>{titulo}</span>}
      <BotonSoporte tamano={tamano} />
    </div>
  )
}

export function BotonSoporte({ tamano = 50 }) {
  const { avisar } = useApp()
  return (
    <BotonCircular tamano={tamano} aria-label="Soporte" onClick={() => avisar('Soporte PagoDirecto: escríbenos y te ayudamos en minutos.')}>
      <IcoSoporte />
    </BotonCircular>
  )
}

/** Barra inferior: Home, Movimientos, [mascota], Mis pagos, Menú */
export function BarraInferior({ activo = 'home' }) {
  const navegar = useNavigate()
  const { avisar } = useApp()
  const pronto = () => avisar('Esta sección no forma parte de la demo de Credirecto.')
  const color = (k) => ({ color: activo === k ? '#E0124F' : undefined })
  return (
    <>
      <nav className="cd-nav" aria-label="Navegación principal">
        <button className="cd-ni" style={color('home')} onClick={() => navegar('/app')}><IcoHome />Home</button>
        <button className="cd-ni" style={color('mov')} onClick={pronto}><IcoMovimientos />Movimientos</button>
        <span />
        <button className="cd-ni" style={color('pagos')} onClick={pronto}><IcoMisPagos />Mis pagos</button>
        <button className="cd-ni" style={color('menu')} onClick={pronto}><IcoMenu />Menú</button>
      </nav>
      <div className="cd-masc">Mascota</div>
    </>
  )
}

/** Tarjeta blanca radio 28 con sombra */
export function Tarjeta({ children, style, ...resto }) {
  return <div className="cd-card" style={style} {...resto}>{children}</div>
}

/** Botón píldora: primario rosa (58 px) o secundario gris (52 px) */
export function BotonPildora({ variante = 'primario', children, style, cargando, disabled, ...resto }) {
  const base = variante === 'primario'
    ? { height: 58, background: '#FF1F5A', color: '#fff', font: "700 19px 'Outfit',sans-serif", boxShadow: '0 10px 24px rgba(255,31,90,.3)' }
    : { height: 52, background: '#E8EAF0', color: '#15152B', font: "600 16px 'Outfit',sans-serif" }
  return (
    <button
      style={{ border: 0, borderRadius: 999, ...base, opacity: disabled || cargando ? 0.6 : 1, ...style }}
      disabled={disabled || cargando}
      {...resto}
    >
      {cargando ? 'Un momento…' : children}
    </button>
  )
}

/** Tarjeta oscura de Credirecto con brillo lima */
export function TarjetaCredirecto({ children, style, forma, a, p1, p2 }) {
  return (
    <div style={{ borderRadius: 28, color: '#fff', background: fondoCD(forma, a, p1, p2), ...style }}>{children}</div>
  )
}

/** Avatar gris del encabezado del home */
export function Avatar({ tamano = 52 }) {
  return (
    <div style={{ width: tamano, height: tamano, borderRadius: '50%', background: '#E3E5EC', border: '3px solid #fff', boxShadow: '0 0 0 2px #D5D8E1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8DA0', flex: 'none' }}>
      <IcoUsuario />
    </div>
  )
}

/** Error legible (p. ej. el `detail` de un 409). Se desplaza a la vista sin quedar tapado por el pie fijo. */
export function MensajeError({ children, style }) {
  const ref = useRef(null)
  useEffect(() => {
    if (children) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [children])
  if (!children) return null
  return <div ref={ref} className="cd-error" role="alert" style={{ scrollMarginBottom: 190, ...style }}>{children}</div>
}
