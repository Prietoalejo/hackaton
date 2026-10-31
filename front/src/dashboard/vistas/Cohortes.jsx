// Vista 02 · Cohortes (GET /cohortes): ¿a los usuarios que empezaron con Credirecto les va mejor?
// Arriba la comparación antes / con Credirecto, luego el primer mes de cada cohorte y, plegado, semana a semana.
import { Fragment, useState } from 'react'
import { entero, fechaCorta } from '../../formato.js'
import { Encabezado, ErrorCaja, Esqueleto } from '../componentes.jsx'
import { useDatos } from '../datos.jsx'
import { MENOS, numAuto, pctAuto } from '../util.js'

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const POCOS = 10 // con menos casos el % salta mucho: se muestra atenuado

const METRICAS = {
  repago_a_tiempo: {
    boton: 'Pagan a tiempo', base: 'n_repago', casos: ['cuota', 'cuotas'],
    pregunta: '¿Qué % de las cuotas de su primer mes pagaron a tiempo?',
    kpi: (n) => `de ${entero(n)} cuotas de su primer mes`,
    semana: 'De las cuotas que usaron esa semana (ya vencidas), % pagadas a tiempo',
    bajo: 75, alto: 85,
  },
  reuso: {
    boton: 'Vuelven a usar', base: 'n_reuso', casos: ['usuario', 'usuarios'],
    pregunta: '¿Qué % volvió a usar un ticket en su primer mes?',
    kpi: (n) => `de ${entero(n)} usuarios con su primer mes completo`,
    semana: 'De los usuarios de la cohorte, % que usó otro ticket esa semana',
    bajo: 30, alto: 45,
  },
}

const casos = (m, n) => `${entero(n)} ${n === 1 ? m.casos[0] : m.casos[1]}`
const mesLargo = (cohorte) => MESES_LARGOS[Number(cohorte.slice(5, 7)) - 1]

/** Tono por tramos: bajo (rojo), medio (gris) o alto (verde) */
const tono = (m, v) => (v < m.bajo ? { background: '#FDECEC', color: '#B42318' }
  : v >= m.alto ? { background: '#EEF4E4', color: '#3F6212' } : { background: '#F3F4F8', color: '#15152B' })

