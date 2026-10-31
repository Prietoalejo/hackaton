// Vista 02 · Cohortes (GET /cohortes): mapa de calor por semana desde el primer uso.
import { Fragment, useState } from 'react'
import { entero, fechaCorta } from '../../formato.js'
import { Encabezado, ErrorCaja } from '../componentes.jsx'
import { useDatos } from '../datos.jsx'

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Escala del diseño: de #E2E4EA (bajo) a #9BC26B (alto)
const ESCALA = {
  repago_a_tiempo: { lo: 65, hi: 95, titulo: '% que repaga a tiempo, por semana desde su primer uso' },
  reuso: { lo: 30, hi: 85, titulo: '% que vuelve a usar Credirecto, por semana desde su primer uso' },
}
const mezcla = (t) => {
  const a = [226, 228, 234], b = [155, 194, 107]
  return 'rgb(' + a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(',') + ')'
}

function Celda({ valor, escala, cohorte, semana }) {
  if (valor === null || valor === undefined) {
    return <span className="rt-cell" style={{ border: '1.5px dashed #C9CBD6', color: '#8A8DA0', background: 'transparent' }} title="Sin datos todavía">—</span>
  }
  const t = Math.max(0, Math.min(1, (valor - escala.lo) / (escala.hi - escala.lo)))
  return (
    <span className="rt-cell" style={{ background: mezcla(t), color: '#15152B' }}
      title={`${cohorte} · semana ${semana}: ${valor.toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}>
      {Math.round(valor)}%
    </span>
  )
}

export default function Cohortes() {
  const [metrica, setMetrica] = useState('repago_a_tiempo')
  const { datos: d, error, recargar } = useDatos((f) => f.cohortes())
  const escala = ESCALA[metrica]
  const nSem = d?.semanas || 12

  const boton = (clave, texto) => {
    const on = metrica === clave
    return (
      <button type="button" aria-pressed={on} onClick={() => setMetrica(clave)}
        style={{ background: on ? '#15152B' : 'transparent', color: on ? '#FFFFFF' : '#4A4A5E' }}>{texto}</button>
    )
  }
  const extremo = (x) => (x?.[metrica] ? `${x[metrica].etiqueta} · ${Math.round(x[metrica].valor)}%` : '—')
  const mesRitmo = d?.ritmo_desde ? MESES_LARGOS[Number(d.ritmo_desde.slice(5, 7)) - 1] : null
  const grid = { gridTemplateColumns: `96px repeat(${nSem}, minmax(44px, 1fr))` }

  return (
    <>
      <Encabezado titulo="Cohortes"
        subtitulo={`Por mes del primer uso de Credirecto · ${d ? entero(d.habilitados) : '—'} usuarios habilitados`}>
        <div className="rt-seg" role="group" aria-label="Métrica">
          {boton('repago_a_tiempo', 'Repago a tiempo')}
          {boton('reuso', 'Reuso')}
        </div>
      </Encabezado>

      {error && <ErrorCaja error={error} onReintentar={recargar} />}

      {!error && (
        <section className="rt-card">
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <h2 className="rt-h2">{escala.titulo}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#6B6B80' }}>
              {escala.lo}%<span style={{ width: 160, height: 12, borderRadius: 6, background: 'linear-gradient(90deg,#E2E4EA,#9BC26B)' }} />{escala.hi}%
            </div>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 18 }}>
            {!d ? (
              <div className="rt-hm" role="status" aria-label="Cargando cohortes">
                {Array.from({ length: 78 }, (_, i) => <span key={i} className="rt-cell rt-sk" style={{ background: '#ECEEF3' }} />)}
              </div>
            ) : (
              <div className="rt-hm" style={grid}>
                <span className="rt-lbl" style={{ alignSelf: 'end' }}>Cohorte</span>
                {Array.from({ length: nSem }, (_, i) => <span key={i} className="rt-lbl" style={{ textAlign: 'center' }}>S{i + 1}</span>)}
                {d.cohortes.map((c) => (
                  <Fragment key={c.cohorte}>
                    <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <b style={{ fontSize: 15 }}>{c.etiqueta}</b><span className="rt-lbl">{entero(c.usuarios)} usuarios</span>
                    </span>
                    {Array.from({ length: nSem }, (_, i) => {
                      const s = c.semanas.find((x) => x.semana === i + 1)
                      return <Celda key={i} valor={s ? s[metrica] : null} escala={escala} cohorte={c.etiqueta} semana={i + 1} />
                    })}
                  </Fragment>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 16, fontSize: 13, color: '#6B6B80' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 18, height: 18, borderRadius: 6, border: '1.5px dashed #C9CBD6' }} />Aún no llega a esa semana</span>
            {d?.ritmo_desde && <span>Ritmo empezó a decidir el {fechaCorta(d.ritmo_desde)}: mira el salto desde la cohorte de {mesRitmo}.</span>}
          </div>
        </section>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div className="rt-card"><div className="rt-lbl">Mejor cohorte, semana 4</div><div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{d ? extremo(d.mejor_semana4) : '—'}</div></div>
        <div className="rt-card"><div className="rt-lbl">Peor cohorte, semana 4</div><div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{d ? extremo(d.peor_semana4) : '—'}</div></div>
        <div style={{ borderRadius: 12, padding: '22px 24px', color: '#15152B', background: '#FFFFFF', border: '1px solid #E3E5EA', display: 'flex', gap: 12, alignItems: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C6F432" strokeWidth="2" style={{ flex: 'none' }} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16v.5" /></svg>
          <span style={{ fontSize: 15, lineHeight: 1.4 }}>Una cohorte nunca cambia; los usuarios se mueven entre segmentos y niveles.</span>
        </div>
      </div>
    </>
  )
}
