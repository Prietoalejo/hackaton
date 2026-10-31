// Pantalla 05 · Fecha en tu quincena: calendario con el vencimiento, los días de recarga y la oferta.
import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { aFecha, bs, fechaLarga } from '../../formato.js'
import { useApp } from '../contexto.js'
import { datos, mensajeError } from '../datos.js'
import { esDiaDeCobro, mesAnio, numeroTicket } from '../util.js'
import { BotonPildora, Encabezado, MensajeError, Pantalla, Tarjeta, TarjetaCredirecto } from '../componentes/Base.jsx'
import { IcoCalendario } from '../componentes/Iconos.jsx'

const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

/** "15 y 30" / "15" / "5, 15 y 30" */
const listaDias = (q) => (q.length <= 1 ? String(q[0] ?? '') : `${q.slice(0, -1).join(', ')} y ${q[q.length - 1]}`)

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
  const diaOferta = aFecha(oferta).getDate()

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
        <BotonPildora cargando={cargando} onClick={mover}>Mover al {diaOferta}</BotonPildora>
        <BotonPildora variante="secundario" onClick={() => navegar('/app/detalle')}>Mantener fecha</BotonPildora>
      </>
    }>
      <Encabezado titulo="Fecha de pago" volverA="/app/detalle" />

      <div style={{ padding: '20px 16px 0' }}>
        <Tarjeta style={{ padding: '20px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 18 }}>{mesAnio(oferta)}</span>
            <span className="cd-mut" style={{ fontSize: 13 }}>Tus recargas</span>
          </div>
          <Calendario ficha={ficha} mesDe={oferta} vence={ticket.vence} />
          <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 13 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: '50%', boxShadow: 'inset 0 0 0 2px #FF1F5A' }} />Vence tu cuota</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: '#C6F432' }} />Sueles recargar</span>
          </div>
        </Tarjeta>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <TarjetaCredirecto forma="110% 80% at 100% 115%" a={0.5} p1={26} p2={60} style={{ padding: '22px 20px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 40, height: 40, borderRadius: 14, background: 'rgba(198,244,50,.16)', color: '#C6F432', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcoCalendario /></span>
            <span style={{ fontWeight: 600, color: '#D7F86E' }}>Fecha en tu quincena</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.35, marginTop: 14 }}>
            Tu cuota vence el {fechaLarga(ticket.vence)}.
            {ficha.quincena?.length ? ` Vemos que sueles recargar los días ${listaDias(ficha.quincena)}.` : ''} ¿La movemos al {diaOferta}?
          </div>
          <div style={{ fontSize: 14, color: '#D5D8CF', marginTop: 8 }}>Sin costo. La cuota de tu Ticket {numero} ({bs(ticket.cuota)}) queda igual.</div>
        </TarjetaCredirecto>
        <MensajeError style={{ marginTop: 12 }}>{error}</MensajeError>
      </div>
    </Pantalla>
  )
}

function Calendario({ ficha, mesDe, vence }) {
  const f = aFecha(mesDe)
  const anio = f.getFullYear()
  const mes = f.getMonth()
  const dias = new Date(anio, mes + 1, 0).getDate()
  const offset = (new Date(anio, mes, 1).getDay() + 6) % 7 // lunes primero
  const fv = aFecha(vence)
  const venceAqui = fv.getFullYear() === anio && fv.getMonth() === mes ? fv.getDate() : null
  const iso = (d) => `${anio}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, marginTop: 14, textAlign: 'center' }}>
      {SEMANA.map((d, i) => <span key={i} className="cd-mut" style={{ fontSize: 12 }}>{d}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`v${i}`} />)}
      {Array.from({ length: dias }, (_, i) => {
        const d = i + 1
        let estilo
        if (d === venceAqui) estilo = { boxShadow: 'inset 0 0 0 2px #FF1F5A', color: '#D6104D', fontWeight: 700 }
        else if (esDiaDeCobro(ficha, iso(d))) estilo = { background: '#C6F432', fontWeight: 700 }
        return <span key={d} className="cd-d" style={estilo}>{d}</span>
      })}
    </div>
  )
}
