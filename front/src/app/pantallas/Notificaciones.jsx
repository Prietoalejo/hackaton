// Pantalla 10 · Notificaciones push (pantalla de bloqueo) con las `notificaciones` de la ficha.
import { useNavigate } from 'react-router-dom'
import { useApp } from '../contexto.js'
import { diasEntre, fechaPantallaBloqueo } from '../util.js'

/** "ahora" / "hoy" / "ayer" / "hace 3 días" */
const cuando = (fecha, hoy, primera) => {
  const d = hoy ? diasEntre(fecha, hoy) : 0
  if (d <= 0) return primera ? 'ahora' : 'hoy'
  if (d === 1) return 'ayer'
  return `hace ${d} días`
}

export default function Notificaciones() {
  const { ficha, hoy } = useApp()
  const navegar = useNavigate()
  // Más recientes primero; caben 4 sobre la barra de inicio
  const lista = [...(ficha.notificaciones || [])].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 4)

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: "'Outfit',system-ui,sans-serif", color: '#fff', background: 'radial-gradient(70% 45% at 100% 30%, rgba(198,244,50,.55) 0%, rgba(198,244,50,0) 70%), radial-gradient(80% 50% at 0% 95%, rgba(255,31,90,.5) 0%, rgba(255,31,90,0) 70%), linear-gradient(180deg,#141614 0%,#1E2A12 60%,#121412 100%)' }}>
      <div style={{ textAlign: 'center', paddingTop: 74 }}>
        <div style={{ fontSize: 19, fontWeight: 500, opacity: 0.9 }}>{hoy ? fechaPantallaBloqueo(hoy) : ''}</div>
        <div style={{ fontSize: 92, fontWeight: 300, lineHeight: 1, marginTop: 4, letterSpacing: '-.02em' }}>9:41</div>
      </div>
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 120, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lista.length === 0 && (
          <div style={{ textAlign: 'center', fontSize: 15, opacity: 0.8 }}>No tienes notificaciones de Credirecto.</div>
        )}
        {lista.map((n, i) => (
          <button key={i} className="cd-n" onClick={() => navegar(ficha.habilitado ? '/app/detalle' : '/app')}>
            <span className="cd-ic">p</span>
            <div style={{ flex: 1 }}>
              <div className="cd-hd"><span>PagoDirecto</span><span>{cuando(n.fecha, hoy, i === 0)}</span></div>
              <div className="cd-tt">{n.titulo}</div>
              <div className="cd-bd">{n.mensaje}</div>
            </div>
          </button>
        ))}
      </div>
      <button aria-label="Volver al inicio" onClick={() => navegar('/app')}
        style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', width: 160, height: 18, border: 0, background: 'none', padding: 0 }}>
        <span style={{ display: 'block', margin: '0 auto', width: 134, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.85)' }} />
      </button>
    </div>
  )
}
