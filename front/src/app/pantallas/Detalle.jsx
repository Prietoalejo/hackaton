// Pantalla 03 · Detalle de Credirecto: tickets usados/disponibles, pestañas Cuotas y Movimientos,
// "Camino a" el siguiente nivel y servicios cubiertos por el nivel.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bs, fechaCorta, fechaLarga, fechaNumerica, NIVELES } from '../../formato.js'
import { useApp } from '../contexto.js'
import { datos, mensajeError } from '../datos.js'
import {
  BENEFICIO_NIVEL, cupoServicios, descripcionTicket, esDiaDeCobro, horaAhora, numeroTicket, plural, SERVICIOS_NIVEL, ticketsOrdenados,
} from '../util.js'
import { BotonPildora, Encabezado, MensajeError, Pantalla, Tarjeta } from '../componentes/Base.jsx'
import { IcoCandado, IcoCheck, IcoFlecha, IcoServicio, IcoTicket, LogoCD } from '../componentes/Iconos.jsx'

export default function Detalle() {
  const { ficha } = useApp()
  const navegar = useNavigate()
  const [pestana, setPestana] = useState('cuotas')
  const { total, usados, disponibles } = ficha.tickets
  const serv = cupoServicios(ficha)

  if (!ficha.habilitado) {
    return (
      <Pantalla padding="20px 0 0">
        <Encabezado tamano={46} centro={<Titulo />} />
        <div style={{ padding: '24px 16px 0' }}>
          <Tarjeta style={{ padding: 22, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Aún no tienes Credirecto</div>
            <div className="cd-mut" style={{ marginTop: 6, lineHeight: 1.4 }}>Completa los pasos del home y lo activamos para ti.</div>
            <BotonPildora style={{ marginTop: 16, width: '100%' }} onClick={() => navegar('/app')}>Ver mis pasos</BotonPildora>
          </Tarjeta>
        </div>
      </Pantalla>
    )
  }

  const tab = (activa) => ({
    height: 46, border: 0, borderRadius: 999, font: "600 17px 'Outfit',sans-serif",
    background: activa ? '#FF1F5A' : 'transparent', color: activa ? '#fff' : '#4A4A5E',
  })

  return (
    <Pantalla padding="20px 0 0" reserva={40}>
      <Encabezado tamano={46} centro={<Titulo />} />

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <span style={{ display: 'inline-block', fontSize: 13, color: '#5D5D70', background: '#fff', padding: '5px 16px', borderRadius: 999, boxShadow: '0 2px 10px rgba(21,21,43,.05)' }}>
          Credirecto {ficha.nivel_nombre} · {ficha.club || 'para tus pagos'}
        </span>
        <div style={{ fontSize: 38, fontWeight: 700, marginTop: 6, letterSpacing: '-.01em' }}>{disponibles} de {total} tickets</div>
        {serv.total > 0 && (
          <div style={{ fontSize: 17, fontWeight: 600, color: '#3B6B00' }}>+ {serv.disponibles} de {plural(serv.total, 'pago', 'pagos')} de servicios</div>
        )}
      </div>

      {/* Tarjeta en perspectiva (decorativa) */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center', marginTop: 8, height: 150, perspective: 700 }}>
        <div style={{ width: 250, height: 150, borderRadius: 22, transform: 'rotateX(46deg) rotateZ(-4deg)', transformOrigin: '50% 100%', background: 'radial-gradient(90% 80% at 10% 105%, #C6F432 0%, rgba(160,210,20,.6) 30%, rgba(22,24,22,0) 65%), linear-gradient(160deg, #2A2D2A 0%, #121412 75%)', boxShadow: '0 26px 30px rgba(18,20,18,.28), inset 0 -4px 0 rgba(255,255,255,.08)', borderBottom: '4px solid #fff' }} />
      </div>

      <div style={{ padding: '0 16px' }}>
        <Tarjeta style={{ marginTop: -36, padding: '50px 20px 22px', position: 'relative', zIndex: 1 }}>
          <div className="cd-mut" style={{ textAlign: 'center', fontSize: 16 }}>Tus tickets · {plural(usados, 'usado', 'usados')}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: total >= 4 ? 14 : 22, marginTop: 14 }}>
            {Array.from({ length: total }, (_, i) => {
              const usado = i < usados
              return (
                <div className="cd-tc" key={i}>
                  <span className="cd-ci" style={usado
                    ? { background: '#E2E4EA', color: '#5D5D70' }
                    : { background: '#C6F432', color: '#2A2D2A', boxShadow: '0 6px 14px rgba(160,210,20,.35)' }}>
                    <IcoTicket w={30} h={26} sw={1.6} />
                  </span>
                  {usado ? 'Usado' : i + 1}
                </div>
              )
            })}
          </div>
        </Tarjeta>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', background: '#fff', borderRadius: 999, padding: 6, boxShadow: '0 6px 20px rgba(21,21,43,.05)' }}>
          <button onClick={() => setPestana('cuotas')} style={tab(pestana === 'cuotas')}>Cuotas</button>
          <button onClick={() => setPestana('mov')} style={tab(pestana === 'mov')}>Movimientos</button>
        </div>
        {pestana === 'cuotas' ? <Cuotas /> : <Movimientos />}
      </div>

      {ficha.progreso && <CaminoA progreso={ficha.progreso} />}
      <ServiciosCubiertos />
    </Pantalla>
  )
}

const Titulo = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <LogoCD w={38} h={26} color="#9CCB12" sw={3.4} />
    <span style={{ fontWeight: 600, fontSize: 26, letterSpacing: '-.01em' }}>Credirecto</span>
  </div>
)

