// Pantalla 08 · Período de gracia: la cuota venció y quedan días sin comisión.
// "Pagar ahora" paga la deuda completa; "Pagar una parte" permite un monto menor.
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { bs, fechaCorta, tasaBs } from '../../formato.js'
import { useApp } from '../contexto.js'
import { datos, mensajeError } from '../datos.js'
import { bsAUsd, descripcionTicket, diasEntre, horaAhora, nombreCuota, parseBs, sumarDias } from '../util.js'
import { BotonPildora, Encabezado, MensajeError, Pantalla, Tarjeta } from '../componentes/Base.jsx'
import { IcoCheck, IcoInfo, IcoReloj } from '../componentes/Iconos.jsx'

export default function Gracia() {
  const { ficha, hoy, recargarFicha } = useApp()
  const navegar = useNavigate()
  const { ticketId } = useParams()
  const [parte, setParte] = useState(false)
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  const t = ficha.tickets_abiertos.find((x) => x.id === Number(ticketId))
  if (!t) return <Navigate to="/app" replace />

  const nombre = nombreCuota(ficha, t.id)
  const base = hoy || t.vence
  const hace = Math.max(1, diasEntre(t.vence, base))
  const quedan = Math.max(0, diasEntre(base, t.gracia_hasta) + 1)
  const enGracia = t.estado === 'gracia'
  const dias = [0, 1, 2].map((i) => sumarDias(t.vence, i))

  const pagar = async (montoUsd) => {
    if (!(montoUsd > 0)) { setError('Ingresa un monto mayor a cero.'); return }
    if (montoUsd > t.deuda + 1e-6) { setError(`El monto no puede ser mayor que tu cuota (${bs(t.deuda)}).`); return }
    setCargando(true); setError(null)
    try {
      const r = await datos.pagar({ user_id: ficha.user_id, ticket_id: t.id, monto: montoUsd, origen: 'usuario' })
      // Primero navegamos (la cuota desaparece de la ficha al refrescarla)
      navegar('/app/comprobante', { state: { ...r, nombre, nivel: ficha.nivel_nombre, hora: horaAhora() } })
      recargarFicha()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }

  const montoParte = parseBs(texto)
  const pie = parte ? (
    <>
      <div style={{ background: '#fff', borderRadius: 22, padding: '12px 14px', boxShadow: '0 8px 28px rgba(21,21,43,.08)' }}>
        <label className="cd-mut" style={{ fontSize: 13 }} htmlFor="cd-parte">¿Cuánto quieres abonar? (máx. {bs(t.deuda)})</label>
        <input id="cd-parte" className="cd-input" inputMode="decimal" autoFocus placeholder="Ej. 900,00" value={texto}
          onChange={(e) => { setTexto(e.target.value); setError(null) }} style={{ marginTop: 6, fontSize: 18, fontWeight: 600 }} />
      </div>
      <BotonPildora cargando={cargando} onClick={() => pagar(bsAUsd(montoParte))}>
        Abonar{montoParte > 0 ? ` Bs ${montoParte.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
      </BotonPildora>
      <BotonPildora variante="secundario" onClick={() => { setParte(false); setError(null) }}>Cancelar</BotonPildora>
    </>
  ) : (
    <>
      <BotonPildora cargando={cargando} onClick={() => pagar(t.deuda)}>Pagar ahora</BotonPildora>
      <BotonPildora variante="secundario" onClick={() => { setParte(true); setTexto((t.deuda * tasaBs() / 2).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) }}>Pagar una parte</BotonPildora>
    </>
  )

  return (
    <Pantalla pie={pie} reserva={parte ? 270 : 170}>
      <Encabezado titulo="Tu cuota" />

      <div style={{ padding: '22px 16px 0' }}>
        <Tarjeta style={{ padding: '24px 20px' }}>
          <span style={{ width: 56, height: 56, borderRadius: 20, background: '#FFF4E0', color: '#B86500', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IcoReloj /></span>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, marginTop: 16 }}>
            Tu cuota venció {hace === 1 ? 'ayer' : `hace ${hace} días`}.<br />
            {enGracia ? `Tienes ${quedan} ${quedan === 1 ? 'día' : 'días'} sin comisión.` : 'Ya se sumó la comisión.'}
          </div>
          <div className="cd-mut" style={{ fontSize: 15, marginTop: 8, lineHeight: 1.4 }}>
            A cualquiera le pasa. Págala cuando puedas en estos días y todo sigue igual.
          </div>

          <div style={{ background: '#F3F4F8', borderRadius: 22, padding: 16, marginTop: 18 }}>
            <div className="cd-mut" style={{ fontSize: 14 }}>Cuota del {nombre} · {descripcionTicket(t)}</div>
            <div style={{ fontSize: 34, fontWeight: 700 }}>{bs(t.deuda)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 14 }} aria-hidden="true">
              {dias.map((d, i) => <span key={d} style={{ height: 10, borderRadius: 5, background: i === 0 ? '#F5A623' : '#C6F432' }} />)}
            </div>
            <div className="cd-mut" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6, marginTop: 6, fontSize: 12 }}>
              {dias.map((d, i) => (
                <span key={d}>
                  {fechaCorta(d)}{i === 0 ? ' · venció' : d === base ? ' · hoy' : ''}
                </span>
              ))}
            </div>
            {enGracia && (
              <div style={{ fontWeight: 600, marginTop: 10, color: '#2C4F00' }}>
                {quedan === 1 ? 'Queda 1 día de gracia' : `Quedan ${quedan} días de gracia`} · hasta el {fechaCorta(t.gracia_hasta)}, 11:59 p. m.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, fontSize: 14, lineHeight: 1.35 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <IcoCheck w={20} sw={2.2} color="#3B6B00" style={{ flex: 'none' }} />
              <span>Al pagarla, tu ticket vuelve a estar disponible. Tu nivel {ficha.nivel_nombre} y tu racha siguen intactos.</span>
            </div>
            {enGracia && (
              <div style={{ display: 'flex', gap: 10 }}>
                <IcoInfo color="#6B6B80" style={{ flex: 'none' }} />
                <span className="cd-mut">Desde el {fechaCorta(sumarDias(t.gracia_hasta, 1))} se suma una comisión de {bs(t.comision_si_atrasa)}.</span>
              </div>
            )}
          </div>
          <MensajeError style={{ marginTop: 14 }}>{error}</MensajeError>
        </Tarjeta>
      </div>
    </Pantalla>
  )
}
