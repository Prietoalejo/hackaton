// Pantallas 01 (home sin Credirecto) y 02 (home habilitado). Si el usuario está en modo
// recuperación se muestra la 09. Si tiene un ticket en gracia aparece un aviso que lleva a la 08.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bs, fechaCorta } from '../../formato.js'
import { useApp } from '../contexto.js'
import { cupoServicios, diasEntre, fondoCD, plural, proximoTicket, ticketEnGracia } from '../util.js'
import { Avatar, BotonCircular, BotonSoporte, Pantalla, Tarjeta } from '../componentes/Base.jsx'
import {
  IcoCampana, IcoCheck, IcoClub, IcoDepositar, IcoEnviar, IcoLlama, IcoMas, IcoReloj, IcoServicio, IcoTicket, LogoCD,
} from '../componentes/Iconos.jsx'
import { LogoCredirecto, MarcaPagoDirecto } from '../../marcas.jsx'
import Recuperacion from './Recuperacion.jsx'

const POS = { wallet: 0, credirecto: -314, banco: -580 }

export default function Home() {
  const { ficha } = useApp()
  if (ficha.modo_recuperacion) return <Recuperacion />
  return <HomeNormal />
}

function HomeNormal() {
  const { ficha, hoy, avisar } = useApp()
  const navegar = useNavigate()
  const [vista, setVista] = useState('credirecto')
  const hab = ficha.habilitado
  const gracia = ticketEnGracia(ficha)
  const rachaOn = hab && ficha.racha?.pagos > 0
  const decorativo = () => avisar('Esta función de PagoDirecto no forma parte de la demo de Credirecto.')

  const punto = (k) => ({ width: vista === k ? 22 : 8, background: vista === k ? '#FF1F5A' : '#C9CBD6' })
  const tocarCredirecto = () => {
    if (vista !== 'credirecto') return setVista('credirecto')
    if (hab) navegar('/app/detalle')
  }

  return (
    <Pantalla nav padding="22px 0 0">
      {/* Encabezado del home */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Avatar />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ficha.alias}</div>
            <div className="cd-mut" style={{ fontSize: 14 }}>{ficha.club || 'Nivel Turista'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <BotonCircular
            tamano={48}
            aria-label={rachaOn ? 'Racha de pagos encendida' : 'Racha de pagos'}
            onClick={() => (hab ? navegar('/app/racha') : avisar('Activa tu Credirecto para empezar tu racha de pagos.'))}
            style={rachaOn
              ? { boxShadow: 'inset 0 0 0 4px #FFD3DF, 0 4px 16px rgba(255,31,90,.22)', color: '#FF1F5A' }
              : { boxShadow: 'inset 0 0 0 4px #E6E7EE, 0 4px 16px rgba(21,21,43,.07)', color: '#E0124F' }}
          >
            <IcoLlama encendida={rachaOn} />
          </BotonCircular>
          <BotonCircular tamano={48} aria-label="Notificaciones" onClick={() => navegar('/app/notificaciones')}><IcoCampana /></BotonCircular>
          <BotonSoporte tamano={48} />
        </div>
      </div>

      {/* Carrusel */}
      <div style={{ marginTop: 20, overflow: 'hidden', padding: '6px 0 14px' }}>
        <div style={{ display: 'flex', gap: 12, paddingLeft: 16, transition: 'transform .35s ease', transform: `translateX(${POS[vista]}px)` }}>
          <button onClick={() => setVista('wallet')} aria-label="Afilia tu cuenta bancaria" style={{ width: 88, height: 290, flex: 'none', background: '#fff', borderRadius: 28, border: 0, boxShadow: '0 0 0 2px #F7D5E0, 0 8px 22px rgba(255,31,90,.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 8 }}>
            <span style={{ width: 42, height: 42, borderRadius: '50%', background: '#FF1F5A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>+</span>
            <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, color: '#15152B', textAlign: 'center' }}>Afilia tu cuenta bancaria</span>
          </button>

          <button className="cd-fr" onClick={() => setVista('wallet')} aria-label="Wallet PagoDirecto">
            <div style={{ height: '100%', borderRadius: 26, color: '#fff', padding: '22px 16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'radial-gradient(70% 60% at 100% 0%, rgba(40,40,130,.85) 0%, rgba(40,40,130,0) 70%), radial-gradient(60% 50% at 20% 100%, rgba(40,40,130,.7) 0%, rgba(40,40,130,0) 70%), linear-gradient(135deg,#FF1F5A 0%,#B3165E 55%,#4A1452 100%)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <MarcaPagoDirecto alto={46} color="#fff" />
                <div><div style={{ fontSize: 16, opacity: 0.92 }}>Saldo disponible</div><div style={{ fontSize: 28, fontWeight: 700 }}>{bs(ficha.saldo_wallet)}</div></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 2px' }}>
                <div className="cd-wa"><span><IcoEnviar /></span>Enviar Wallet</div>
                <div className="cd-wa"><span><IcoDepositar /></span>Depositar</div>
                <div className="cd-wa"><span><IcoMas /></span>Más</div>
              </div>
            </div>
          </button>

          {/* La tarjeta Credirecto es un div con rol de botón porque contiene botones (Verificar) */}
          <div className="cd-fr" role="button" tabIndex={0} aria-label="Credirecto" onClick={tocarCredirecto}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && tocarCredirecto()}>
            {hab ? <CredirectoHabilitado ficha={ficha} gracia={gracia} /> : <CredirectoPorActivar ficha={ficha} avisar={avisar} />}
          </div>

          <button className="cd-fr" onClick={() => setVista('banco')} aria-label="Datos bancarios">
            <div style={{ height: '100%', borderRadius: 26, color: '#fff', padding: '22px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'radial-gradient(circle at 80% 30%, rgba(255,255,255,.08) 0 18px, transparent 19px), radial-gradient(circle at 30% 70%, rgba(255,255,255,.07) 0 26px, transparent 27px), linear-gradient(150deg,#0E5D86 0%,#0B3F63 100%)' }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>Tu banco</div>
              <div><div style={{ fontSize: 22, fontWeight: 700 }}>Datos</div><div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '.04em', marginTop: 6 }}>V *****749</div><div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '.04em' }}>*******5479</div></div>
            </div>
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }} role="group" aria-label="Tarjetas">
        <button className="cd-dot" onClick={() => setVista('wallet')} aria-label="Ver wallet" style={punto('wallet')} />
        <button className="cd-dot" onClick={() => setVista('credirecto')} aria-label="Ver Credirecto" style={punto('credirecto')} />
        <button className="cd-dot" onClick={() => setVista('banco')} aria-label="Ver datos bancarios" style={punto('banco')} />
      </div>

      {/* Aviso de cuota en período de gracia → 08 */}
      {gracia && (
        <div style={{ padding: '22px 20px 0' }}>
          <Tarjeta role="button" tabIndex={0} onClick={() => navegar(`/app/gracia/${gracia.id}`)}
            style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ width: 48, height: 48, borderRadius: 16, background: '#FFF4E0', color: '#B86500', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><IcoReloj w={24} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 16 }}>
                Tu cuota venció {diasEntre(gracia.vence, hoy) === 1 ? 'ayer' : `el ${fechaCorta(gracia.vence)}`}
              </span>
              <span className="cd-mut" style={{ fontSize: 14, lineHeight: 1.3 }}>
                Págala hasta el {fechaCorta(gracia.gracia_hasta)} sin comisión.
              </span>
            </span>
            <span style={{ height: 36, padding: '0 14px', borderRadius: 999, background: '#FF1F5A', color: '#fff', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center' }}>Ver</span>
          </Tarjeta>
        </div>
      )}

      {/* Club PagoDirecto: los puntos de Credirecto se suman a este mismo Club (no hay puntos aparte) */}
      <div style={{ padding: '22px 20px 0' }}>
        <h2 className="cd-h2">Club PagoDirecto</h2>
        {hab && (
          <Tarjeta role="button" tabIndex={0} onClick={() => navegar('/app/racha')}
            style={{ marginTop: 14, padding: 18, display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer' }}>
            <span style={{ width: 60, height: 60, borderRadius: 18, background: fondoCD('120% 90% at 90% 120%', 0.5, 30, 70), display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><LogoCD /></span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ fontWeight: 700, fontSize: 17 }}>Paga tu cuota a tiempo</span><span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>+{ficha.club_puntos?.puntos_por_pago ?? 100} pts</span></div>
              <span className="cd-mut" style={{ display: 'block', fontSize: 14, lineHeight: 1.3, marginTop: 4 }}>
                Suma a tu racha y a tu ruta del Club. ×1,5 si pagas antes.
                {ficha.club_puntos?.puntos_credirecto > 0 && ` Llevas ${ficha.club_puntos.puntos_credirecto.toLocaleString('es-VE')} pts con Credirecto.`}
              </span>
            </div>
          </Tarjeta>
        )}
        <Tarjeta style={{ marginTop: 14, padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ width: 60, height: 60, borderRadius: 18, background: '#F3F4F8', color: '#FF1F5A', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><IcoClub /></span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: 700, fontSize: 17 }}>Llave de acceso</span><span style={{ fontWeight: 700 }}>+250 pts</span></div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <span className="cd-mut" style={{ fontSize: 14, lineHeight: 1.3 }}>Activa, protege tu cuenta y gana puntos del Club.</span>
              <button onClick={decorativo} style={{ height: 40, padding: '0 16px', font: "700 15px 'Outfit',sans-serif", border: 0, borderRadius: 999, background: '#FF1F5A', color: '#fff' }}>Completar</button>
            </div>
          </div>
        </Tarjeta>
      </div>

      {/* Mis pagos (decorativo) */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2 className="cd-h2">Mis pagos</h2>
          <a href="#" onClick={(e) => { e.preventDefault(); decorativo() }} style={{ color: '#E0124F', fontWeight: 600, textDecoration: 'none' }}>Ver todos</a>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 14 }}>
          <Tarjeta style={{ width: 150, padding: '16px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1A9BDB', fontStyle: 'italic' }}>movistar</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 6 }}>04149205479</div>
            <div className="cd-mut" style={{ fontSize: 12 }}>Guardado en directorio</div>
            <span style={{ display: 'inline-block', marginTop: 8, fontSize: 13, fontWeight: 600, padding: '6px 12px', borderRadius: 999, background: '#EEF0F5' }}>Directorio</span>
          </Tarjeta>
          <Tarjeta style={{ width: 150, padding: '16px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8, textAlign: 'center' }}>
            <span style={{ fontSize: 30 }}>+</span><span style={{ fontWeight: 600, fontSize: 15 }}>Registra tu servicio</span>
          </Tarjeta>
        </div>
      </div>

      {/* Funciones: abren el pago con ticket del servicio */}
      <div style={{ padding: '24px 20px 0' }}>
        <h2 className="cd-h2">Funciones</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 14, textAlign: 'center', fontSize: 12, fontWeight: 500 }}>
          {[
            { s: 'estacionamiento', t: 'Estacionamiento', borde: '#FF1F5A', c: '#E0124F' },
            { s: 'luz', t: 'Servicios', borde: '#F39B3A', c: '#C46A0A', icono: 'servicios' },
            { s: 'parquimetro', t: 'Parquímetros', borde: '#5B7BF0', c: '#3A58C9' },
            { s: 'seguro', t: 'Seguros', borde: '#8A5BE0', c: '#6A3CC4' },
          ].map((f) => (
            <button key={f.t} onClick={() => navegar(`/app/pago?servicio=${f.s}`)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 0, padding: 0, font: "500 12px 'Outfit',sans-serif", color: '#15152B' }}>
              <span style={{ width: 66, height: 66, borderRadius: 20, border: `2px solid ${f.borde}`, color: f.c, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IcoServicio servicio={f.icono || f.s} w={28} />
              </span>
              {f.t}
            </button>
          ))}
        </div>
      </div>
    </Pantalla>
  )
}

/** Tarjeta Credirecto del home 02: nivel, tickets disponibles y próxima cuota */
function CredirectoHabilitado({ ficha, gracia }) {
  const { total, disponibles } = ficha.tickets
  const serv = cupoServicios(ficha)
  const proximo = proximoTicket(ficha)
  const chico = total >= 4
  return (
    <div style={{ height: '100%', borderRadius: 26, color: '#fff', background: fondoCD(), padding: '18px 18px 16px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <LogoCredirecto alto={22} />
        <span style={{ fontSize: 12, fontWeight: 700, background: '#C6F432', color: '#121412', padding: '5px 11px', borderRadius: 999 }}>{ficha.nivel_nombre}</span>
      </div>
      {serv.total > 0 ? (
        // Dos cupos: cada uno con su ícono para que se lea "3 tickets + 1 servicio"
        <>
          <div style={{ marginTop: 'auto', fontSize: 15, color: '#E4E6DE' }}>Disponibles</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
            <Cupo icono={<IcoTicket w={26} h={22} color="#C6F432" />} libres={disponibles} total={total} nombre={total === 1 ? 'ticket' : 'tickets'} />
            <Cupo icono={<span style={{ color: '#C6F432', display: 'flex' }}><IcoServicio servicio="factura" w={22} /></span>}
              libres={serv.disponibles} total={serv.total} nombre={serv.total === 1 ? 'servicio' : 'servicios'} />
          </div>
        </>
      ) : (
        <>
          <div style={{ marginTop: 'auto', fontSize: 15, color: '#E4E6DE' }}>Tickets disponibles</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{disponibles}</span>
            <span style={{ fontSize: 16, color: '#C9CCC4', marginRight: 4, whiteSpace: 'nowrap' }}>de {total}</span>
            <span role="img" aria-label={`${disponibles} tickets disponibles, ${total - disponibles} usados`} style={{ display: 'flex', gap: chico ? 4 : 6 }}>
              {Array.from({ length: total }, (_, i) => (
                <IcoTicket key={i} w={chico ? 27 : 34} h={chico ? 23 : 29} color={i < disponibles ? '#C6F432' : 'rgba(255,255,255,.28)'} />
              ))}
            </span>
          </div>
        </>
      )}
      <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, background: gracia ? 'rgba(245,166,35,.25)' : 'rgba(18,20,18,.6)', color: gracia ? '#FFD38A' : '#fff', padding: '5px 11px', borderRadius: 999, whiteSpace: 'nowrap' }}>
          {gracia ? `Sin comisión hasta ${fechaCorta(gracia.gracia_hasta)}` : proximo ? `Cuota ${fechaCorta(proximo.vence)}` : 'Sin cuotas pendientes'}
        </span>
      </div>
    </div>
  )
}

/** Contador de un cupo: ícono + "2 de 3" + nombre (tickets o servicios) */
function Cupo({ icono, libres, total, nombre }) {
  return (
    <div role="img" aria-label={`${libres} de ${total} ${nombre} disponibles`}
      style={{ background: 'rgba(255,255,255,.08)', borderRadius: 16, padding: '8px 10px' }}>
      {icono}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>{libres}</span>
        <span style={{ fontSize: 14, color: '#C9CCC4' }}>de {total}</span>
      </div>
      <div style={{ fontSize: 13, color: '#E4E6DE' }}>{nombre}</div>
    </div>
  )
}

/** Tarjeta Credirecto del home 01: checklist para activarlo */
function CredirectoPorActivar({ ficha, avisar }) {
  const lista = ficha.checklist || []
  const listos = lista.filter((c) => c.ok).length
  const compacto = lista.length > 3
  const verificar = (e, c) => { e.stopPropagation(); avisar(`${c.nombre}: te llevaríamos al flujo de verificación de PagoDirecto.`) }
  return (
    <div style={{ height: '100%', borderRadius: 26, color: '#fff', background: fondoCD(), padding: compacto ? '14px 14px 12px' : '16px 16px 14px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <LogoCredirecto alto={20} />
        <span style={{ fontSize: 12, fontWeight: 600, background: 'rgba(198,244,50,.16)', color: '#D7F86E', padding: '4px 10px', borderRadius: 999 }}>{listos} de {lista.length} listos</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: compacto ? 8 : 12 }}>Activa tu Credirecto</div>
      <div style={{ height: 7, borderRadius: 999, background: 'rgba(255,255,255,.14)', marginTop: 8, overflow: 'hidden' }}>
        <div style={{ width: `${lista.length ? (listos / lista.length) * 100 : 0}%`, height: '100%', borderRadius: 999, background: '#C6F432' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: compacto ? 5 : 6, marginTop: compacto ? 10 : 12, fontSize: 13, fontWeight: 500 }}>
        {lista.map((c) => <ItemChecklist key={c.requisito} c={c} compacto={compacto} onVerificar={(e) => verificar(e, c)} />)}
      </div>
    </div>
  )
}

/** "1 de 2" → 0.5 */
const fraccion = (detalle) => {
  const m = /(\d+)\s*de\s*(\d+)/.exec(detalle || '')
  return m ? Math.min(1, Number(m[1]) / Number(m[2])) : null
}

function ItemChecklist({ c, compacto, onVerificar }) {
  const py = compacto ? 6 : 8
  const caja = { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.07)', borderRadius: 14 }
  if (c.ok) {
    return (
      <div style={{ ...caja, padding: `${py}px 10px` }}>
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#C6F432', color: '#121412', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><IcoCheck /></span>
        {c.nombre}
      </div>
    )
  }
  const f = fraccion(c.detalle)
  if (f !== null) {
    const p = Math.round(f * 100)
    return (
      <div style={{ ...caja, padding: `${py}px 10px` }}>
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: `conic-gradient(#C6F432 0 ${p}%, rgba(255,255,255,.2) ${p}% 100%)`, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#1E211E' }} />
        </span>
        <span>{c.nombre} <span style={{ color: '#D7F86E' }}>({c.detalle})</span></span>
      </div>
    )
  }
  return (
    <div style={{ ...caja, padding: compacto ? '4px 6px 4px 10px' : '5px 6px 5px 10px' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,.45)', flex: 'none' }} />
      <span style={{ flex: 1 }}>{c.nombre}</span>
      <button onClick={onVerificar} style={{ height: 26, border: 0, borderRadius: 999, background: '#FF1F5A', color: '#fff', font: "700 12px 'Outfit',sans-serif", padding: '0 10px' }}>Verificar</button>
    </div>
  )
}
