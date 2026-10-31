// Ficha de usuario (GET /usuarios/{id}): score con razones, cupo, progreso,
// las tres decisiones PRESTAR / COMUNICAR / PREMIAR y la línea de tiempo.
import { useEffect, useRef } from 'react'
import { bs, fechaCorta, SERVICIOS, usd } from '../../formato.js'
import { Chip, ErrorCaja, Esqueleto, Segmentos } from '../componentes.jsx'
import { useDatos } from '../datos.jsx'
import { cupo, listaY, MENOS, numAuto } from '../util.js'

const colorGrande = (s) => (s >= 60 ? '#3F6212' : s >= 40 ? '#15152B' : '#B42318')
const montoCorto = (n) => usd(n, Number.isInteger(n) ? 0 : 2)
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
const mayuscula = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t)
const CANAL = { push: 'Push', wisi: 'Wisi', sms: 'SMS', email: 'Correo' }

const COLOR_EVENTO = {
  Ticket: '#4D7C0F', Pago: '#4D7C0F', Recarga: '#4D7C0F',
  Mensaje: '#B42318', 'Comisión': '#B42318', Mora: '#B42318', Nivel: '#15152B',
}

function Score({ u }) {
  return (
    <div style={{ borderRadius: 10, padding: 22, color: '#15152B', background: '#FFFFFF', border: '1px solid #E3E5EA' }}>
      <div style={{ fontSize: 14, color: '#6B6B80' }}>Trust Score</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1, color: colorGrande(u.trust_score) }}>{u.trust_score}</span>
        <span style={{ color: '#6B6B80' }}>/ 100</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
        {u.razones.map((r) => {
          const resta = r.max < 0 || r.aporte < 0
          const color = resta ? '#B42318' : '#3F6212'
          const texto = resta ? (r.aporte === 0 ? '0' : MENOS + numAuto(Math.abs(r.aporte))) : `${numAuto(r.aporte)}/${r.max}`
          const ancho = r.max ? Math.min(100, Math.abs(r.aporte / r.max) * 100) : 0
          return (
            <div key={r.senal}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}><span>{r.nombre}</span><b style={{ color }}>{texto}</b></div>
              <div style={{ height: 8, borderRadius: 4, background: '#EEF0F3', marginTop: 4 }}><div style={{ height: '100%', borderRadius: 4, width: `${ancho}%`, background: color }} /></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const caja = { background: '#F3F4F8', borderRadius: 10, padding: 18 }

function Cupo({ u }) {
  const t = u.tickets
  if (!u.habilitado) {
    return (
      <div style={caja}>
        <div className="rt-lbl">Tickets disponibles</div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>—</div>
        <div className="rt-lbl">No habilitado</div>
      </div>
    )
  }
  return (
    <div style={caja}>
      <div className="rt-lbl">Tickets disponibles</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{t.disponibles} <span style={{ fontSize: 16, color: '#6B6B80', fontWeight: 500 }}>de {t.total}</span></div>
      <div className="rt-lbl">Hasta {montoCorto(t.monto_max)} por ticket · {bs(t.monto_max)}</div>
      {t.ajuste ? (
        <div className="rt-lbl" style={{ color: t.ajuste > 0 ? '#3F6212' : '#B42318' }}>
          Base del nivel {t.base} · {t.ajuste > 0 ? '+' : MENOS}{Math.abs(t.ajuste)} por su ritmo de pago
        </div>
      ) : null}
      <Segmentos total={t.total} llenos={t.disponibles} desde="fin" />
      {u.servicios_cupo?.total > 0 && (
        <div className="rt-lbl" style={{ marginTop: 8 }}>
          Pagos de servicios: <b style={{ color: '#15152B' }}>{u.servicios_cupo.disponibles} de {u.servicios_cupo.total}</b> disponibles
        </div>
      )}
    </div>
  )
}

/** Motor de beneficios: base de la ruta del Club × factor personal, con el porqué */
function Beneficios({ b }) {
  const pct = Math.round(b.factor * 100)
  const tono = b.pausa || pct < 100 ? '#B42318' : pct > 100 ? '#3F6212' : '#15152B'
  const num = (n) => Number(n).toLocaleString('es-VE', { maximumFractionDigits: 2 })
  return (
    <div style={{ border: '1px solid #E3E5EA', borderRadius: 10, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', color: '#6B6B80' }}>BENEFICIOS DEL CLUB · {b.ruta}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: tono }}>{b.pausa ? 'En pausa (modo recuperación)' : `${pct} % del beneficio de la ruta`}</div>
        </div>
        {b.a_tu_medida && <Chip tono="positivo">A su medida: {b.a_tu_medida.nombre}</Chip>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 12 }}>
        {b.beneficios.map((x) => (
          <div key={x.tipo} style={{ background: '#F5F6F8', borderRadius: 8, padding: 12 }}>
            <div className="rt-lbl">{x.nombre}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{num(x.personal)}{x.unidad && ` ${x.unidad}`} <span className="rt-lbl" style={{ fontWeight: 400 }}>base {num(x.base)}{x.unidad && ` ${x.unidad}`}</span></div>
            {x.estimado_mes > 0 && <div className="rt-lbl">≈ {usd(x.estimado_mes)} al mes · {bs(x.estimado_mes)}</div>}
          </div>
        ))}
      </div>
      <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13, color: '#4A4A5E' }}>
        {b.razones.length
          ? b.razones.map((r) => <li key={r.senal}><b style={{ color: r.efecto >= 0 ? '#3F6212' : '#B42318' }}>{r.efecto >= 0 ? '+' : MENOS}{Math.round(Math.abs(r.efecto) * 100)} %</b> {r.texto}</li>)
          : <li>Sin señales a favor ni en contra: recibe la base de su ruta.</li>}
      </ul>
    </div>
  )
}

function Progreso({ u }) {
  if (!u.habilitado) {
    const listos = u.checklist.filter((c) => c.ok).length
    return (
      <div style={caja}>
        <div className="rt-lbl">Requisitos para habilitar · {listos} de {u.checklist.length}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, fontSize: 14 }}>
          {u.checklist.map((c) => (
            <div key={c.requisito} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 9, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: c.ok ? '#EEF4E4' : '#FDECEC', color: c.ok ? '#3F6212' : '#B42318' }}>{c.ok ? '✓' : '✕'}</span>
              <span style={{ color: c.ok ? '#15152B' : '#4A4A5E' }}>{c.nombre}{c.detalle ? <span className="rt-lbl"> · {c.detalle}</span> : null}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  const p = u.progreso
  if (!p) {
    return (
      <div style={caja}>
        <div className="rt-lbl">Progreso</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>Ya está en Credirecto {u.nivel_nombre}, el nivel más alto</div>
      </div>
    )
  }
  const partes = []
  if (p.faltan_puntos > 0) partes.push(plural(p.faltan_puntos, 'punto', 'puntos'))
  if (p.faltan_repagos > 0) partes.push(plural(p.faltan_repagos, 'repago', 'repagos'))
  if (p.faltan_pts_club > 0) partes.push(`${p.faltan_pts_club.toLocaleString('es-VE')} pts del Club (${p.ruta_requerida})`)
  const texto = partes.length ? `Le faltan ${partes.join(' y ')} para ${p.siguiente_nombre}` : `Listo para subir a ${p.siguiente_nombre} en el próximo recálculo`
  return (
    <div style={caja}>
      <div className="rt-lbl">Progreso a {p.siguiente_nombre}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 4, lineHeight: 1.3 }}>{texto}</div>
      {p.repagos_requeridos > 0 && <Segmentos total={p.repagos_requeridos} llenos={p.repagos_hechos} />}
    </div>
  )
}

const ROTULO = { fontSize: 13, fontWeight: 700, letterSpacing: '.04em' }
const TITULO = { fontSize: 20, fontWeight: 700, marginTop: 6 }

const MOTIVOS = {
  no_habilitado: ['No habilitado', 'Le faltan requisitos para activar Credirecto'],
  modo_recuperacion: ['Bloqueado: modo recuperación', 'Solo puede recargar y pagar hasta saldar la deuda'],
  deuda_vencida: ['En pausa: deuda vencida', 'Vuelve a prestarle cuando pague su cuota'],
}

function Prestar({ p }) {
  if (p.motivo) {
    const [t, s] = MOTIVOS[p.motivo] || ['No presta', p.motivo]
    return (
      <div style={{ borderRadius: 10, padding: 18, background: '#F5F6F8' }}>
        <div style={{ ...ROTULO, color: '#B42318' }}>PRESTAR</div>
        <div style={TITULO}>{t}</div>
        <div style={{ fontSize: 13, color: '#6B6B80' }}>{s}</div>
      </div>
    )
  }
  const servicios = p.servicios.map((s) => (SERVICIOS[s] || s).toLowerCase())
  return (
    <div style={{ borderRadius: 10, padding: 18, background: '#F5F6F8', color: '#15152B' }} title={p.plazo_dias ? `Plazo: ${p.plazo_dias} días` : undefined}>
      <div style={{ ...ROTULO, color: '#3F6212' }}>PRESTAR</div>
      <div style={TITULO}>{p.tickets > 0 || p.servicios_cupo > 0 ? `Aprobado: ${cupo(p.tickets, p.servicios_cupo ?? 0)}` : 'Sin tickets libres'}</div>
      <div style={{ fontSize: 13, color: '#6B6B80' }}>
        {p.tickets > 0 || p.servicios_cupo > 0
          ? `Hasta ${montoCorto(p.monto_max)} c/u · ${servicios.join(', ')}`
          : 'Se le renueva un ticket cuando pague su cuota'}
      </div>
    </div>
  )
}

function Comunicar({ c }) {
  return (
    <div style={{ borderRadius: 10, padding: 18, background: '#F5F6F8' }} title={c?.mensaje ? `«${c.mensaje}»` : undefined}>
      <div style={{ ...ROTULO, color: '#B42318' }}>COMUNICAR</div>
      {c ? (
        <>
          <div style={TITULO}>{c.nombre} {c.fecha ? fechaCorta(c.fecha) : ''}</div>
          <div style={{ fontSize: 13, color: '#4A4A5E' }}>
            {CANAL[c.canal] || mayuscula(c.canal)}
            {c.oferta_quincena ? ` · con oferta de mover la cuota al ${Number(c.oferta_quincena.slice(8, 10))}` : ''}
          </div>
        </>
      ) : (
        <>
          <div style={TITULO}>Sin mensaje pendiente</div>
          <div style={{ fontSize: 13, color: '#4A4A5E' }}>No hay nada que comunicarle por ahora</div>
        </>
      )}
    </div>
  )
}

function Premiar({ premios, vence }) {
  if (!premios.length) {
    return (
      <div style={{ borderRadius: 10, padding: 18, background: '#F5F6F8' }}>
        <div style={{ ...ROTULO, color: '#3F6212' }}>PREMIAR</div>
        <div style={TITULO}>Sin premio pendiente</div>
        <div style={{ fontSize: 13, color: '#6B6B80' }}>Se activa cuando tenga una cuota por pagar a tiempo</div>
      </div>
    )
  }
  const principales = premios.filter((p) => p.tipo !== 'descuento_nivel').map((p) => p.detalle)
  const descuentos = premios.filter((p) => p.tipo === 'descuento_nivel').map((p) => p.detalle)
  const titulo = principales.length ? mayuscula(listaY(principales)) : mayuscula(descuentos.shift())
  const sub = [vence ? `Si paga antes del ${Number(vence.slice(8, 10))}` : null, ...descuentos].filter(Boolean).join(' · ')
  return (
    <div style={{ borderRadius: 10, padding: 18, background: '#EEF4E4' }}>
      <div style={{ ...ROTULO, color: '#3F6212' }}>PREMIAR</div>
      <div style={TITULO}>{titulo}</div>
      {sub && <div style={{ fontSize: 13, color: '#3F6212' }}>{sub}</div>}
    </div>
  )
}

function LineaDeTiempo({ eventos }) {
  return (
    <>
      <h3 style={{ margin: '24px 0 0', fontSize: 18 }}>Línea de tiempo</h3>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column' }}>
        {eventos.length === 0 && <div className="rt-lbl">Sin movimientos todavía.</div>}
        {eventos.map((t, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 20px minmax(0, 1fr) auto', gap: 12, alignItems: 'start', padding: '8px 0' }}>
            <span className="rt-lbl" style={{ paddingTop: 2 }}>{fechaCorta(t.fecha)}</span>
            <span style={{ width: 14, height: 14, borderRadius: '50%', marginTop: 4, background: COLOR_EVENTO[t.tipo] || '#9AA0B4' }} />
            <span><Chip style={{ marginRight: 8 }}>{t.tipo}</Chip>{t.texto}</span>
            <span style={{ textAlign: 'right', fontWeight: 600 }}>
              {t.monto !== null && t.monto !== undefined && <>{usd(t.monto)}<div className="rt-lbl">{bs(t.monto)}</div></>}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

export default function FichaUsuario({ id }) {
  const { datos: u, error, recargar } = useDatos((f) => f.usuario(id), [id])
  const ref = useRef(null)
  const visto = useRef(null)

  // Al abrir una ficha nueva, llevarla a la vista
  useEffect(() => {
    if (u && u.user_id === id && visto.current !== id) {
      visto.current = id
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [u, id])

  if (error) return <ErrorCaja error={error} onReintentar={recargar} />
  if (!u || u.user_id !== id) {
    return (
      <section className="rt-card" aria-busy="true">
        <Esqueleto alto={28} ancho="30%" />
        <div className="rt-prof" style={{ marginTop: 18 }}><Esqueleto alto={360} /><Esqueleto alto={360} /></div>
      </section>
    )
  }

  const vence = u.tickets_abiertos?.[0]?.vence
  return (
    <section className="rt-card" aria-labelledby="ficha" ref={ref} style={{ scrollMarginTop: 24 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 id="ficha" style={{ margin: 0, fontSize: 24 }}>{u.user_id} · {u.nombre}</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {u.habilitado ? <Chip tono="oscuro">Credirecto {u.nivel_nombre}</Chip> : <Chip tono="claro">Nivel — · No habilitado</Chip>}
          <Chip>{u.segmento}</Chip>
          {u.modo_recuperacion && <Chip tono="negativo">Modo recuperación</Chip>}
          {u.quincena?.length > 0 && <Chip>Quincena: {u.quincena.length > 1 ? 'días' : 'día'} {listaY(u.quincena.map(String))}</Chip>}
          {u.habilitado && u.racha && (
            <Chip tono={u.racha.multiplicador ? 'positivo' : 'negativo'}>Racha {u.racha.pagos} de {u.racha.meta}{u.racha.multiplicador ? ' · ×1,5' : ''}</Chip>
          )}
          {u.club && <Chip>Club: {u.club}{u.club_puntos?.puntos_credirecto ? ` · ${u.club_puntos.puntos_credirecto} pts con Credirecto` : ''}</Chip>}
        </div>
      </div>

      <div className="rt-prof" style={{ marginTop: 18 }}>
        <Score u={u} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Cupo u={u} />
            <Progreso u={u} />
          </div>
          <div className="rt-dec">
            <Prestar p={u.decisiones.prestar} />
            <Comunicar c={u.decisiones.comunicar} />
            <Premiar premios={u.decisiones.premiar || []} vence={vence} />
          </div>
          {u.beneficios && <Beneficios b={u.beneficios} />}
          {u.deuda_total > 0 && (
            <div className="rt-lbl" style={{ fontSize: 14 }}>
              Deuda total: <b style={{ color: '#15152B' }}>{usd(u.deuda_total)}</b> · {bs(u.deuda_total)}
              {vence ? ` · próxima cuota vence el ${fechaCorta(vence)}` : ''}
            </div>
          )}
        </div>
      </div>

      <LineaDeTiempo eventos={u.linea_de_tiempo || []} />
    </section>
  )
}
