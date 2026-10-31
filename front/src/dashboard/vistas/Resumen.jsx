// Vista 01 · Resumen (GET /resumen): KPIs, Credirecto vs. regla actual y gráfico semanal.
import { Link } from 'react-router-dom'
import { bs, entero, fechaCorta, usd } from '../../formato.js'
import { Boton, Encabezado, ErrorCaja, Esqueleto, Kpi, Spinner } from '../componentes.jsx'
import { useDatos } from '../datos.jsx'
import { diferencia, MENOS, numAuto, pctAuto, valorUnidad } from '../util.js'

const anio = (iso) => iso.slice(0, 4)

function Variacion({ delta, mejorSiSube }) {
  if (delta === null || delta === undefined) return null
  const bueno = delta === 0 ? true : (delta > 0) === mejorSiSube
  const flecha = delta > 0 ? '▲' : delta < 0 ? '▼' : '='
  return <span className={bueno ? 'rt-up' : 'rt-dn'}>{flecha} {numAuto(Math.abs(delta))} pp vs. sem. pasada</span>
}

function Kpis({ k }) {
  return (
    <div className="rt-grid">
      <Kpi etiqueta="Usuarios totales" valor={entero(k.usuarios_totales)}><div className="rt-bs">Base de la prueba</div></Kpi>
      <Kpi etiqueta="Habilitados vs. en espera"
        valor={<>{entero(k.habilitados)} <span style={{ fontSize: 18, color: '#6B6B80', fontWeight: 500 }}>/ {entero(k.en_espera)}</span></>}>
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 10, gap: 2 }} aria-hidden="true">
          <span style={{ width: `${k.pct_habilitados || 0}%`, background: '#4D7C0F' }} /><span style={{ flex: 1, background: '#DADCE4' }} />
        </div>
        <div className="rt-bs" style={{ marginTop: 6 }}>{pctAuto(k.pct_habilitados)} habilitados</div>
      </Kpi>
      <Kpi etiqueta="Monto prestado" valor={usd(k.monto_prestado, 0)}><div className="rt-bs">{bs(k.monto_prestado)}</div></Kpi>
      <Kpi etiqueta="Repago a tiempo" valor={pctAuto(k.repago_a_tiempo)}><Variacion delta={k.repago_delta_pp} mejorSiSube /></Kpi>
      <Kpi etiqueta="Mora" valor={pctAuto(k.mora)}><Variacion delta={k.mora_delta_pp} mejorSiSube={false} /></Kpi>
      <Kpi etiqueta="Ingresos cobrados" valor={usd(k.comisiones, 0)}><div className="rt-bs">{bs(k.comisiones)}</div></Kpi>
      <Kpi etiqueta="Reuso" valor={pctAuto(k.reuso)}><div className="rt-bs">Vuelven a usar Credirecto en 30 días</div></Kpi>
      <Kpi etiqueta="Pérdida esperada" valor={usd(k.perdida_esperada, 0)}><div className="rt-bs">{bs(k.perdida_esperada)}</div></Kpi>
    </div>
  )
}

function Celda({ unidad, valor, fuerte, borde }) {
  const st = { ...(fuerte ? { fontWeight: 700 } : null), ...(borde ? null : { border: 0 }) }
  if (unidad !== 'usd') return <div style={st}>{valorUnidad(unidad, valor)}</div>
  return (
    <div style={st}>{usd(valor, 0)}<br /><span style={{ fontSize: 12, color: '#6B6B80', fontWeight: 400 }}>{bs(valor, 0)}</span></div>
  )
}

