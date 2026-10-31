// Vista 04 · Decisiones (GET /decisiones): prestar, habilitar, comunicar y premiar en la semana.
import { Link } from 'react-router-dom'
import { bs, entero, fechaCorta, NIVELES, usd } from '../../formato.js'
import { Chip, Encabezado, ErrorCaja, Esqueleto, FilaBarra, Tabla } from '../componentes.jsx'
import { useDatos } from '../datos.jsx'
import { pctAuto } from '../util.js'

const semanaTexto = (desde, hasta) => {
  const [d1, m1] = fechaCorta(desde).split(' ')
  const [d2, m2] = fechaCorta(hasta).split(' ')
  return m1 === m2 ? `semana del ${d1} al ${d2} ${m2}` : `semana del ${d1} ${m1} al ${d2} ${m2}`
}
const porcion = (n, total) => (total ? (n / total) * 100 : 0)

function Solicitudes({ s }) {
  const max = Math.max(1, ...s.motivos.map((m) => m.usuarios))
  const bloques = [['Aprobadas', s.aprobadas], ['Parciales (ticket + saldo)', s.parciales], ['Rechazadas', s.rechazadas]]
  return (
    <section className="rt-card">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}><h2 className="rt-h2">Solicitudes de crédito</h2><b>{entero(s.total)}</b></div>
      <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', gap: 3, marginTop: 16 }} aria-hidden="true">
        <span style={{ width: `${porcion(s.aprobadas, s.total)}%`, background: '#4D7C0F' }} />
        <span style={{ width: `${porcion(s.parciales, s.total)}%`, background: '#3F6212' }} />
        <span style={{ flex: 1, background: '#B42318' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
        {bloques.map(([nombre, n]) => (
          <div key={nombre}><div className="rt-lbl">{nombre}</div><div style={{ fontSize: 24, fontWeight: 700 }}>{entero(n)}</div><div className="rt-lbl">{pctAuto(porcion(n, s.total))}</div></div>
        ))}
      </div>
      <div style={{ fontWeight: 600, marginTop: 20 }}>Motivos de rechazo</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        {s.motivos.length === 0 && <div className="rt-lbl">Sin rechazos esta semana.</div>}
        {s.motivos.map((m) => <FilaBarra key={m.motivo} etiqueta={m.motivo} valor={entero(m.usuarios)} pct={(m.usuarios / max) * 100} color="#B42318" />)}
      </div>
    </section>
  )
}

function Habilitaciones({ h, e }) {
  const max = Math.max(1, ...e.faltantes.map((f) => f.usuarios))
  return (
    <section className="rt-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="rt-h2">Habilitaciones</h2>
        <Chip tono="positivo" style={{ padding: '3px 10px' }}>+{entero(h.semana)} esta semana</Chip>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {h.recientes.length === 0 && <div className="rt-lbl">Nadie se habilitó esta semana.</div>}
        {h.recientes.map((r) => (
          <Link key={r.user_id} to={`/dashboard/usuarios/${r.user_id}`}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F3F4F8', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#15152B', textDecoration: 'none' }}>
            <span><b>{r.user_id}</b> · {r.nombre}</span><span className="rt-lbl">{fechaCorta(r.fecha)} · {r.nivel === null ? '—' : NIVELES[r.nivel]}</span>
          </Link>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}><span style={{ fontWeight: 600 }}>Qué les falta a los {entero(e.total)} en espera</span></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        {e.faltantes.map((f) => <FilaBarra key={f.requisito} etiqueta={f.requisito} valor={entero(f.usuarios)} pct={(f.usuarios / max) * 100} color="#9AA0B4" />)}
      </div>
    </section>
  )
}

function Mensajes({ m }) {
  const columnas = [
    { titulo: 'Momento', render: (r) => <><b>{r.nombre}</b><div className="rt-lbl">{r.descripcion}</div></> },
    { titulo: 'Push', render: (r) => entero(r.push) },
    { titulo: 'Wisi', render: (r) => entero(r.wisi) },
    { titulo: 'Total', render: (r) => <b>{entero(r.total)}</b> },
    {
      titulo: 'Pagan en 48 h',
      render: (r) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 90, height: 8, borderRadius: 4, background: '#F3F4F8' }}>
            <span style={{ display: 'block', height: '100%', borderRadius: 4, background: '#4D7C0F', width: `${r.pct_pagan_48h ?? 0}%` }} />
          </span>
          {r.pct_pagan_48h === null ? '—' : `${Math.round(r.pct_pagan_48h)}%`}
        </span>
      ),
    },
  ]
  return (
    <section className="rt-card">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
        <h2 className="rt-h2">Mensajes por momento y canal</h2>
        <span className="rt-lbl">{entero(m.enviados)} enviados · {pctAuto(m.pct_pagan_48h)} pagan en 48 h</span>
      </div>
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <Tabla columnas={columnas} filas={m.por_tipo} clave={(r) => r.tipo} />
      </div>
    </section>
  )
}

function Premios({ p }) {
  const caja = (titulo, valor, extra) => (
    <div style={{ background: '#F5F6F8', borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 13, color: '#6B6B80' }}>{titulo}</div>
      <div style={{ fontSize: 32, fontWeight: 700, color: '#3F6212' }}>{valor}</div>
      {extra && <div style={{ fontSize: 13, color: '#6B6B80' }}>{extra}</div>}
    </div>
  )
  return (
    <section style={{ borderRadius: 12, padding: '22px 24px', color: '#15152B', background: '#FFFFFF', border: '1px solid #E3E5EA' }}>
      <h2 className="rt-h2">Premios</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginTop: 16 }}>
        {caja('Rachas activadas por pagos de Credirecto', entero(p.rachas))}
        {caja('Multiplicadores ×1,5 activados', entero(p.multiplicadores))}
        {caja('Puntos del Club otorgados', entero(p.puntos))}
        {caja('Descuentos por nivel', entero(p.descuentos), `${usd(p.descuentos_monto)} · ${bs(p.descuentos_monto)}`)}
      </div>
    </section>
  )
}

export default function Decisiones() {
  const { datos: d, error, recargar } = useDatos((f) => f.decisiones())
  return (
    <>
      <Encabezado titulo="Decisiones"
        subtitulo={`Prestar, habilitar, comunicar y premiar${d ? ' · ' + semanaTexto(d.desde, d.hasta) : ''}`} />
      {error && <ErrorCaja error={error} onReintentar={recargar} />}
      {!d && !error && (
        <>
          <div className="rt-two"><div className="rt-card"><Esqueleto alto={380} /></div><div className="rt-card"><Esqueleto alto={380} /></div></div>
          <div className="rt-card"><Esqueleto alto={300} /></div>
        </>
      )}
      {d && (
        <>
          <div className="rt-two">
            <Solicitudes s={d.solicitudes} />
            <Habilitaciones h={d.habilitaciones} e={d.en_espera} />
          </div>
          <Mensajes m={d.mensajes} />
          <Premios p={d.premios} />
        </>
      )}
    </>
  )
}