/** Texto y color de la línea de estado de una cuota */
function estadoCuota(ficha, t) {
  switch (t.estado) {
    case 'gracia': return { txt: `Venció el ${fechaCorta(t.vence)} · sin comisión hasta el ${fechaCorta(t.gracia_hasta)}`, c: '#B86500' }
    case 'atrasado':
    case 'mora': return { txt: `Venció el ${fechaCorta(t.vence)} · incluye comisión ${bs(t.comision)}`, c: '#D6104D' }
    case 'pausa_tecnica': return { txt: 'En pausa por una falla técnica · sin cobro', c: '#6B6B80' }
    case 'disputa': return { txt: 'En revisión por tu reclamo', c: '#6B6B80' }
    default: return {
      txt: `Vence el ${fechaLarga(t.vence)}${esDiaDeCobro(ficha, t.vence) ? ', tu día de cobro' : ''}`,
      c: '#3B6B00',
    }
  }
}

function Cuotas() {
  const { ficha, recargarFicha } = useApp()
  const navegar = useNavigate()
  const lista = ticketsOrdenados(ficha)
  const [sel, setSel] = useState(lista[0]?.id ?? null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const elegido = lista.find((t) => t.id === sel)

  const pagar = async () => {
    if (!elegido) return
    if (elegido.estado === 'gracia') { navegar(`/app/gracia/${elegido.id}`); return }
    setCargando(true); setError(null)
    try {
      const r = await datos.pagar({ user_id: ficha.user_id, ticket_id: elegido.id, monto: elegido.deuda, origen: 'usuario' })
      const numero = numeroTicket(ficha, elegido.id)
      // Primero navegamos (la cuota desaparece de la ficha al refrescarla)
      navegar('/app/comprobante', { state: { ...r, numero, nivel: ficha.nivel_nombre, hora: horaAhora() } })
      recargarFicha()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }

  if (!lista.length) {
    return (
      <>
        <Tarjeta style={{ marginTop: 14, padding: 20, textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>No tienes cuotas pendientes</div>
          <div className="cd-mut" style={{ fontSize: 14, marginTop: 4 }}>Usa un ticket para pagar un servicio y lo pagas después.</div>
          <BotonPildora style={{ marginTop: 14, width: '100%', height: 52, fontSize: 17 }} onClick={() => navegar('/app/pago')}>Pagar con ticket</BotonPildora>
        </Tarjeta>
        <Nota total={ficha.tickets.total} servicios={cupoServicios(ficha).total} />
      </>
    )
  }

  return (
    <>
      {lista.map((t, i) => {
        const e = estadoCuota(ficha, t)
        const activa = t.id === sel
        return (
          <Tarjeta key={t.id} role="radio" aria-checked={activa} tabIndex={0} onClick={() => setSel(t.id)}
            style={{ marginTop: 14, padding: 18, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', boxShadow: activa ? '0 0 0 2px #FF1F5A, 0 8px 28px rgba(21,21,43,.06)' : undefined }}>
            <span style={{ width: 24, height: 24, borderRadius: '50%', border: activa ? '0' : '2px solid #B9BCCB', background: activa ? '#FF1F5A' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
              {activa && <IcoCheck w={14} />}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><LogoCD w={26} h={18} color="#9CCB12" sw={3.4} /><span style={{ fontWeight: 700, fontSize: 17 }}>Credirecto</span></div>
              <div style={{ fontSize: 14, marginTop: 2 }}>Ticket {i + 1} · {descripcionTicket(t)}</div>
              <div style={{ fontSize: 13, color: e.c, fontWeight: 500 }}>{e.txt}</div>
              {t.oferta_quincena && t.estado === 'abierto' && (
                <button onClick={(ev) => { ev.stopPropagation(); navegar(`/app/quincena/${t.id}`) }}
                  style={{ marginTop: 6, border: 0, background: '#F1FBD2', color: '#2C4F00', borderRadius: 999, padding: '4px 10px', font: "600 12px 'Outfit',sans-serif" }}>
                  Mover al {fechaCorta(t.oferta_quincena)}, tu quincena
                </button>
              )}
            </div>
            <span style={{ fontWeight: 700, fontSize: 17, whiteSpace: 'nowrap' }}>{bs(t.deuda)}</span>
          </Tarjeta>
        )
      })}
      <MensajeError style={{ marginTop: 12 }}>{error}</MensajeError>
      {elegido && (
        <BotonPildora style={{ width: '100%', marginTop: 14, height: 54, fontSize: 18 }} cargando={cargando} onClick={pagar}>
          {elegido.estado === 'gracia' ? 'Ver mi cuota' : `Pagar ${bs(elegido.deuda)}`}
        </BotonPildora>
      )}
      <Nota total={ficha.tickets.total} servicios={cupoServicios(ficha).total} />
    </>
  )
}

const Nota = ({ total, servicios }) => (
  <div className="cd-mut" style={{ textAlign: 'center', fontSize: 13, marginTop: 12, padding: '0 24px' }}>
    Hasta {plural(total, 'ticket', 'tickets')}{servicios > 0 ? ` y ${plural(servicios, 'pago', 'pagos')} de servicios` : ''} por período · Paga tu cuota y vuelve a estar disponible · Todo en bolívares
  </div>
)

function Movimientos() {
  const { ficha } = useApp()
  const movs = (ficha.linea_de_tiempo || []).filter((m) => m.tipo === 'Ticket' || m.tipo === 'Pago')
  if (!movs.length) {
    return <Tarjeta style={{ marginTop: 14, padding: 20, textAlign: 'center' }} className="cd-card cd-mut">Aún no tienes movimientos de Credirecto.</Tarjeta>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
      {movs.map((m, i) => {
        const credito = m.tipo === 'Ticket'
        const col = credito ? { bg: '#E9F9B4', fg: '#3B7A00' } : { bg: '#FFE3EA', fg: '#D6104D' }
        // "Ticket · Estacionamiento C.C. El Tolón · cuota 7 nov" → partes
        const partes = (m.texto || '').split(' · ')
        const titulo = credito ? `Dinero otorgado · ${partes[1] || ''}` : 'Cuota pagada'
        const extra = credito ? partes.slice(2).join(' · ') : partes.slice(1).join(' · ')
        return (
          <div className="cd-mv" key={i}>
            <span className="cd-ar" style={{ background: col.bg, color: col.fg }}><IcoFlecha sube={credito} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><LogoCD w={22} h={15} color="#9CCB12" sw={3.6} /><span style={{ fontWeight: 700, fontSize: 15 }}>Credirecto</span></div>
              <div style={{ fontSize: 14 }}>{titulo}</div>
              <div className="cd-mut" style={{ fontSize: 12 }}>{fechaNumerica(m.fecha)}{extra ? ` · ${extra}` : ''}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="cd-chip" style={{ background: col.bg, color: col.fg }}>{credito ? 'CRÉDITO' : 'DÉBITO'}</span>
              <div style={{ fontWeight: 700, fontSize: 17, marginTop: 6, color: col.fg, whiteSpace: 'nowrap' }}>{credito ? '+' : '-'} {bs(m.monto || 0)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CaminoA({ progreso: p }) {
  const n = Math.max(1, p.repagos_requeridos)
  return (
    <div style={{ padding: '20px 16px 0' }}>
      <Tarjeta style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Camino a {p.siguiente_nombre}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#3B6B00', background: '#F1FBD2', padding: '4px 10px', borderRadius: 999 }}>{p.repagos_hechos} de {p.repagos_requeridos}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 5, marginTop: 12 }} aria-hidden="true">
          {Array.from({ length: n }, (_, i) => (
            <span key={i} style={{ height: 10, borderRadius: 5, background: i < p.repagos_hechos ? '#8CC20B' : '#E6E8EE' }} />
          ))}
        </div>
        {p.faltan_pts_club > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 12, fontSize: 14, background: '#FFE8EF', color: '#A3165E', borderRadius: 14, padding: '8px 12px' }}>
            <span>Llega a <b>{p.ruta_requerida}</b> en el Club PagoDirecto</span>
            <b style={{ whiteSpace: 'nowrap' }}>faltan {p.faltan_pts_club.toLocaleString('es-VE')} pts</b>
          </div>
        )}
        <div style={{ fontSize: 15, marginTop: 10, lineHeight: 1.35 }}>
          {p.faltan_repagos > 0
            ? <>Paga a tiempo <b>{p.faltan_repagos === 1 ? '1 vez más' : `${p.faltan_repagos} veces más`}</b> para llegar a <b>Credirecto {p.siguiente_nombre}</b>.</>
            : p.faltan_pts_club > 0
              ? <>Ya tienes los pagos a tiempo. Sigue sumando puntos en el Club para llegar a <b>Credirecto {p.siguiente_nombre}</b>.</>
              : <>¡Ya casi! Sigue pagando a tiempo y pronto llegas a <b>Credirecto {p.siguiente_nombre}</b>.</>}
        </div>
        <div className="cd-mut" style={{ fontSize: 13, marginTop: 4 }}>{BENEFICIO_NIVEL[p.siguiente_nivel]}</div>
      </Tarjeta>
    </div>
  )
}

function ServiciosCubiertos() {
  const { ficha } = useApp()
  const cubiertos = ficha.tickets.servicios || []
  return (
    <div style={{ padding: '14px 16px 0' }}>
      <Tarjeta style={{ padding: '18px 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 16, padding: '0 4px' }}>Tu nivel cubre</div>
        <div className="cd-mut" style={{ fontSize: 13, padding: '2px 4px 0' }}>Los tickets pagan movilidad; los pagos de servicios, tus facturas</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '14px 6px', marginTop: 14 }}>
          {SERVICIOS_NIVEL.map((s) =>
            cubiertos.includes(s.clave) ? (
              <div className="cd-sv" key={s.clave}>
                <span className="cd-si"><IcoServicio servicio={s.clave} /></span>
                {s.clave === 'estacionamiento' ? <span>Estaciona-<br />miento</span> : s.nombre}
              </div>
            ) : (
              <div className="cd-sv" key={s.clave} style={{ gridColumn: 'span 2', flexDirection: 'row', textAlign: 'left', gap: 10, background: '#F3F4F8', borderRadius: 18, padding: '8px 10px' }}>
                <span style={{ width: 44, height: 44, borderRadius: 14, background: '#E6E8EE', color: '#6B6B80', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', flex: 'none' }}>
                  <IcoServicio servicio={s.clave} w={22} />
                  <span style={{ position: 'absolute', right: -5, bottom: -5, width: 22, height: 22, borderRadius: '50%', background: '#15152B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcoCandado /></span>
                </span>
                <span>
                  <span style={{ display: 'block', fontWeight: 600, color: '#4A4A5E' }}>{s.nombre}</span>
                  <span className="cd-mut" style={{ fontSize: 12 }}>Disponible en {NIVELES[s.nivel]}</span>
                </span>
              </div>
            ),
          )}
        </div>
      </Tarjeta>
    </div>
  )
}
