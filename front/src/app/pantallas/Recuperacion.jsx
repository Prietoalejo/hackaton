// Pantalla 09 · Modo recuperación: deuda pendiente, saldo y recarga sugerida.
// Cada recarga paga primero la deuda; lo que sobra queda en la wallet.
import { useState } from 'react'
import { bs, tasaBs } from '../../formato.js'
import { useApp } from '../contexto.js'
import { datos, mensajeError } from '../datos.js'
import { bsAUsd, numeroTicket, parseBs, ticketsOrdenados } from '../util.js'
import { Avatar, BotonPildora, BotonSoporte, MensajeError, Pantalla, Tarjeta, TarjetaCredirecto } from '../componentes/Base.jsx'
import { IcoRecarga, IcoServicio, LogoCD } from '../componentes/Iconos.jsx'

export default function Recuperacion() {
  const { ficha, recargarFicha, avisar } = useApp()
  const [otro, setOtro] = useState(false)
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  // Tickets con deuda vencida (los que causan el modo recuperación)
  const vencidos = ticketsOrdenados(ficha).filter((t) => t.dias_atraso > 0)
  const cuotas = vencidos.reduce((s, t) => s + (t.cuota - t.pagado), 0)
  const comisiones = vencidos.reduce((s, t) => s + t.comision, 0)
  const deuda = ficha.deuda_total
  // Recarga sugerida en Bs, redondeada hacia arriba al céntimo
  const sugeridaBs = Math.max(0, Math.ceil((deuda - ficha.saldo_wallet) * tasaBs() * 100) / 100)

  const detalleDeuda = vencidos.length === 1
    ? `Cuota del Ticket ${numeroTicket(ficha, vencidos[0].id)} ${bs(cuotas)}`
    : `Cuotas de ${vencidos.length} tickets ${bs(cuotas)}`

  const recargar = async (montoBs) => {
    if (!(montoBs > 0)) { setError('Ingresa un monto mayor a cero.'); return }
    setCargando(true); setError(null)
    try {
      const r = await datos.recargar({ user_id: ficha.user_id, monto: bsAUsd(montoBs) })
      avisar(r.deuda_restante > 0
        ? `Abonaste ${bs(r.aplicado_a_deuda)} a tu deuda. Te quedan ${bs(r.deuda_restante)}.`
        : `¡Listo! Pagaste tu deuda${r.a_wallet > 0 ? ` y ${bs(r.a_wallet)} quedaron en tu wallet` : ''}. Tu Credirecto vuelve.`)
      setOtro(false); setTexto('')
      await recargarFicha()
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }

  return (
    <Pantalla nav padding="22px 0 0">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar tamano={54} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 19 }}>{ficha.alias}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#8A4B00', background: '#FFF1D6', padding: '3px 10px', borderRadius: 999, display: 'inline-block', marginTop: 2 }}>Modo recuperación</div>
          </div>
        </div>
        <BotonSoporte />
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        <Tarjeta style={{ padding: '22px 20px' }}>
          <div className="cd-mut" style={{ fontSize: 15 }}>Deuda pendiente de Credirecto</div>
          <div style={{ fontSize: 38, fontWeight: 700 }}>{bs(deuda)}</div>
          <div className="cd-mut" style={{ fontSize: 13 }}>
            {detalleDeuda}{comisiones > 0 && ` + comisión por desfase ${bs(comisiones)}`}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#F3F4F8', borderRadius: 20, padding: 14, marginTop: 16 }}>
            <span style={{ width: 40, height: 40, borderRadius: 14, background: '#fff', color: '#E0124F', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><IcoRecarga /></span>
            <span style={{ fontSize: 15, lineHeight: 1.35 }}>Cada recarga paga primero tu deuda; lo que sobre queda en tu wallet.</span>
          </div>
        </Tarjeta>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <Tarjeta style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Para seguir tu día</div>
          <div className="cd-row" style={{ marginTop: 12, fontSize: 15 }}><span>Deuda Credirecto</span><span>{bs(deuda)}</span></div>
          <div className="cd-row cd-mut" style={{ marginTop: 8, fontSize: 15 }}><span>Tu saldo actual</span><span>− {bs(ficha.saldo_wallet)}</span></div>
          <div style={{ borderTop: '1px dashed #D5D8E1', marginTop: 14, paddingTop: 14, fontSize: 16, lineHeight: 1.35 }}>
            Recarga al menos <b style={{ fontSize: 19 }}>Bs {sugeridaBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> para saldar tu deuda.
          </div>
          <MensajeError style={{ marginTop: 12 }}>{error}</MensajeError>
          {otro ? (
            <>
              <label style={{ display: 'block', marginTop: 16, fontSize: 14 }} className="cd-mut">¿Cuánto quieres recargar? (Bs)</label>
              <input className="cd-input" inputMode="decimal" autoFocus placeholder="Ej. 2.000,00" value={texto}
                onChange={(e) => setTexto(e.target.value)} style={{ marginTop: 6, fontSize: 18, fontWeight: 600 }} />
              <BotonPildora style={{ width: '100%', marginTop: 12, height: 56 }} cargando={cargando} onClick={() => recargar(parseBs(texto))}>
                Recargar{parseBs(texto) > 0 ? ` Bs ${parseBs(texto).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
              </BotonPildora>
              <BotonPildora variante="secundario" style={{ width: '100%', marginTop: 10, height: 50 }} onClick={() => { setOtro(false); setError(null) }}>Cancelar</BotonPildora>
            </>
          ) : (
            <>
              <BotonPildora style={{ width: '100%', marginTop: 16, height: 56, boxShadow: '0 10px 24px rgba(255,31,90,.28)' }} cargando={cargando}
                disabled={sugeridaBs <= 0} onClick={() => recargar(sugeridaBs)}>
                Recargar Bs {sugeridaBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </BotonPildora>
              <BotonPildora variante="secundario" style={{ width: '100%', marginTop: 10, height: 50 }} onClick={() => setOtro(true)}>Recargar otro monto</BotonPildora>
            </>
          )}
        </Tarjeta>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#EAF0FD', borderRadius: 24, padding: 16 }}>
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#fff', color: '#2F55C8', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><IcoServicio servicio="estacionamiento" w={22} /></span>
          <span style={{ fontSize: 15, lineHeight: 1.35, color: '#1B2F6E' }}><b>Con calma:</b> la salida de estacionamientos y los peajes siguen disponibles.</span>
        </div>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <TarjetaCredirecto forma="110% 100% at 100% 120%" a={0.5} p1={28} p2={64} style={{ padding: 20, display: 'flex', gap: 14, alignItems: 'center' }}>
          <LogoCD w={40} h={26} style={{ flex: 'none' }} />
          <span>
            <span style={{ display: 'block', fontSize: 19, fontWeight: 700 }}>Al pagar, recuperas tu crédito</span>
            <span style={{ fontSize: 14, color: '#D5D8CF' }}>Tus {ficha.tickets.total} {ficha.tickets.total === 1 ? 'ticket vuelve' : 'tickets vuelven'} en minutos.</span>
          </span>
        </TarjetaCredirecto>
      </div>
    </Pantalla>
  )
}