export default function Cohortes() {
  const [clave, setClave] = useState('repago_a_tiempo')
  const [verSemanas, setVerSemanas] = useState(false)
  const { datos: d, error, recargar } = useDatos((f) => f.cohortes())
  const m = METRICAS[clave]
  const usuarios = d?.cohortes.reduce((s, c) => s + c.usuarios, 0)
  const desde = d?.ritmo_desde ? fechaCorta(d.ritmo_desde) : '—'

  return (
    <>
      <Encabezado titulo="Cohortes"
        subtitulo={`Usuarios agrupados por el mes de su primer ticket · ${d ? entero(usuarios) : '—'} usuarios`}>
        <div className="rt-seg" role="group" aria-label="Métrica">
          {Object.entries(METRICAS).map(([k, x]) => (
            <button key={k} type="button" aria-pressed={clave === k} onClick={() => setClave(k)}
              style={{ background: clave === k ? '#15152B' : 'transparent', color: clave === k ? '#FFFFFF' : '#4A4A5E' }}>{x.boton}</button>
          ))}
        </div>
      </Encabezado>

      {error && <ErrorCaja error={error} onReintentar={recargar} />}

      {!error && (
        <>
          <Comparacion d={d} m={m} clave={clave} desde={desde} />

          <section className="rt-card">
            <h2 className="rt-h2">Primer mes de cada cohorte</h2>
            <p className="rt-lbl" style={{ margin: '6px 0 0', fontSize: 14 }}>
              {m.pregunta} Todas se miden en sus primeras {d?.primer_mes_semanas ?? 4} semanas para compararlas igual.
            </p>
            {!d ? <Esqueleto alto={260} style={{ marginTop: 18 }} /> : <BarrasCohorte d={d} m={m} clave={clave} desde={desde} />}
          </section>

          <section className="rt-card">
            <button type="button" onClick={() => setVerSemanas((v) => !v)} aria-expanded={verSemanas}
              style={{ all: 'unset', cursor: 'pointer', display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                <span className="rt-h2" style={{ display: 'block', fontWeight: 700 }}>Semana a semana</span>
                <span className="rt-lbl" style={{ fontSize: 14 }}>Para el detalle: cómo evoluciona cada cohorte en sus primeras {d?.semanas ?? 12} semanas.</span>
              </span>
              <span style={{ fontWeight: 600, fontSize: 14, color: '#1F4FB8' }}>{verSemanas ? 'Ocultar' : 'Ver detalle'}</span>
            </button>
            {verSemanas && d && <Semanas d={d} m={m} clave={clave} />}
          </section>
        </>
      )}
    </>
  )
}

/** Dos números grandes: cohortes que empezaron antes de Credirecto vs. las que empezaron con él */
function Comparacion({ d, m, clave, desde }) {
  const g = d?.grupos
  const antes = g?.antes?.[clave]
  const con = g?.con?.[clave]
  const dif = antes != null && con != null ? con - antes : null
  const meses = (lista) => (lista.length ? `${lista[0].etiqueta.slice(0, 3).toLowerCase()}–${lista[lista.length - 1].etiqueta.slice(0, 3).toLowerCase()}` : '')
  const previas = d?.cohortes.filter((c) => !c.con_credirecto) || []
  const nuevas = d?.cohortes.filter((c) => c.con_credirecto) || []

  const caja = (titulo, sub, grupo, valor, color) => (
    <div className="rt-card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
        <span style={{ fontWeight: 600, fontSize: 15 }}>{titulo}</span>
      </div>
      <span className="rt-lbl">{sub}</span>
      <div className="rt-big" style={{ fontSize: 40 }}>{d ? pctAuto(valor) : '—'}</div>
      <span className="rt-lbl">{grupo ? m.kpi(grupo[m.base]) : ''}</span>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
      {caja('Empezaron antes de Credirecto', `Cohortes ${meses(previas)} · ${entero(g?.antes?.usuarios ?? 0)} usuarios`, g?.antes, antes, '#9AA0B4')}
      {caja('Empezaron con Credirecto', `Cohortes ${meses(nuevas)} · ${entero(g?.con?.usuarios ?? 0)} usuarios`, g?.con, con, '#4D7C0F')}
      <div className="rt-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8 }}>
        <span className="rt-lbl">Diferencia en el primer mes</span>
        {dif === null ? <div className="rt-big">—</div> : (
          <>
            <div className="rt-big" style={{ fontSize: 40, color: Math.abs(dif) < 0.05 ? '#15152B' : dif > 0 ? '#3F6212' : '#B42318' }}>
              {dif > 0 ? '+' : dif < 0 ? MENOS : ''}{numAuto(Math.abs(dif))} pts
            </div>
            <span style={{ fontSize: 14, lineHeight: 1.4 }}>
              {dif > 0 ? 'Mejor' : dif < 0 ? 'Peor' : 'Igual'} con Credirecto, que decide desde el {desde}.
            </span>
          </>
        )}
      </div>
    </div>
  )
}

/** Una barra por cohorte con la línea del promedio "antes" y un corte donde empieza Credirecto */
function BarrasCohorte({ d, m, clave, desde }) {
  const ref = d.grupos?.antes?.[clave]
  const fila = { display: 'grid', gridTemplateColumns: '200px 1fr 160px', alignItems: 'center', gap: 16 }
  return (
    <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {d.cohortes.map((c, i) => {
        const v = c.primer_mes?.[clave]
        const n = c.primer_mes?.[m.base] ?? 0
        const pocos = n < POCOS
        const corte = c.con_credirecto && !d.cohortes[i - 1]?.con_credirecto
        return (
          <Fragment key={c.cohorte}>
            {corte && (
              <div style={{ ...fila, margin: '4px 0' }}>
                <span />
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, borderTop: '1.5px dashed #9AA0B4' }} />
                  <span className="rt-pill" style={{ background: '#15152B', color: '#fff' }}>{desde} · Credirecto empieza a decidir</span>
                  <span style={{ flex: 1, borderTop: '1.5px dashed #9AA0B4' }} />
                </span>
                <span />
              </div>
            )}
            <div style={fila} title={`${c.etiqueta}: ${pctAuto(v)} · ${casos(m, n)}`}>
              <span>
                <b style={{ fontSize: 15, display: 'block' }}>Empezaron en {mesLargo(c.cohorte)}</b>
                <span className="rt-lbl">{entero(c.usuarios)} usuarios</span>
              </span>
              <span style={{ position: 'relative', height: 28, borderRadius: 6, background: '#F3F4F8' }}>
                {v != null && (
                  <span style={{ position: 'absolute', inset: '0 auto 0 0', width: `${v}%`, borderRadius: 6, opacity: pocos ? 0.4 : 1, background: c.con_credirecto ? '#4D7C0F' : '#9AA0B4' }} />
                )}
                {ref != null && (
                  <span aria-hidden="true" style={{ position: 'absolute', top: -4, bottom: -4, left: `${ref}%`, borderLeft: '2px solid #15152B' }} />
                )}
              </span>
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <b style={{ fontSize: 18 }}>{v == null ? '—' : pctAuto(v)}</b>
                <span className="rt-lbl">{v == null ? 'aún sin primer mes' : pocos ? `solo ${casos(m, n)}` : `de ${casos(m, n)}`}</span>
              </span>
            </div>
          </Fragment>
        )
      })}
      <div style={{ ...fila, marginTop: 6 }}>
        <span />
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 18, fontSize: 13, color: '#6B6B80' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 0, height: 14, borderLeft: '2px solid #15152B' }} />Promedio antes de Credirecto ({pctAuto(ref)})</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 10, borderRadius: 3, background: '#4D7C0F', opacity: 0.4 }} />Barra clara = menos de {POCOS} {m.casos[1]}, tómalo con cuidado</span>
        </span>
        <span />
      </div>
    </div>
  )
}

