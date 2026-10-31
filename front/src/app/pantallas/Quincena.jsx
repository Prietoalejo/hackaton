// Pantalla 05 · Mueve tu cuota a tu quincena: antes → después, beneficios y el calendario como apoyo.
import { useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { aFecha, bs, fechaCorta, fechaLarga } from '../../formato.js'
import { useApp } from '../contexto.js'
import { datos, mensajeError } from '../datos.js'
import { diasEntre, esDiaDeCobro, mesAnio, numeroTicket, plural } from '../util.js'
import { BotonPildora, Encabezado, MensajeError, Pantalla, Tarjeta, TarjetaCredirecto } from '../componentes/Base.jsx'
import { IcoCheck, IcoTicket } from '../componentes/Iconos.jsx'

const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** "sáb 7 nov" */
const diaYFecha = (iso) => `${DIAS_CORTOS[aFecha(iso).getDay()]} ${fechaCorta(iso)}`

export default function Quincena() {
  const { ficha, recargarFicha, avisar } = useApp()
  const navegar = useNavigate()
  const { ticketId } = useParams()
  const { state } = useLocation()
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  const ticket = ficha.tickets_abiertos.find((t) => t.id === Number(ticketId)) || state?.ticket
  const oferta = ticket?.oferta_quincena

  if (!ticket || !oferta) {
    return (
      <Pantalla>
        <Encabezado titulo="Fecha de pago" volverA="/app/detalle" />
        <div style={{ padding: '20px 16px 0' }}>
          <Tarjeta style={{ padding: 22, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Esta cuota ya está en una buena fecha</div>
            <div className="cd-mut" style={{ marginTop: 6 }}>No hay otra fecha de quincena disponible para este ticket.</div>
          </Tarjeta>
        </div>
      </Pantalla>
    )
  }

  const numero = numeroTicket(ficha, ticket.id)
  const dias = diasEntre(ticket.vence, oferta)

  const mover = async () => {
    setCargando(true); setError(null)
    try {
      await datos.moverAQuincena(ticket.id)
      avisar(`Listo: tu cuota ahora vence el ${fechaLarga(oferta)}. Sin costo.`)
      navegar('/app/detalle')
      recargarFicha()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }

  return (
    <Pantalla pie={
      <>
        <BotonPildora cargando={cargando} onClick={mover}>Sí, mover al {fechaCorta(oferta)}</BotonPildora>
        <BotonPildora variante="secundario" onClick={() => navegar('/app/detalle')}>Dejar el {fechaCorta(ticket.vence)}</BotonPildora>
      </>
    }>
      <Encabezado titulo="Fecha de pago" volverA="/app/detalle" />

      <div style={{ padding: '22px 20px 0' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, lineHeight: 1.15, letterSpacing: '-.01em' }}>Mueve tu cuota a tu quincena</h1>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '7px 14px 7px 10px', borderRadius: 999, background: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 4px 16px rgba(21,21,43,.05)' }}>
          <IcoTicket w={20} h={17} color="#FF1F5A" sw={2} />
          <span>Ticket {numero} · {ticket.comercio} · {bs(ticket.cuota)}</span>
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <TarjetaCredirecto forma="110% 80% at 100% 115%" a={0.5} p1={26} p2={60} style={{ padding: '22px 20px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', justifyContent: 'space-between', alignItems: 'end', gap: 8, whiteSpace: 'nowrap' }}>
            <div>
              <div style={{ fontSize: 13, color: '#A9ADA3' }}>Vence</div>
              <div style={{ fontSize: 19, fontWeight: 600, color: '#A9ADA3', textDecoration: 'line-through', textDecorationThickness: 2, marginTop: 4 }}>{diaYFecha(ticket.vence)}</div>
            </div>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#C6F432" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ marginBottom: 3 }}>
              <path d="M4 12h15M13 6l6 6-6 6" />
            </svg>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: '#D7F86E', fontWeight: 600 }}>Nueva fecha</div>
              <div style={{ fontSize: 26, fontWeight: 700, marginTop: 2 }}>{diaYFecha(oferta)}</div>
            </div>
          </div>
          <div style={{ display: 'inline-block', marginTop: 16, padding: '6px 12px', borderRadius: 999, background: 'rgba(198,244,50,.16)', color: '#D7F86E', fontSize: 14, fontWeight: 600 }}>
            +{plural(dias, 'día', 'días')}{esDiaDeCobro(ficha, oferta) ? ' · el día que sueles recargar' : ''}
          </div>
        </TarjetaCredirecto>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <Tarjeta style={{ padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Beneficio titulo="Sin costo ni intereses" detalle="Mover la fecha es gratis." />
          <Beneficio titulo="La cuota es la misma" detalle={`Sigues pagando ${bs(ticket.cuota)}.`} />
          <Beneficio titulo="Pagas cuando tienes saldo" detalle="Y cuidas tu racha: sin atrasos ni comisiones." />
        </Tarjeta>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <Tarjeta style={{ padding: '16px 16px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{mesAnio(oferta)}</span>
            <span className="cd-mut" style={{ fontSize: 12 }}>Tus recargas</span>
          </div>
          <Calendario ficha={ficha} mesDe={oferta} vence={ticket.vence} nueva={oferta} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 10, fontSize: 12, color: '#6B6B80' }}>
            <Leyenda estilo={{ boxShadow: 'inset 0 0 0 1.5px #E58AA6' }}>Fecha actual</Leyenda>
            <Leyenda estilo={{ background: '#C6F432' }}>Nueva fecha</Leyenda>
            <Leyenda estilo={{ boxShadow: 'inset 0 0 0 1.5px #D5D8E1' }}>Otras recargas</Leyenda>
          </div>
        </Tarjeta>
        <MensajeError style={{ marginTop: 12 }}>{error}</MensajeError>
      </div>
    </Pantalla>
  )
}

function Beneficio({ titulo, detalle }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#F1FBD2', color: '#3B6B00', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <IcoCheck w={13} />
      </span>
      <div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{titulo}</div>
        <div className="cd-mut" style={{ fontSize: 14, marginTop: 1 }}>{detalle}</div>
      </div>
    </div>
  )
}

function Leyenda({ estilo, children }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', ...estilo }} />{children}
    </span>
  )
}

/** Calendario compacto: fecha actual tachada, flecha hasta la nueva fecha y las otras recargas en suave. */
function Calendario({ ficha, mesDe, vence, nueva }) {
  const caja = useRef(null)
  const refVence = useRef(null)
  const refNueva = useRef(null)
  const [flecha, setFlecha] = useState(null)

  const f = aFecha(mesDe)
  const anio = f.getFullYear()
  const mes = f.getMonth()
  const dias = new Date(anio, mes + 1, 0).getDate()
  const offset = (new Date(anio, mes, 1).getDay() + 6) % 7 // lunes primero
  const enEsteMes = (iso) => { const x = aFecha(iso); return x.getFullYear() === anio && x.getMonth() === mes ? x.getDate() : null }
  const diaVence = enEsteMes(vence)
  const diaNueva = enEsteMes(nueva)
  const iso = (d) => `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  // Curva de la fecha actual a la nueva, medida sobre las celdas ya pintadas.
  useLayoutEffect(() => {
    if (!refVence.current || !refNueva.current || !caja.current) { setFlecha(null); return }
    const base = caja.current.getBoundingClientRect()
    const centro = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2 - base.left, r.top + r.height / 2 - base.top] }
    const [x1, y1] = centro(refVence.current)
    const [x2, y2] = centro(refNueva.current)
    const largo = Math.hypot(x2 - x1, y2 - y1) || 1
    const [ux, uy] = [(x2 - x1) / largo, (y2 - y1) / largo]
    // Punto de control desplazado hacia arriba para que la flecha no tape las fechas intermedias.
    const [nx, ny] = uy > 0 || (uy === 0 && ux < 0) ? [uy, -ux] : [-uy, ux]
    const curva = Math.min(26, largo / 2)
    const cx = (x1 + x2) / 2 + nx * curva
    const cy = (y1 + y2) / 2 + ny * curva
    const corta = (x, y, hx, hy, r) => { const l = Math.hypot(hx - x, hy - y) || 1; return [x + ((hx - x) / l) * r, y + ((hy - y) / l) * r] }
    const [ax, ay] = corta(x1, y1, cx, cy, 17)
    const [bx, by] = corta(x2, y2, cx, cy, 19)
    setFlecha(`M${ax},${ay} Q${cx},${cy} ${bx},${by}`)
  }, [mesDe, vence, nueva])

  return (
    <div ref={caja} style={{ position: 'relative', marginTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', rowGap: 2, textAlign: 'center' }}>
        {SEMANA.map((d, i) => <span key={i} className="cd-mut" style={{ fontSize: 11, paddingBottom: 4 }}>{d}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: dias }, (_, i) => {
          const d = i + 1
          let estilo = { color: '#8A8DA0' }
          let ref
          if (d === diaVence) {
            estilo = { boxShadow: 'inset 0 0 0 1.5px #E58AA6', color: '#D6104D', textDecoration: 'line-through', textDecorationThickness: 1.5 }
            ref = refVence
          } else if (d === diaNueva) {
            estilo = { background: '#C6F432', color: '#15152B', fontWeight: 700 }
            ref = refNueva
          } else if (esDiaDeCobro(ficha, iso(d))) {
            estilo = { boxShadow: 'inset 0 0 0 1.5px #D5D8E1', color: '#8A8DA0' }
          }
          return (
            <span key={d} style={{ display: 'flex', justifyContent: 'center' }}>
              <span ref={ref} style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, ...estilo }}>{d}</span>
            </span>
          )
        })}
      </div>
      {flecha && (
        <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
          <defs>
            <marker id="cd-punta" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M1 1l7 4-7 4" fill="none" stroke="#15152B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          <path d={flecha} fill="none" stroke="#15152B" strokeWidth="1.6" strokeDasharray="3 3" strokeLinecap="round" markerEnd="url(#cd-punta)" />
        </svg>
      )}
    </div>
  )
}
