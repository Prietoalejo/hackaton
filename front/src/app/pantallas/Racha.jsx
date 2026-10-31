// Piezas del Club PagoDirecto: la racha de la semana y los beneficios de la ruta. La antigua pantalla 07
// (racha) redirige al Club: un solo programa, una sola moneda (puntos) y la racha como acelerador.
import { Navigate } from 'react-router-dom'
import { aFecha, bs, fechaCorta } from '../../formato.js'
import { sumarDias } from '../util.js'
import { Tarjeta } from '../componentes/Base.jsx'
import { IcoCheck, IcoLlama } from '../componentes/Iconos.jsx'

const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const num = (n) => Number(n).toLocaleString('es-VE', { maximumFractionDigits: 2 })

// Razones del motor dichas al usuario (el dashboard las muestra en tercera persona)
const SUBE = { puntualidad: 'pagas a tiempo', anticipados: 'pagas antes del vencimiento', score: 'tienes un buen historial' }
const BAJA = { puntualidad: 'algunos pagos llegaron tarde', score: 'tu historial aún es corto o tiene atrasos', riesgo: 'tuviste un atraso reciente' }
const lista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0])
const porque = (b) => {
  if (b.pausa) return 'Tus beneficios vuelven en cuanto saldes tu cuota.'
  const sube = b.razones.filter((r) => r.efecto > 0 && SUBE[r.senal]).map((r) => SUBE[r.senal])
  const baja = b.razones.filter((r) => r.efecto < 0 && BAJA[r.senal]).map((r) => BAJA[r.senal])
  if (!sube.length && !baja.length) return 'Recibes el beneficio base de tu ruta. Paga a tiempo o antes y sube.'
  return [sube.length && `Sube porque ${lista(sube)}.`, baja.length && `Baja porque ${lista(baja)}; paga a tiempo y lo recuperas.`]
    .filter(Boolean).join(' ')
}

/** Beneficios de la ruta del Club, personalizados por el motor (base × factor + uno a tu medida) */
export function BeneficiosRuta({ b }) {
  const pct = Math.round(b.factor * 100)
  const recibido = b.beneficios.find((x) => x.tipo === 'walletback')?.recibido_mes ?? 0
  const gratis = b.beneficios.find((x) => x.tipo === 'tickets_gratis')
  const tono = b.pausa ? '#D6104D' : pct > 100 ? '#3B6B00' : pct < 100 ? '#8A4B00' : '#5D5D70'
  const fondo = b.pausa ? '#FFE3EA' : pct > 100 ? '#F1FBD2' : pct < 100 ? '#FFF1D6' : '#EEF0F5'
  return (
    <div style={{ padding: '12px 16px 0' }}>
      <Tarjeta style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Tus beneficios</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: tono, background: fondo, padding: '4px 10px', borderRadius: 999 }}>
            {b.pausa ? 'En pausa' : `${pct} % de tu ruta`}
          </span>
        </div>
        <div className="cd-mut" style={{ fontSize: 13, marginTop: 2 }}>{b.ruta}</div>
        {b.beneficios.map((x) => (
          <div key={x.tipo} className="cd-row" style={{ marginTop: 10, fontSize: 15, alignItems: 'baseline' }}>
            <span>{x.nombre}</span>
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              {x.personal !== x.base && <span className="cd-mut" style={{ fontSize: 12, textDecoration: 'line-through', marginRight: 6 }}>{num(x.base)}{x.unidad && ` ${x.unidad}`}</span>}
              <b>{num(x.personal)}{x.unidad && ` ${x.unidad}`}</b>
            </span>
          </div>
        ))}
        <div className="cd-mut" style={{ fontSize: 12, marginTop: 4 }}>
          {[
            recibido > 0 && `Walletback recibido este mes: ${bs(recibido)}`,
            gratis && !b.pausa && (gratis.disponibles > 0 ? `Te ${gratis.disponibles === 1 ? 'queda 1 ticket gratis' : `quedan ${gratis.disponibles} tickets gratis`} este mes` : gratis.personal > 0 && 'Ya usaste tus tickets gratis de este mes'),
          ].filter(Boolean).join(' · ')}
        </div>
        {b.a_tu_medida && (
          <div style={{ marginTop: 12, background: '#FFE8EF', borderRadius: 14, padding: '10px 12px' }}>
            <div style={{ fontWeight: 700, color: '#A3165E', fontSize: 15 }}>{b.a_tu_medida.nombre}</div>
            <div style={{ fontSize: 13, color: '#6B2A4A', marginTop: 2 }}>
              {b.a_tu_medida.disponible === false ? 'Ya lo usaste este mes; vuelve el mes que viene.' : b.a_tu_medida.detalle}
            </div>
          </div>
        )}
        <div className="cd-mut" style={{ fontSize: 12, marginTop: 10, lineHeight: 1.4 }}>{porque(b)}</div>
      </Tarjeta>
    </div>
  )
}

/** Racha de la semana (la del Club): días con pago a tiempo; 3 días distintos activan el ×1,5 en puntos */
export function RachaSemana({ ficha, hoy }) {
  const r = ficha.racha || { pagos: 0, meta: 3, multiplicador: false }
  // Semana actual (lunes a domingo): días con pago marcados, días pasados sin pago tachados
  const base = hoy || new Date().toISOString().slice(0, 10)
  const lunes = sumarDias(base, -((aFecha(base).getDay() + 6) % 7))
  const pagos = new Set((ficha.linea_de_tiempo || []).filter((m) => m.tipo === 'Pago').map((m) => m.fecha))
  const semana = LETRAS.map((l, i) => {
    const iso = sumarDias(lunes, i)
    return { l, iso, pago: pagos.has(iso), pasado: iso < base, esHoy: iso === base }
  })
  return (
    <div style={{ borderRadius: 26, padding: '18px 18px 16px', color: '#fff', background: 'linear-gradient(135deg,#0E0F2A 0%,#3A1440 45%,#A3165E 80%,#FF1F5A 100%)', boxShadow: '0 10px 26px rgba(58,20,64,.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 18 }}>
          <IcoLlama encendida={r.pagos > 0} color="#fff" w={22} />Racha de la semana
        </span>
        <span style={{ fontWeight: 700 }}>{r.pagos} / {r.meta} días</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        {semana.map((d) => {
          if (d.pago) return <span key={d.iso} className="cd-dy" style={{ background: '#FF1F5A' }} title={fechaCorta(d.iso)}><IcoCheck w={16} sw={3} color="#fff" /></span>
          if (d.esHoy) return <span key={d.iso} className="cd-dy" style={{ background: '#fff', color: '#15152B' }} title="Hoy">{d.l}</span>
          if (d.pasado) return <span key={d.iso} className="cd-dy" style={{ background: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.6)', textDecoration: 'line-through' }}>{d.l}</span>
          return <span key={d.iso} className="cd-dy" style={{ background: 'rgba(255,255,255,.14)', color: 'rgba(255,255,255,.75)' }}>{d.l}</span>
        })}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 14, lineHeight: 1.35 }}>
        {r.multiplicador
          ? '¡Racha completa! Tus pagos de esta semana suman ×1,5 en puntos.'
          : `Paga a tiempo ${r.meta} días distintos y tus pagos suman ×1,5 en puntos.`}
      </div>
    </div>
  )
}

/** La racha ya no tiene pantalla propia: vive dentro del Club */
export default function Racha() {
  return <Navigate to="/app/club" replace />
}
