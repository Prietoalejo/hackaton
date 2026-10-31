// Pantalla 06 · Comprobante de pago (anticipado o normal). Recibe por navegación la respuesta de
// POST /pagos más { nombre, nivel, hora }, o { pagos: [respuesta + nombre], error } cuando se pagan
// varias cuotas a la vez. Si ningún pago es `anticipado` se omite el bloque de racha.
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { bs, entero, fechaNumerica } from '../../formato.js'
import { BotonPildora, Encabezado, MensajeError, Pantalla, TarjetaCredirecto } from '../componentes/Base.jsx'
import { IcoCheck, IcoLlama } from '../componentes/Iconos.jsx'

const fila = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }
const unir = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)

export default function Comprobante() {
  const { state } = useLocation()
  const navegar = useNavigate()
  const pagos = (state?.pagos ?? [state]).filter((p) => p?.comprobante)
  if (!pagos.length) return <Navigate to="/app" replace />

  const cs = pagos.map((p) => p.comprobante)
  const c = cs[0]
  const varios = pagos.length > 1
  const total = cs.reduce((s, x) => s + x.total, 0)
  const ahorro = cs.reduce((s, x) => s + x.ahorro, 0)
  const anticipados = cs.filter((x) => x.anticipado)
  const liberados = pagos.filter((p) => p.comprobante.ticket_disponible).map((p) => p.nombre ?? 'Ticket 1')
  const parcial = !varios && (pagos[0].deuda_restante ?? 0) > 0.0001
  const puntos = cs.reduce((s, x) => s + (x.puntos_club || 0), 0)
  const club = cs[cs.length - 1].club
  // La racha cuenta días: pagar varias cuotas el mismo día suma 1 (o nada si hoy ya contaba)
  const subeRacha = cs[cs.length - 1].racha_despues - cs[0].racha_antes

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

          {anticipados.length > 0 && (
            <TarjetaCredirecto forma="110% 90% at 100% 120%" a={0.5} p1={28} p2={62} style={{ margin: '16px 14px 0', borderRadius: 22, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IcoLlama encendida color="#C6F432" w={20} />
                <span style={{ fontWeight: 700, color: '#D7F86E' }}>
                  {anticipados.length > 1
                    ? `Pagaste ${anticipados.length} cuotas antes de tiempo`
                    : `Pagaste ${anticipados[0].dias_antes} ${anticipados[0].dias_antes === 1 ? 'día' : 'días'} antes`}
                </span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, marginTop: 6, lineHeight: 1.35 }}>
                {subeRacha > 0 ? `+${subeRacha} en tu racha y ` : ''}{puntos ? `+${entero(puntos)} pts (×1,5)` : 'puntos ×1,5'} en tu Club PagoDirecto
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, fontSize: 13, fontWeight: 600 }}>
                <span style={{ background: '#C6F432', color: '#121412', padding: '6px 10px', borderRadius: 999 }}>Racha {cs[0].racha_antes} → {cs[cs.length - 1].racha_despues}</span>
                {club && <span style={{ background: 'rgba(255,255,255,.14)', padding: '6px 10px', borderRadius: 999 }}>{club}</span>}
                {liberados.length > 0 && (
                  <span style={{ background: 'rgba(255,255,255,.14)', padding: '6px 10px', borderRadius: 999 }}>
                    {unir(liberados)} {liberados.length > 1 ? 'disponibles' : 'disponible'} otra vez
                  </span>
                )}
              </div>
            </TarjetaCredirecto>
          )}

          {!anticipados.length && puntos > 0 && (
            <div style={{ margin: '16px 14px 0', borderRadius: 18, padding: '12px 14px', background: '#FFE8EF', color: '#A3165E', fontWeight: 600, fontSize: 15 }}>
              +{entero(puntos)} pts en tu Club PagoDirecto{club ? ` · ${club}` : ''}
            </div>
          )}

          <div style={{ padding: '18px 22px 0' }}>
            <div className="cd-mut" style={{ ...fila, fontSize: 12, letterSpacing: '.04em' }}><span>CONCEPTO</span><span>MONTO</span></div>
            {parcial ? (
              <div style={{ ...fila, marginTop: 10 }}><span>Abono a tu cuota · {pagos[0].nombre ?? 'Ticket 1'}</span><span style={{ fontWeight: 600 }}>{bs(c.total)}</span></div>
            ) : (
              pagos.map((p, i) => (
                <div key={p.comprobante.referencia} style={i > 0 ? { borderTop: '1px solid #F0F1F5', marginTop: 14, paddingTop: 4 } : undefined}>
                  <Conceptos c={p.comprobante} nombre={p.nombre ?? 'Ticket 1'} nivel={state.nivel} />
                </div>
              ))
            )}
            <div style={{ ...fila, alignItems: 'center', borderTop: '1px solid #E6E8EE', marginTop: 16, paddingTop: 14 }}>
              <span className="cd-mut">Total pagado</span><span style={{ fontWeight: 800, fontSize: 19 }}>{bs(total)}</span>
            </div>
            {ahorro > 0 && <div className="cd-mut" style={{ fontSize: 12, marginTop: 6 }}>Ahorraste {bs(ahorro)} en gasto administrativo.</div>}
            {parcial && <div className="cd-mut" style={{ fontSize: 12, marginTop: 6 }}>Te quedan {bs(pagos[0].deuda_restante)} por pagar de esta cuota.</div>}
            <MensajeError style={{ marginTop: 12 }}>{state.error && `No pudimos pagar el resto de las cuotas: ${state.error}`}</MensajeError>
          </div>

          <div style={{ position: 'relative', marginTop: 20, borderTop: '2px dashed #E1E3EA' }} aria-hidden="true">
            <span style={{ position: 'absolute', left: -16, top: -16, width: 30, height: 30, borderRadius: '50%', background: '#F3F4F8' }} />
            <span style={{ position: 'absolute', right: -16, top: -16, width: 30, height: 30, borderRadius: '50%', background: '#F3F4F8' }} />
          </div>
          <div style={{ padding: '18px 16px' }}>
            <div style={{ background: '#EAF0FD', borderRadius: 16, padding: 12, textAlign: 'center' }}>
              <div className="cd-mut" style={{ fontSize: 15 }}>{varios ? 'Referencias' : 'Referencia'}</div>
              {cs.map((x) => (
                <div key={x.referencia} style={{ fontSize: varios ? 19 : 24, fontWeight: 700, letterSpacing: '.02em' }}>{x.referencia}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Pantalla>
  )
}

/** Filas de cuota, gasto administrativo y comisión de un pago completo */
function Conceptos({ c, nombre, nivel }) {
  const gastoNeto = c.gasto_admin - c.descuento
  return (
    <>
      <div style={{ ...fila, marginTop: 10 }}><span>Cobro crédito cuota · {nombre}</span><span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{bs(c.cuota)}</span></div>
      <div style={{ ...fila, marginTop: 14 }}>
        <span>
          <span style={{ display: 'block' }}>Gasto administrativo</span>
          {c.descuento > 0 && (
            <span style={{ display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 700, color: '#2C4F00', background: '#E9F9B4', padding: '4px 10px', borderRadius: 999 }}>
              −{c.descuento_pct}% por ser {nivel}
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
  )
}