/** Mapa semana a semana con tramos de color, base de cada celda y el corte de Credirecto */
function Semanas({ d, m, clave }) {
  const nSem = d.semanas
  const grid = { display: 'grid', gridTemplateColumns: `130px repeat(${nSem}, minmax(44px, 1fr))`, gap: 6, minWidth: 820 }
  const muestra = (estilo, texto) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 16, height: 16, borderRadius: 4, ...estilo }} />{texto}</span>
  )
  return (
    <div style={{ marginTop: 18 }}>
      <p style={{ margin: '0 0 14px', fontSize: 14 }}>
        Cada fila es una cohorte; cada columna, su semana 1, 2, 3… <b>contada desde su primer ticket</b> (no semanas del calendario).
        Por eso las cohortes recientes tienen menos semanas. {m.semana}.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <div style={grid}>
          <span />
          <span className="rt-lbl" style={{ gridColumn: `span ${nSem}`, textAlign: 'center', borderBottom: '1px solid #E3E5EA', paddingBottom: 6 }}>Semanas desde su primer ticket →</span>
          <span className="rt-lbl" style={{ alignSelf: 'end' }}>Empezaron en</span>
          {Array.from({ length: nSem }, (_, i) => <span key={i} className="rt-lbl" style={{ textAlign: 'center' }}>{i + 1}</span>)}
          {d.cohortes.map((c, i) => (
            <Fragment key={c.cohorte}>
              {c.con_credirecto && !d.cohortes[i - 1]?.con_credirecto && (
                <span style={{ gridColumn: `1 / span ${nSem + 1}`, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 600, color: '#3F6212' }}>
                  Con Credirecto<span style={{ flex: 1, borderTop: '1.5px dashed #9AA0B4' }} />
                </span>
              )}
              <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <b style={{ fontSize: 15 }}>{c.etiqueta}</b><span className="rt-lbl">{entero(c.usuarios)} usuarios</span>
              </span>
              {Array.from({ length: nSem }, (_, k) => {
                const s = c.semanas.find((x) => x.semana === k + 1)
                const v = s?.[clave]
                const n = s?.[m.base] ?? 0
                if (v == null) {
                  return <span key={k} className="rt-cell" style={{ border: '1.5px dashed #C9CBD6', color: '#8A8DA0' }} title={n ? `Sin ${m.casos[1]} todavía` : 'Aún no llega a esa semana'}>—</span>
                }
                return (
                  <span key={k} className="rt-cell" title={`${c.etiqueta} · semana ${k + 1}: ${pctAuto(v)} de ${casos(m, n)}`}
                    style={{ ...tono(m, v), opacity: n < POCOS ? 0.45 : 1 }}>
                    {Math.round(v)}%
                  </span>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 16, fontSize: 13, color: '#6B6B80' }}>
        {muestra({ background: '#FDECEC' }, `Bajo (< ${m.bajo} %)`)}
        {muestra({ background: '#F3F4F8' }, 'Medio')}
        {muestra({ background: '#EEF4E4' }, `Alto (≥ ${m.alto} %)`)}
        {muestra({ background: '#EEF4E4', opacity: 0.45 }, `Menos de ${POCOS} ${m.casos[1]}`)}
        {muestra({ border: '1.5px dashed #C9CBD6' }, 'Aún no llega a esa semana')}
        <span>Pasa el cursor por una celda para ver cuántos casos tiene.</span>
      </div>
    </div>
  )
}
