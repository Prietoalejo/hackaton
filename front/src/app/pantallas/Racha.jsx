// Pantalla 07 · Racha de pagos (`racha` de la ficha) con el botón Pagar de la próxima cuota.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { aFecha, bs, fechaCorta } from '../../formato.js'
import { useApp } from '../contexto.js'
import { datos, mensajeError } from '../datos.js'
import { fondoCD, horaAhora, numeroTicket, proximoTicket, sumarDias } from '../util.js'
import { Encabezado, MensajeError, Pantalla, Tarjeta } from '../componentes/Base.jsx'
import { IcoCheck, IcoReloj, LogoCD } from '../componentes/Iconos.jsx'

const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

export default function Racha() {
  const { ficha, hoy, recargarFicha, avisar } = useApp()
  const navegar = useNavigate()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const r = ficha.racha || { pagos: 0, meta: 3, quedan_dias: 0, multiplicador: false }
  const faltan = Math.max(0, r.meta - r.pagos)
  const club = ficha.club_puntos || { puntos_por_pago: 100, multiplicador: 1.5, puntos_credirecto: 0 }
  const ticket = proximoTicket(ficha)

  // Semana actual (lunes a domingo): días con pago marcados, días pasados sin pago tachados
  const base = hoy || new Date().toISOString().slice(0, 10)
  const lunes = sumarDias(base, -((aFecha(base).getDay() + 6) % 7))
  const pagos = new Set((ficha.linea_de_tiempo || []).filter((m) => m.tipo === 'Pago').map((m) => m.fecha))
  const semana = LETRAS.map((l, i) => {
    const iso = sumarDias(lunes, i)
    return { l, iso, pago: pagos.has(iso), pasado: iso < base, esHoy: iso === base }
  })

  const pagar = async () => {
    if (!ticket) return
    if (ticket.estado === 'gracia') { navegar(`/app/gracia/${ticket.id}`); return }
    setCargando(true); setError(null)
    try {
      const res = await datos.pagar({ user_id: ficha.user_id, ticket_id: ticket.id, monto: ticket.deuda, origen: 'usuario' })
      const numero = numeroTicket(ficha, ticket.id)
      // Primero navegamos (la cuota desaparece de la ficha al refrescarla)
      navegar('/app/comprobante', { state: { ...res, numero, nivel: ficha.nivel_nombre, hora: horaAhora() } })
      recargarFicha()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }

  const recargaDecorativa = () => avisar('Las recargas telefónicas son parte de PagoDirecto; en esta demo solo probamos Credirecto.')

  return (
    <Pantalla reserva={40}>
      <Encabezado titulo="Racha de pagos" />

      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ borderRadius: 30, padding: '24px 20px 22px', color: '#fff', position: 'relative', background: 'linear-gradient(135deg,#0E0F2A 0%,#3A1440 45%,#A3165E 80%,#FF1F5A 100%)', boxShadow: '0 14px 34px rgba(58,20,64,.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 84, fontWeight: 700, lineHeight: 1 }}>{r.pagos}</span>
            <span style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1 }}>de {r.meta}<br />pagos</span>
          </div>
          <div style={{ position: 'absolute', right: 18, top: 18, width: 92, height: 92, borderRadius: '50%', border: '2px dashed rgba(255,255,255,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#F2E6EE' }}>Mascota</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 22 }}>
            {semana.map((d) => {
              if (d.pago) return <span key={d.iso} className="cd-dy" style={{ background: '#FF1F5A' }} title={fechaCorta(d.iso)}><IcoCheck w={16} sw={3} color="#fff" /></span>
              if (d.esHoy) return <span key={d.iso} className="cd-dy" style={{ background: '#fff', color: '#15152B' }} title="Hoy">{d.l}</span>
              if (d.pasado) return <span key={d.iso} className="cd-dy" style={{ background: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.6)', textDecoration: 'line-through' }}>{d.l}</span>
              return <span key={d.iso} className="cd-dy" style={{ background: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.75)' }}>{d.l}</span>
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 15 }}><span>Racha de 7 días</span><span style={{ fontWeight: 700 }}>{r.pagos} / {r.meta} pagos</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, r.meta)}, minmax(0, 1fr))`, gap: 8, marginTop: 10 }} aria-hidden="true">
            {Array.from({ length: r.meta }, (_, i) => <span key={i} style={{ height: 8, borderRadius: 4, background: i < r.pagos ? '#fff' : 'rgba(255,255,255,.3)' }} />)}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 14 }}>
            {r.multiplicador ? '¡Tienes el ×1,5 activo en el Club!' : `Completa ${r.meta} pagos y activa el ×1,5`}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, padding: '16px 16px 0' }}>
        <Tarjeta style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #FFB3C7', color: '#E0124F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flex: 'none' }}>×1,5</span>
          <span><span className="cd-mut" style={{ display: 'block', fontSize: 13 }}>Multiplicador</span>
            <span style={{ fontWeight: 700 }}>{r.multiplicador || faltan === 0 ? '¡Activo!' : `Te ${faltan === 1 ? 'falta 1 pago' : `faltan ${faltan} pagos`}`}</span></span>
        </Tarjeta>
        <Tarjeta style={{ padding: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <IcoReloj w={30} color="#E0124F" style={{ flex: 'none' }} />
          <span><span className="cd-mut" style={{ display: 'block', fontSize: 13 }}>El reloj corre</span>
            <span style={{ fontWeight: 700 }}>{r.quedan_dias > 0 ? `Quedan ${r.quedan_dias} ${r.quedan_dias === 1 ? 'día' : 'días'}` : 'Empieza hoy'}</span></span>
        </Tarjeta>
      </div>

      {/* Los puntos son los del Club PagoDirecto: Credirecto solo los suma */}
      <div style={{ padding: '12px 16px 0' }}>
        <Tarjeta style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Club PagoDirecto</span>
            <span className="cd-mut" style={{ fontSize: 13 }}>{ficha.club || 'Nivel Turista'}</span>
          </div>
          <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.4 }}>
            Cada cuota pagada a tiempo suma <b>{club.puntos_por_pago} pts</b> a tu ruta del Club; si pagas antes o completas la racha, <b>{Math.round(club.puntos_por_pago * club.multiplicador)} pts</b>.
          </div>
          {club.puntos_credirecto > 0 && (
            <div style={{ display: 'inline-block', marginTop: 10, fontSize: 13, fontWeight: 600, color: '#A3165E', background: '#FFE8EF', padding: '5px 12px', borderRadius: 999 }}>
              {club.puntos_credirecto.toLocaleString('es-VE')} pts ganados con Credirecto
            </div>
          )}
        </Tarjeta>
      </div>

      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Paga y entra en racha</div>
        <div className="cd-mut" style={{ fontSize: 14 }}>Cualquiera de estos pagos suma</div>
      </div>
      <MensajeError style={{ margin: '12px 16px 0' }}>{error}</MensajeError>
      <div className="cd-scroll" style={{ display: 'flex', gap: 12, padding: '14px 16px 16px', overflowX: 'auto' }}>
        <div className="cd-pc" style={{ color: '#fff', background: fondoCD('120% 70% at 90% 115%', 0.5, 30, 64), boxShadow: '0 8px 22px rgba(18,20,18,.22)' }}>
          <LogoCD w={40} h={26} />
          <span style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>Cuota Credirecto</span>
          {ticket ? (
            <>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#D7F86E' }}>{bs(ticket.deuda)}</span>
              <span style={{ fontSize: 12, color: '#D5D8CF' }}>Ticket {numeroTicket(ficha, ticket.id)} · vence {fechaCorta(ticket.vence)}</span>
              <button className="cd-rb" disabled={cargando} onClick={pagar} style={{ background: '#FF1F5A', color: '#fff', fontWeight: 700, opacity: cargando ? 0.6 : 1 }}>
                {cargando ? 'Pagando…' : 'Pagar'}
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#D7F86E' }}>Estás al día</span>
              <span style={{ fontSize: 12, color: '#D5D8CF' }}>Sin cuotas pendientes</span>
              <button className="cd-rb" onClick={() => navegar('/app/pago')} style={{ background: '#FF1F5A', color: '#fff', fontWeight: 700 }}>Usar ticket</button>
            </>
          )}
        </div>
        <div className="cd-pc cd-card">
          <span style={{ fontSize: 22, fontWeight: 800, color: '#1A9BDB', fontStyle: 'italic', height: 34 }}>movistar</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>04149205479</span>
          <span className="cd-mut" style={{ fontSize: 13 }}>Movistar</span>
          <button className="cd-rb" onClick={recargaDecorativa} style={{ background: '#EEF0F5', color: '#1C2C6B', marginTop: 22 }}>Recargar</button>
        </div>
        <div className="cd-pc cd-card">
          <span style={{ fontSize: 20, fontWeight: 800, color: '#B0105E', letterSpacing: '.04em', height: 34 }}>DIGITEL</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Digitel</span>
          <span className="cd-mut" style={{ fontSize: 13 }}>Prepago</span>
          <button className="cd-rb" onClick={recargaDecorativa} style={{ background: '#EEF0F5', color: '#1C2C6B', marginTop: 22 }}>Recargar</button>
        </div>
      </div>
    </Pantalla>
  )
}