function Comparativo({ filas, usuarios }) {
  const cab = { color: '#6B6B80', fontSize: 13 }
  return (
    <section className="rt-dk" aria-labelledby="vs">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end' }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, background: '#EEF4E4', color: '#3F6212', padding: '5px 12px', borderRadius: 6 }}>Mismos {entero(usuarios)} usuarios</span>
          <h2 id="vs" style={{ margin: '12px 0 0', fontSize: 30, fontWeight: 700 }}>Credirecto vs. regla actual</h2>
          <div style={{ color: '#6B6B80', fontSize: 15, marginTop: 4 }}>Regla actual: 2 tickets y 7 días para todos. Credirecto: cupo, servicios y plazo según cómo y cuándo paga cada uno.</div>
        </div>
      </div>
      <div style={{ overflowX: 'auto', marginTop: 18 }}>
        <div className="rt-cmp" style={{ minWidth: 560, fontSize: 15 }}>
          <div style={cab}>Métrica</div><div style={cab}>Regla actual</div><div style={cab}>Credirecto</div><div style={cab}>Diferencia</div>
          {filas.map((f, i) => {
            const borde = i < filas.length - 1
            const sinBorde = borde ? undefined : { border: 0 }
            let dif
            // Caso del diseño: menos habilitados no es "peor", es la cola de espera con checklist.
            if (f.unidad === 'n' && /habilitad/i.test(f.metrica) && f.ritmo < f.regla_actual) {
              dif = <div style={{ ...sinBorde, color: '#6B6B80' }}>{MENOS}{entero(f.regla_actual - f.ritmo)} en espera, con checklist</div>
            } else {
              const d = diferencia(f.unidad, f.regla_actual, f.ritmo, f.mejor_si_sube)
              dif = <div style={{ ...sinBorde, color: d.color, fontWeight: 700 }}>{d.texto}</div>
            }
            return (
              <Fila key={f.metrica}>
                <div style={sinBorde}>{f.metrica}</div>
                <Celda unidad={f.unidad} valor={f.regla_actual} borde={borde} />
                <Celda unidad={f.unidad} valor={f.ritmo} borde={borde} fuerte />
                {dif}
              </Fila>
            )
          })}
        </div>
      </div>
      <div className="rt-lbl" style={{ marginTop: 12 }}>
        Ingresos y resultado: últimas 12 semanas; pérdida esperada: deuda en mora hoy. No incluye el walletback ni los tickets gratis del Club (sus valores aún son supuestos).
      </div>
    </section>
  )
}
const Fila = ({ children }) => <>{children}</>

function Grafico({ semanal, ritmoDesde, kpis }) {
  const n = semanal.length
  const x = (i) => (n > 1 ? (i * 1100) / (n - 1) : 550)
  const y = (v) => (240 - (v ?? 0) * 2.4).toFixed(1)
  const pts = (campo) => semanal.filter((s) => s[campo] !== null).map((s) => `${x(semanal.indexOf(s)).toFixed(1)},${y(s[campo])}`).join(' ')
  const primero = semanal[0], ultimo = semanal[n - 1]
  const aria = n ? `Repago a tiempo pasa de ${pctAuto(primero.repago_a_tiempo)} a ${pctAuto(ultimo.repago_a_tiempo)} y la mora de ${pctAuto(primero.mora)} a ${pctAuto(ultimo.mora)} en ${n} semanas` : 'Sin datos'
  return (
    <section className="rt-card" aria-labelledby="ch">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <h2 id="ch" className="rt-h2">Repago a tiempo y mora por semana</h2>
        <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 4, borderRadius: 2, background: '#4D7C0F' }} />Repago a tiempo</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 4, borderRadius: 2, background: '#B42318' }} />Mora</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 240, fontSize: 12, color: '#6B6B80', textAlign: 'right', width: 36 }}>
          <span>100 %</span><span>75 %</span><span>50 %</span><span>25 %</span><span>0 %</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <svg width="100%" height="240" viewBox="0 0 1100 240" preserveAspectRatio="none" role="img" aria-label={aria} style={{ display: 'block' }}>
            <path d="M0 1H1100M0 60H1100M0 120H1100M0 180H1100M0 239H1100" stroke="#ECEEF3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <polyline points={pts('repago_a_tiempo')} fill="none" stroke="#4D7C0F" strokeWidth="3.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <polyline points={pts('mora')} fill="none" stroke="#B42318" strokeWidth="3.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            {semanal.map((s, i) => (
              <rect key={s.desde} x={x(i) - 1100 / n / 2} y="0" width={1100 / n} height="240" fill="transparent">
                <title>{`Semana del ${s.etiqueta}: repago ${pctAuto(s.repago_a_tiempo)}, mora ${pctAuto(s.mora)}`}</title>
              </rect>
            ))}
          </svg>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, fontSize: 11, color: '#6B6B80', marginTop: 6 }}>
            {semanal.map((s) => <span key={s.desde}>{s.etiqueta}</span>)}
          </div>
        </div>
      </div>
      <div className="rt-lbl" style={{ marginTop: 12 }}>
        {ritmoDesde ? `Credirecto se activó el ${fechaCorta(ritmoDesde)}. ` : ''}Última semana: repago {pctAuto(kpis.repago_a_tiempo)}, mora {pctAuto(kpis.mora)}.
      </div>
    </section>
  )
}

