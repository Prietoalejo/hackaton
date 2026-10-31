// Pantalla 06 · Comprobante de pago (anticipado o normal). Recibe por navegación la respuesta de
// POST /pagos más { numero, nivel, hora }. Si `anticipado` es false se omite el bloque de racha.
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { bs, fechaNumerica } from '../../formato.js'
import { BotonPildora, Encabezado, Pantalla, TarjetaCredirecto } from '../componentes/Base.jsx'
import { IcoCheck, IcoLlama } from '../componentes/Iconos.jsx'

export default function Comprobante() {
  const { state } = useLocation()
  const navegar = useNavigate()
  const c = state?.comprobante
  if (!c) return <Navigate to="/app" replace />

  const numero = state.numero ?? 1
  const parcial = (state.deuda_restante ?? 0) > 0.0001
  const gastoNeto = c.gasto_admin - c.descuento
  const fila = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }

  return (
    <Pantalla reserva={130} pie={
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <BotonPildora style={{ width: 210, fontSize: 20 }} onClick={() => navegar('/app')}>Listo</BotonPildora>
      </div>
    }>
      <Encabezado titulo="Pago de cuota" />

      <div style={{ padding: '44px 26px 0', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '50%', top: 14, transform: 'translateX(-50%)', width: 64, height: 64, borderRadius: '50%', background: '#1FA34A', border: '5px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', zIndex: 1, boxShadow: '0 6px 16px rgba(31,163,74,.3)' }}>
          <IcoCheck w={30} sw={3} />
        </span>
        <div style={{ background: '#fff', borderRadius: 28, boxShadow: '0 12px 34px rgba(21,21,43,.08)', padding: '40px 0 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 21, fontWeight: 700 }}>Transacción exitosa</div>
            <div className="cd-mut" style={{ fontSize: 13 }}>{fechaNumerica(c.fecha)}{state.hora ? ` · ${state.hora}` : ''}</div>
          </div>

          {c.anticipado && (
            <TarjetaCredirecto forma="110% 90% at 100% 120%" a={0.5} p1={28} p2={62} style={{ margin: '16px 14px 0', borderRadius: 22, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IcoLlama encendida color="#C6F432" w={20} />
                <span style={{ fontWeight: 700, color: '#D7F86E' }}>Pagaste {c.dias_antes} {c.dias_antes === 1 ? 'día' : 'días'} antes</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, marginTop: 6, lineHeight: 1.35 }}>
                +1 en tu racha y {c.puntos_club ? `+${c.puntos_club} pts (×1,5)` : 'puntos ×1,5'} en tu Club PagoDirecto
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, fontSize: 13, fontWeight: 600 }}>
                <span style={{ background: '#C6F432', color: '#121412', padding: '6px 10px', borderRadius: 999 }}>Racha {c.racha_antes} → {c.racha_despues}</span>
                {c.club && <span style={{ background: 'rgba(255,255,255,.14)', padding: '6px 10px', borderRadius: 999 }}>{c.club}</span>}
                {c.ticket_disponible && <span style={{ background: 'rgba(255,255,255,.14)', padding: '6px 10px', borderRadius: 999 }}>Ticket {numero} disponible otra vez</span>}
              </div>
            </TarjetaCredirecto>
          )}

          {!c.anticipado && c.puntos_club > 0 && (
            <div style={{ margin: '16px 14px 0', borderRadius: 18, padding: '12px 14px', background: '#FFE8EF', color: '#A3165E', fontWeight: 600, fontSize: 15 }}>
              +{c.puntos_club} pts en tu Club PagoDirecto{c.club ? ` · ${c.club}` : ''}
            </div>
          )}

          <div style={{ padding: '18px 22px 0' }}>
            <div className="cd-mut" style={{ ...fila, fontSize: 12, letterSpacing: '.04em' }}><span>CONCEPTO</span><span>MONTO</span></div>
            {parcial ? (
              <div style={{ ...fila, marginTop: 10 }}><span>Abono a tu cuota · Ticket {numero}</span><span style={{ fontWeight: 600 }}>{bs(c.total)}</span></div>
            ) : (
              <>
                <div style={{ ...fila, marginTop: 10 }}><span>Cobro crédito cuota · Ticket {numero}</span><span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{bs(c.cuota)}</span></div>
                <div style={{ ...fila, marginTop: 14 }}>
                  <span>
                    <span style={{ display: 'block' }}>Gasto administrativo</span>
                    {c.descuento > 0 && (
                      <span style={{ display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 700, color: '#2C4F00', background: '#E9F9B4', padding: '4px 10px', borderRadius: 999 }}>
                        −{c.descuento_pct}% por ser {state.nivel}
                      </span>
                    )}
                  </span>
                  <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {c.descuento > 0 && <span className="cd-mut" style={{ display: 'block', fontSize: 13, textDecoration: 'line-through' }}>{bs(c.gasto_admin)}</span>}
                    <span style={{ fontWeight: 600 }}>{bs(gastoNeto)}</span>
                  </span>
                </div>
                {c.comision > 0 && (
                  <div style={{ ...fila, marginTop: 14 }}><span>Comisión por desfase</span><span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{bs(c.comision)}</span></div>
                )}
              </>
            )}
            <div style={{ ...fila, alignItems: 'center', borderTop: '1px solid #E6E8EE', marginTop: 16, paddingTop: 14 }}>
              <span className="cd-mut">Total pagado</span><span style={{ fontWeight: 800, fontSize: 19 }}>{bs(c.total)}</span>
            </div>
            {c.ahorro > 0 && <div className="cd-mut" style={{ fontSize: 12, marginTop: 6 }}>Ahorraste {bs(c.ahorro)} en gasto administrativo.</div>}
            {parcial && <div className="cd-mut" style={{ fontSize: 12, marginTop: 6 }}>Te quedan {bs(state.deuda_restante)} por pagar de esta cuota.</div>}
          </div>

          <div style={{ position: 'relative', marginTop: 20, borderTop: '2px dashed #E1E3EA' }} aria-hidden="true">
            <span style={{ position: 'absolute', left: -16, top: -16, width: 30, height: 30, borderRadius: '50%', background: '#F3F4F8' }} />
            <span style={{ position: 'absolute', right: -16, top: -16, width: 30, height: 30, borderRadius: '50%', background: '#F3F4F8' }} />
          </div>
          <div style={{ padding: '18px 16px' }}>
            <div style={{ background: '#EAF0FD', borderRadius: 16, padding: 12, textAlign: 'center' }}>
              <div className="cd-mut" style={{ fontSize: 15 }}>Referencia</div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '.02em' }}>{c.referencia}</div>
            </div>
          </div>
        </div>
      </div>
    </Pantalla>
  )
}
