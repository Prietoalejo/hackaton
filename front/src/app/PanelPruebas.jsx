// Panel de pruebas (fuera del teléfono): elegir usuario, avanzar el reloj y saltar a las pantallas.
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { bs, fechaRelojLarga } from '../formato.js'
import { datos, mensajeError } from './datos.js'

const RAPIDOS = [
  { id: 'u_0142', txt: 'María · habilitada' },
  { id: 'u_0333', txt: 'Carmen · sin Credirecto' },
  { id: 'u_0007', txt: 'Pedro · no paga' },
  { id: 'u_0331', txt: 'Daniela · tickets y servicios', soloApi: true },
  { id: 'u_0058', txt: 'Andrea · cuota en gracia', soloMock: true },
]

export default function PanelPruebas({ userId, elegirUsuario, hoy, avanzarDia, avanzando, resultadoDia, ficha, error, mock }) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState([])
  const [errorBusqueda, setErrorBusqueda] = useState(null)

  // Búsqueda con pequeña espera para no pedir en cada tecla
  useEffect(() => {
    const t = q.trim()
    if (!t) { setResultados([]); setErrorBusqueda(null); return }
    let vigente = true
    const id = setTimeout(() => {
      datos.usuarios({ q: t, limit: 8 })
        .then((r) => { if (vigente) { setResultados(r.usuarios || []); setErrorBusqueda(null) } })
        .catch((e) => { if (vigente) { setResultados([]); setErrorBusqueda(mensajeError(e)) } })
    }, 250)
    return () => { vigente = false; clearTimeout(id) }
  }, [q])

  const enGracia = ficha?.tickets_abiertos?.find((t) => t.estado === 'gracia')
  const conOferta = ficha?.tickets_abiertos?.find((t) => t.oferta_quincena)
  const pantallas = [
    { to: '/app', txt: 'Home', end: true },
    { to: '/app/detalle', txt: '03 Detalle' },
    { to: '/app/pago', txt: '04 Pago' },
    conOferta && { to: `/app/quincena/${conOferta.id}`, txt: '05 Quincena' },
    { to: '/app/racha', txt: '07 Racha' },
    { to: '/app/club', txt: 'Club' },
    enGracia && { to: `/app/gracia/${enGracia.id}`, txt: '08 Gracia' },
    { to: '/app/notificaciones', txt: '10 Push' },
  ].filter(Boolean)

  return (
    <aside className="cd-panel" aria-label="Panel de pruebas">
      <div>
        <h1>Credirecto · pruebas</h1>
        <div style={{ fontSize: 13, color: '#6B6B80' }}>
          {mock ? 'Datos simulados (VITE_MOCK=1)' : 'Conectado a la API'}
        </div>
      </div>

      <section className="cd-pbox">
        <h2>Reloj</h2>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{hoy ? fechaRelojLarga(hoy) : '—'}</div>
        <button className="cd-pbtn prim" onClick={avanzarDia} disabled={avanzando}>{avanzando ? 'Avanzando…' : 'Avanzar un día'}</button>
        {resultadoDia && <div style={{ fontSize: 12, color: '#6B6B80' }}>{resultadoDia}</div>}
      </section>

      <section className="cd-pbox">
        <h2>Usuario</h2>
        {RAPIDOS.filter((r) => (mock ? !r.soloApi : !r.soloMock)).map((r) => (
          <button key={r.id} className="cd-pbtn" aria-pressed={userId === r.id} onClick={() => elegirUsuario(r.id)}>
            <b>{r.id}</b> · {r.txt}
          </button>
        ))}
        <input placeholder="Buscar por id o nombre…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar usuario" />
        {errorBusqueda && <div className="cd-perr">{errorBusqueda}</div>}
        {resultados.map((u) => (
          <button key={u.user_id} className="cd-pbtn" aria-pressed={userId === u.user_id} onClick={() => { elegirUsuario(u.user_id); setQ('') }}>
            <b>{u.user_id}</b> · {u.nombre}
            <span style={{ display: 'block', fontSize: 12, color: '#6B6B80' }}>
              {u.habilitado ? `${u.nivel_nombre} · ${u.tickets_usados}/${u.tickets_total} tickets` : 'En espera'}
              {u.modo_recuperacion ? ' · recuperación' : ''} · score {u.trust_score}
            </span>
          </button>
        ))}
      </section>

      {error && <div className="cd-perr" role="alert">{error}</div>}

      {ficha && (
        <section className="cd-pbox">
          <h2>Ficha actual</h2>
          <div className="cd-pdato"><span>Usuario</span><span>{ficha.nombre} ({ficha.user_id})</span></div>
          <div className="cd-pdato"><span>Nivel</span><span>{ficha.habilitado ? ficha.nivel_nombre : 'No habilitado'}</span></div>
          <div className="cd-pdato"><span>Trust Score</span><span>{ficha.trust_score}</span></div>
          <div className="cd-pdato"><span>Tickets</span><span>{ficha.tickets.disponibles} de {ficha.tickets.total} disponibles</span></div>
          {ficha.servicios_cupo?.total > 0 && (
            <div className="cd-pdato"><span>Pagos de servicios</span><span>{ficha.servicios_cupo.disponibles} de {ficha.servicios_cupo.total} disponibles</span></div>
          )}
          <div className="cd-pdato"><span>Deuda</span><span>{bs(ficha.deuda_total)}</span></div>
          <div className="cd-pdato"><span>Saldo wallet</span><span>{bs(ficha.saldo_wallet)}</span></div>
          <div className="cd-pdato"><span>Estado</span><span>{ficha.modo_recuperacion ? 'Modo recuperación' : ficha.estado_mora}</span></div>
        </section>
      )}

      <section className="cd-pbox">
        <h2>Pantallas</h2>
        <div className="cd-plinks">
          {pantallas.map((p) => (
            <NavLink key={p.to} to={p.to} end={p.end} className={({ isActive }) => (isActive ? 'activo' : undefined)}>{p.txt}</NavLink>
          ))}
        </div>
      </section>
    </aside>
  )
}