function EsqueletoResumen() {
  const kpi = (i) => (
    <div className="rt-card" key={i}>
      <Esqueleto alto={14} ancho="60%" /><Esqueleto alto={34} ancho="80%" style={{ marginTop: 12 }} /><Esqueleto alto={12} ancho="40%" style={{ marginTop: 10 }} />
    </div>
  )
  return (
    <>
      <div className="rt-grid">{[0, 1, 2, 3].map(kpi)}</div>
      <div className="rt-dk" style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }} role="status">
        <Spinner /><span style={{ color: '#6B6B80' }}>Recalculando Credirecto vs. regla actual…</span>
      </div>
      <div className="rt-card"><Esqueleto alto={260} /></div>
    </>
  )
}

function Vacio() {
  return (
    <div className="rt-card" style={{ padding: '56px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 72, height: 72, borderRadius: 10, background: '#EEF4E4', color: '#3F6212', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 17l5-5 4 4 8-9" /><path d="M3 21h18" /></svg>
      </span>
      <div style={{ fontSize: 22, fontWeight: 700 }}>Todavía no hay pagos en este período</div>
      <div className="rt-lbl" style={{ fontSize: 15, maxWidth: 460 }}>Credirecto necesita al menos 7 días de pagos para calcular scores y comparar con la regla actual. Avanza el reloj de demo o carga los datos de ejemplo.</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Link to="/dashboard/configuracion" className="rt-btn rt-btn-primario">Ir al reloj de demo</Link>
      </div>
    </div>
  )
}

/** Descarga un CSV con KPIs, comparativo y serie semanal. */
function exportar(d) {
  const filas = [['seccion', 'metrica', 'regla_actual', 'credirecto', 'valor']]
  Object.entries(d.kpis).forEach(([k, v]) => filas.push(['kpis', k, '', '', v]))
  d.comparativo.forEach((c) => filas.push(['comparativo', c.metrica, c.regla_actual, c.ritmo, '']))
  d.semanal.forEach((s) => {
    filas.push(['semanal_repago', s.desde, '', '', s.repago_a_tiempo ?? ''])
    filas.push(['semanal_mora', s.desde, '', '', s.mora ?? ''])
  })
  const csv = filas.map((f) => f.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `credirecto-resumen-${d.hoy}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function Resumen() {
  const { datos: d, error, recargar } = useDatos((f) => f.resumen())

  const subtitulo = d
    ? `${entero(d.kpis.usuarios_totales)} usuarios · ${fechaCorta(d.desde)}${anio(d.desde) !== anio(d.hoy) ? ' ' + anio(d.desde) : ''} – ${fechaCorta(d.hoy)} ${anio(d.hoy)}`
    : error ? 'Sin datos del período' : 'Cargando período…'

  return (
    <>
      <Encabezado titulo="Resumen" subtitulo={subtitulo}>
        <Boton variante="borde" style={{ cursor: 'default' }} tabIndex={-1}>Últimas 12 semanas</Boton>
        <Boton onClick={() => d && exportar(d)} disabled={!d || !d.hay_datos}>Exportar</Boton>
      </Encabezado>

      {error && <ErrorCaja error={error} onReintentar={recargar} />}
      {!d && !error && <EsqueletoResumen />}
      {d && !d.hay_datos && <Vacio />}
      {d && d.hay_datos && (
        <>
          <Kpis k={d.kpis} />
          <Comparativo filas={d.comparativo} usuarios={d.kpis.usuarios_totales} />
          <Grafico semanal={d.semanal} ritmoDesde={d.ritmo_desde} kpis={d.kpis} />
        </>
      )}
    </>
  )
}
