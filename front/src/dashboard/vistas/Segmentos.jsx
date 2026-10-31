// Vista 03 · Segmentos y niveles (GET /segmentos).
import { entero, fechaCorta, usd } from '../../formato.js'
import { Barra, Encabezado, ErrorCaja, Esqueleto, FilaBarra } from '../componentes.jsx'
import { useDatos } from '../datos.jsx'
import { cupo } from '../util.js'

// Colores de las barras por segmento (diseño 03)
const COLOR_SEGMENTO = {
  'Conductor diario': '#4D7C0F', Puntual: '#7FA05A', Nuevo: '#A9C08A',
  'En enfriamiento': '#9AA0B4', 'En riesgo': '#B42318', 'Sin crédito': '#C9CBD6',
}

/** "25 – 31 oct" o "28 oct – 3 nov" */
const rangoSemana = (desde, hasta) => {
  const [d1, m1] = fechaCorta(desde).split(' ')
  const [d2, m2] = fechaCorta(hasta).split(' ')
  return m1 === m2 ? `${d1} – ${d2} ${m2}` : `${d1} ${m1} – ${d2} ${m2}`
}

/** Umbrales a partir del texto de rango de cada nivel ("40 – 59" → 40). */
const umbrales = (niveles) => niveles.slice(1).map((n) => (n.rango.match(/\d+/) || [])[0]).filter(Boolean)

function Niveles({ d }) {
  const u = umbrales(d.niveles)
  return (
    <section className="rt-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 className="rt-h2">Usuarios por nivel</h2>
        <span className="rt-lbl">{entero(d.habilitados)} habilitados{u.length ? ` · umbrales ${u.join(' / ')}` : ''} · 1 ticket = 1 pago a crédito</span>
      </div>
      <div className="rt-lv" style={{ marginTop: 16 }}>
        {d.niveles.map((l) => (
          <div key={l.nivel} style={{ borderRadius: 10, padding: 16, background: '#F3F4F8' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{l.nombre}</span><span style={{ fontSize: 12, opacity: 0.8, whiteSpace: 'nowrap' }}>{l.rango}</span>
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, marginTop: 8 }}>{entero(l.usuarios)}</div>
            <Barra pct={d.habilitados ? (l.usuarios / d.habilitados) * 100 : 0} fondo="#E2E4EA" style={{ marginTop: 8 }} />
            <div style={{ fontSize: 13, marginTop: 10, opacity: 0.85 }}>{cupo(l.tickets, l.servicios_cupo ?? 0)} · hasta {usd(l.monto_max, Number.isInteger(l.monto_max) ? 0 : 2)} c/u</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{l.servicios_texto}</div>
            {l.ruta_club && <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600 }}>Club: desde {l.ruta_club}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}

function PorSegmento({ d }) {
  const max = Math.max(1, ...d.segmentos.map((s) => s.usuarios))
  return (
    <section className="rt-card">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><h2 className="rt-h2">Usuarios por segmento</h2><span className="rt-lbl">{entero(d.total)} usuarios</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
        {d.segmentos.map((s) => (
          <FilaBarra key={s.segmento} tam={16} alto={12} fondo="#EEF0F5" pct={(s.usuarios / max) * 100}
            color={COLOR_SEGMENTO[s.segmento] || '#9AA0B4'} valor={entero(s.usuarios)}
            etiqueta={<span><b>{s.segmento}</b> <span className="rt-lbl">· {s.descripcion}</span></span>} />
        ))}
      </div>
    </section>
  )
}

function Movimientos({ s, margen }) {
  const up = '#3F6212', dn = '#B42318'
  return (
    <section style={{ borderRadius: 12, padding: '22px 24px', color: '#15152B', background: '#FFFFFF', border: '1px solid #E3E5EA' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><h2 className="rt-h2">Movimientos de la semana</h2><span style={{ fontSize: 13, color: '#6B6B80' }}>{rangoSemana(s.desde, s.hasta)}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 16 }}>
        <div style={{ background: '#EEF4E4', borderRadius: 10, padding: 16 }}><div style={{ color: up, fontSize: 14 }}>▲ Subieron</div><div style={{ fontSize: 40, fontWeight: 700 }}>{entero(s.subieron)}</div></div>
        <div style={{ background: '#FDECEC', borderRadius: 10, padding: 16 }}><div style={{ color: dn, fontSize: 14 }}>▼ Bajaron</div><div style={{ fontSize: 40, fontWeight: 700 }}>{entero(s.bajaron)}</div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, fontSize: 15 }}>
        {s.movimientos.length === 0 && <div className="rt-lbl">Nadie cambió de nivel esta semana.</div>}
        {s.movimientos.map((m) => {
          const c = m.sube ? up : dn
          return (
            <div key={`${m.de}-${m.a}`} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E8EAEE', paddingBottom: 8 }}>
              <span>{m.de} <span style={{ color: c }}>{m.sube ? '→' : '←'}</span> {m.a}</span><b style={{ color: c }}>{entero(m.usuarios)}</b>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 13, color: '#6B6B80', marginTop: 12 }}>Para bajar de nivel el score debe caer {margen} puntos bajo el umbral, así nadie rebota por un mal día.</div>
    </section>
  )
}

export default function Segmentos() {
  const { datos: d, error, recargar } = useDatos((f) => f.segmentos())
  return (
    <>
      <Encabezado titulo="Segmentos y niveles" subtitulo="El nivel define cupo y servicios; el segmento define qué le comunicamos." />
      {error && <ErrorCaja error={error} onReintentar={recargar} />}
      {!d && !error && (
        <>
          <div className="rt-card"><Esqueleto alto={20} ancho="30%" /><div className="rt-lv" style={{ marginTop: 16 }}>{[0, 1, 2, 3].map((i) => <Esqueleto key={i} alto={150} />)}</div></div>
          <div className="rt-two"><div className="rt-card"><Esqueleto alto={320} /></div><div className="rt-card"><Esqueleto alto={320} /></div></div>
        </>
      )}
      {d && (
        <>
          <Niveles d={d} />
          <div className="rt-two">
            <PorSegmento d={d} />
            <Movimientos s={d.semana} margen={d.margen_bajada} />
          </div>
        </>
      )}
    </>
  )
}
