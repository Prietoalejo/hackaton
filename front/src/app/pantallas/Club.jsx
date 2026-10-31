// Pantalla Club PagoDirecto: carrusel de rutas (deslizar a la izquierda) con su mapa y progreso, y abajo
// las pestañas Hitos / Beneficios / Puntos. Credirecto no tiene puntos propios: sus cuotas suman a esta
// misma ruta, la racha es la del Club y cada ruta permite un nivel de Credirecto (`club_puntos.rutas`).
import { useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bs, entero, NIVELES } from '../../formato.js'
import { useApp } from '../contexto.js'
import { proximoTicket } from '../util.js'
import { Avatar, Encabezado, Pantalla, Tarjeta } from '../componentes/Base.jsx'
import { IcoCandado, IcoCheck, IcoLlama, LogoCD } from '../componentes/Iconos.jsx'
import { BeneficiosRuta, RachaSemana } from './Racha.jsx'

const ROSA = '#FF1F5A'

/**
 * Paradas de cada ruta (lat, lon) y su color. Es contenido de presentación: el Club no publica el
 * recorrido exacto, así que son pueblos reales de cada región en el orden del viaje.
 */
const RECORRIDOS = [
  { color: '#F0506E', paradas: [['Maiquetía', 10.60, -66.98], ['Caracas', 10.49, -66.88], ['Colonia Tovar', 10.41, -67.29], ['La Victoria', 10.23, -67.33], ['Maracay', 10.25, -67.60], ['Choroní', 10.49, -67.61]] },
  { color: '#F0506E', paradas: [['Tucacas', 10.79, -68.32], ['Chichiriviche', 10.93, -68.27], ['Coro', 11.40, -69.67], ['Médanos', 11.50, -69.62], ['Adícora', 11.94, -69.80], ['Punto Fijo', 11.70, -70.21]] },
  { color: '#F5A524', paradas: [['Barquisimeto', 10.07, -69.32], ['Sanare', 9.75, -69.65], ['Biscucuy', 9.36, -69.98], ['Boconó', 9.25, -70.27], ['Guanare', 9.04, -69.74], ['Acarigua', 9.55, -69.20]] },
  { color: '#22A06B', paradas: [['Cumaná', 10.45, -64.17], ['Carúpano', 10.67, -63.25], ['Río Caribe', 10.70, -63.10], ['Playa Medina', 10.73, -62.95], ['Irapa', 10.57, -62.58], ['Macuro', 10.65, -61.94]] },
  { color: '#D9822B', paradas: [['San Juan de los Morros', 9.91, -67.35], ['Calabozo', 8.92, -67.43], ['San Fernando', 7.89, -67.47], ['Achaguas', 7.78, -68.22], ['Mantecal', 7.55, -69.15], ['Barinas', 8.62, -70.21]] },
  { color: '#3A7BD5', paradas: [['Mérida', 8.59, -71.14], ['Jají', 8.58, -71.34], ['Mucuchíes', 8.75, -70.92], ['Apartaderos', 8.80, -70.85], ['Pico El Águila', 8.84, -70.83], ['Timotes', 8.98, -70.74]] },
  { color: '#8E5CD9', paradas: [['Maracaibo', 10.65, -71.64], ['Puente Urdaneta', 10.58, -71.56], ['Santa Rita', 10.54, -71.51], ['Cabimas', 10.40, -71.45], ['Ciudad Ojeda', 10.20, -71.31], ['Lagunillas', 10.13, -71.26]] },
]

// Contorno simplificado de Venezuela y del Lago de Maracaibo (lon, lat)
const TIERRA = [[-73.4, 9.0], [-72.9, 10.5], [-72.1, 11.2], [-71.8, 11.7], [-71.3, 11.8], [-70.6, 11.3], [-70.2, 11.7], [-70.0, 12.2], [-69.8, 11.9],
  [-69.6, 11.5], [-68.8, 11.4], [-68.3, 10.9], [-68.0, 10.5], [-67.0, 10.6], [-66.0, 10.6], [-65.0, 10.1], [-64.2, 10.5], [-63.5, 10.7],
  [-62.3, 10.7], [-61.9, 10.7], [-62.3, 10.1], [-61.6, 9.9], [-60.8, 9.4], [-60.0, 8.5], [-60.6, 7.0], [-61.1, 6.2], [-61.5, 5.2], [-60.7, 4.5],
  [-62.8, 4.0], [-63.9, 4.0], [-64.6, 4.1], [-64.0, 2.5], [-63.4, 2.2], [-64.0, 1.4], [-65.4, 0.9], [-66.9, 1.2], [-67.3, 2.4], [-67.8, 2.8],
  [-67.5, 3.8], [-67.8, 4.5], [-67.6, 6.2], [-69.4, 6.1], [-70.1, 6.9], [-70.7, 7.1], [-72.0, 7.0], [-72.5, 7.6], [-72.4, 8.4], [-72.8, 9.1]]
const LAGO = [[-71.65, 10.6], [-71.3, 10.4], [-71.0, 9.6], [-71.4, 9.1], [-71.9, 9.3], [-71.9, 10.2]]
const xy = ([lon, lat]) => [(lon + 73.5) * 30, (12.6 - lat) * 30]
const puntos = (lista) => lista.map((p) => xy(p).map((v) => v.toFixed(1)).join(',')).join(' ')

export default function Club() {
  const { ficha } = useApp()
  const club = ficha.club_puntos || {}
  const rutas = club.rutas || []
  const actual = Math.max(0, rutas.findIndex((r) => r.estado === 'actual'))
  const [vista, setVista] = useState(actual)
  const [pestana, setPestana] = useState('hitos')
  const carrusel = useRef(null)

  // Abre en la ruta en la que va el usuario
  useLayoutEffect(() => {
    const el = carrusel.current
    if (el) el.scrollLeft = actual * el.clientWidth
  }, [actual])

  const alDeslizar = () => {
    const el = carrusel.current
    if (el) setVista(Math.round(el.scrollLeft / el.clientWidth))
  }
  const irA = (i) => carrusel.current?.scrollTo({ left: i * carrusel.current.clientWidth, behavior: 'smooth' })
  const color = RECORRIDOS[vista]?.color || ROSA

  return (
    <Pantalla>
      <Encabezado titulo="Club PagoDirecto" />

      {!rutas.length ? (
        <div style={{ padding: '20px 16px 0' }}>
          <Tarjeta style={{ padding: 22, textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{ficha.club || 'Nivel Turista · Ruta Colonial'}</div>
            <div className="cd-mut" style={{ marginTop: 6 }}>Aún no tenemos el detalle de tus rutas.</div>
          </Tarjeta>
        </div>
      ) : (
        <>
          <div ref={carrusel} className="cd-scroll" onScroll={alDeslizar} aria-label="Rutas del Club"
            style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', marginTop: 20 }}>
            {rutas.map((r, i) => (
              <div key={r.ruta} style={{ flex: '0 0 100%', scrollSnapAlign: 'center', padding: '0 16px', boxSizing: 'border-box' }}>
                <TarjetaRuta r={r} recorrido={RECORRIDOS[i] || RECORRIDOS[0]} club={club} ficha={ficha}
                  siguiente={rutas[i + 1]} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }} role="tablist" aria-label="Elegir ruta">
            {rutas.map((r, i) => (
              <button key={r.ruta} role="tab" aria-selected={i === vista} aria-label={`${r.nivel_nombre} · ${r.ruta}`} onClick={() => irA(i)}
                className="cd-dot" style={{ width: i === vista ? 22 : 8, background: i === vista ? color : '#D5D8E1' }} />
            ))}
          </div>
        </>
      )}

      <div style={{ padding: '22px 16px 0' }}>
        <div role="tablist" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: '#fff', borderRadius: 999, padding: 6, boxShadow: '0 4px 16px rgba(21,21,43,.05)' }}>
          {[['hitos', 'Hitos'], ['beneficios', 'Beneficios'], ['puntos', 'Puntos']].map(([k, t]) => (
            <button key={k} role="tab" aria-selected={pestana === k} onClick={() => setPestana(k)}
              style={{ height: 46, border: 0, borderRadius: 999, font: "600 16px 'Outfit',sans-serif", cursor: 'pointer', background: pestana === k ? ROSA : 'transparent', color: pestana === k ? '#fff' : '#5D5D70' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {pestana === 'hitos' && <Hitos />}
      {pestana === 'beneficios' && (ficha.beneficios
        ? <><BeneficiosRuta b={ficha.beneficios} /><NotaBeneficios /></>
        : <Vacio texto="Tus beneficios aparecen cuando empiezas a pagar en PagoDirecto." />)}
      {pestana === 'puntos' && <Puntos club={club} />}
    </Pantalla>
  )
}

/** Tarjeta de una ruta: nivel, estado, walletback, mapa del recorrido y progreso */
function TarjetaRuta({ r, recorrido, club, ficha, siguiente }) {
  const bloqueada = r.estado === 'bloqueada'
  const completada = r.estado === 'completada'
  const n = recorrido.paradas.length
  // Paradas alcanzadas: todas si está completada; en la actual, según los puntos hacia la siguiente ruta
  const tramo = siguiente ? siguiente.desde - r.desde : 0
  const avance = siguiente ? Math.max(0, Math.min(1, ((club.puntos ?? r.desde) - r.desde) / tramo)) : 1
  const alcanzadas = completada ? n : bloqueada ? 0 : Math.min(n - 1, 1 + Math.floor(avance * (n - 1)))
  const wb = ficha.beneficios?.beneficios?.find((b) => b.tipo === 'walletback')
  const racha = ficha.racha
  const chip = { display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 999, background: '#F3F4F8', fontWeight: 600, fontSize: 15 }

  return (
    <Tarjeta style={{ padding: '22px 22px 20px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 17 }}>Nivel {r.nivel_nombre}</div>
          <div style={{ fontWeight: 600, fontSize: 23, color: recorrido.color, marginTop: 4 }}>{r.ruta}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {bloqueada && <span style={chip}><IcoCandado w={14} />Bloqueada</span>}
            {completada && <span style={{ ...chip, background: '#F1FBD2', color: '#3B6B00' }}><IcoCheck w={12} />Completada</span>}
            {!bloqueada && !completada && (
              <>
                <span style={chip}>{recorrido.paradas[alcanzadas - 1][0]}</span>
                {racha && (
                  <span style={chip}>
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ROSA }}>
                      <IcoLlama encendida={racha.pagos > 0} w={15} />
                    </span>
                    Racha {racha.pagos}/{racha.meta}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <Avatar tamano={84} />
      </div>

      {!bloqueada && !completada && wb ? (
        <>
          <div style={{ fontSize: 40, fontWeight: 700, marginTop: 18, letterSpacing: '-.01em' }}>{bs(wb.recibido_mes ?? 0)}</div>
          <span style={{ ...chip, height: 32, fontSize: 14 }}>Walletback recibido · {String(wb.personal).replace('.', ',')} %</span>
          {wb.estimado_mes > 0 && <div className="cd-mut" style={{ fontSize: 13, marginTop: 6 }}>Estimado este mes: {bs(wb.estimado_mes)}</div>}
        </>
      ) : (
        <>
          <div style={{ fontSize: 40, fontWeight: 700, marginTop: 18, letterSpacing: '-.01em', color: bloqueada ? '#9A9AAD' : '#15152B' }}>
            {String(r.walletback_pct).replace('.', ',')} %
          </div>
          <span style={{ ...chip, height: 32, fontSize: 14 }}>
            Walletback de la ruta{r.tickets_gratis ? ` · ${r.tickets_gratis} ${r.tickets_gratis === 1 ? 'ticket gratis' : 'tickets gratis'} al mes` : ''}
          </span>
        </>
      )}

      <Mapa recorrido={recorrido} alcanzadas={alcanzadas} bloqueada={bloqueada} actual={!bloqueada && !completada} />

      <Pasos n={n} alcanzadas={alcanzadas} color={recorrido.color} bloqueada={bloqueada} />

      <div style={{ marginTop: 16, fontWeight: 600, fontSize: 17, color: recorrido.color }}>
        {bloqueada ? `${entero(r.desde)} pts para desbloquear`
          : completada ? `Ruta completada · +${entero(club.bono_ruta ?? 500)} pts`
            : siguiente ? `${entero((club.puntos ?? r.desde) - r.desde)} / ${entero(tramo)} pts` : `${entero(club.puntos ?? 0)} pts`}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <span style={{ ...chip, height: 34, fontSize: 14 }}>
          {bloqueada ? 'Todavía no la recorres' : completada ? 'Ya la recorriste'
            : alcanzadas < n ? `Progreso a ${recorrido.paradas[alcanzadas][0]}` : 'Llegaste al final de la ruta'}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#5D5D70' }}>
          <LogoCD w={22} h={15} color="#8CC20B" sw={3.4} />Permite Credirecto {NIVELES[r.credirecto_nivel]}
        </span>
      </div>
    </Tarjeta>
  )
}

/** Mapa del recorrido: contorno del país, la línea de la ruta y sus paradas */
function Mapa({ recorrido, alcanzadas, bloqueada, actual }) {
  const ANCHO = 360, ALTO = 190
  const pts = recorrido.paradas.map(([, lat, lon]) => xy([lon, lat]))
  // Encuadre alrededor de las paradas con la proporción del mapa
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
  let w = Math.max(Math.max(...xs) - Math.min(...xs), 30) * 1.7
  let h = Math.max(Math.max(...ys) - Math.min(...ys), 20) * 1.9
  if (w / h < ANCHO / ALTO) w = h * (ANCHO / ALTO); else h = w / (ANCHO / ALTO)
  const k = ANCHO / w // px por unidad del mapa
  const vb = `${(cx - w / 2).toFixed(1)} ${(cy - h / 2).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`

  return (
    <div style={{ position: 'relative', margin: '18px -22px 0', height: ALTO }}>
      <svg width="100%" height={ALTO} viewBox={vb} preserveAspectRatio="xMidYMid slice" aria-hidden="true"
        style={{ display: 'block', opacity: bloqueada ? 0.45 : 1 }}>
        <rect x={cx - w} y={cy - h} width={w * 2} height={h * 2} fill="#fff" />
        <polygon points={puntos(TIERRA)} fill="#E6E8EE" stroke="#fff" strokeWidth={2 / k} />
        <polygon points={puntos(LAGO)} fill="#fff" />
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth={9 / k} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={bloqueada ? '#C9CCD6' : '#D5D8E1'} strokeWidth={3 / k} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map(([x, y], i) => {
          const llegada = i < alcanzadas
          const aqui = actual && i === alcanzadas - 1
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={7 / k} fill="#fff" stroke={llegada ? recorrido.color : '#9A9AAD'} strokeWidth={3 / k} />
              {aqui && <circle cx={x} cy={y} r={3 / k} fill="#15152B" />}
              {!bloqueada && (
                <text x={x + 11 / k} y={y + 5 / k} fontSize={14 / k} fontWeight={aqui || i === recorrido.paradas.length - 1 ? 700 : 500}
                  fill={i === recorrido.paradas.length - 1 && !llegada ? recorrido.color : '#15152B'}
                  style={{ fontFamily: 'Outfit, sans-serif', paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3 / k }}>
                  {recorrido.paradas[i][0]}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {bloqueada && (
        <span style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 66, height: 66, borderRadius: '50%', background: '#fff', boxShadow: '0 6px 18px rgba(21,21,43,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IcoCandado w={24} />
        </span>
      )}
    </div>
  )
}

/** Barra de paradas: píldora oscura con un círculo por parada (gris si la ruta está bloqueada) */
function Pasos({ n, alcanzadas, color, bloqueada }) {
  return (
    <div style={{ position: 'relative', marginTop: -26, height: 54, borderRadius: 999, background: bloqueada ? '#A3A3A8' : '#15152B', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
      <span style={{ position: 'absolute', left: 30, right: 30, top: '50%', height: 4, marginTop: -2, background: '#fff' }} />
      {Array.from({ length: n }, (_, i) => {
        const llegada = i < alcanzadas
        return (
          <span key={i} style={{ position: 'relative', width: 32, height: 32, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: llegada ? `0 0 0 3px ${color}` : 'none' }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', border: `3px solid ${llegada ? color : '#A9ADB8'}`, background: llegada && i === alcanzadas - 1 ? '#15152B' : '#fff' }} />
          </span>
        )
      })}
    </div>
  )
}

/** Hitos: misiones de una sola vez del Club y lo que suma Credirecto a la ruta */
function Hitos() {
  const { ficha, hoy, avisar } = useApp()
  const navegar = useNavigate()
  const vehiculo = ficha.checklist?.find((c) => c.requisito === 'vehiculo')?.ok
  const misiones = [
    { clave: 'llave', titulo: 'Llave de acceso', texto: 'Activa, protege tu cuenta y gana puntos del Club.', pts: 250, hecha: false, icono: <IcoLlave />,
      accion: () => avisar('La llave de acceso se activa desde Ajustes en PagoDirecto.') },
    { clave: 'vehiculo', titulo: 'Verifica tu vehículo', texto: 'Verifica tu vehículo y gana puntos del Club.', pts: 250, hecha: !!vehiculo, icono: <IcoCarro />,
      accion: () => avisar('La verificación del vehículo se hace desde Mis vehículos en PagoDirecto.') },
  ]
  const pendientes = misiones.filter((m) => !m.hecha).reduce((s, m) => s + m.pts, 0)
  const club = ficha.club_puntos || { puntos_por_pago: 100, multiplicador: 1.5 }
  const cuota = ficha.habilitado ? proximoTicket(ficha) : null

  return (
    <div style={{ padding: '22px 16px 0' }}>
      <RachaSemana ficha={ficha} hoy={hoy} />
      <div style={{ padding: '0 4px', marginTop: 22 }}>
        <div style={{ fontWeight: 700, fontSize: 20 }}>Hitos activos</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 2, fontSize: 15 }}>
          <span className="cd-mut">Complétalos y suma puntos a tu ruta</span>
          {pendientes > 0 && <b style={{ color: ROSA, whiteSpace: 'nowrap' }}>+{entero(pendientes)} pts</b>}
        </div>
      </div>
      {misiones.map((m) => (
        <Mision key={m.clave} icono={m.icono} titulo={m.titulo} texto={m.texto} derecha={`+${m.pts} pts`}
          boton={m.hecha ? null : 'Completar'} hecha={m.hecha} onClick={m.accion} />
      ))}
      <div style={{ textAlign: 'center', fontWeight: 600, fontSize: 14, margin: '14px 10px 0' }}>
        Las misiones son de una sola vez. Los puntos van directo a tu ruta
      </div>

      <div style={{ fontWeight: 700, fontSize: 18, margin: '22px 4px 0' }}>Con Credirecto</div>
      <div className="cd-mut" style={{ fontSize: 14, margin: '2px 4px 0' }}>Tus cuotas suman a esta misma ruta y a tu racha</div>
      {ficha.habilitado ? (
        <>
          <Mision icono={<LogoCD w={30} h={20} color="#8CC20B" sw={3.4} />} oscuro
            titulo="Paga tu cuota a tiempo" texto={`+${club.puntos_por_pago} pts por cuota; ×${String(club.multiplicador).replace('.', ',')} si pagas antes.`}
            derecha={`+${Math.round(club.puntos_por_pago * club.multiplicador)} pts`}
            boton={cuota ? 'Pagar' : 'Usar ticket'} onClick={() => navegar(cuota ? '/app/detalle' : '/app/pago')} />
        </>
      ) : (
        <Mision icono={<LogoCD w={30} h={20} color="#8CC20B" sw={3.4} />} oscuro titulo="Activa Credirecto"
          texto="Cuando lo tengas, cada cuota pagada a tiempo suma a tu ruta." boton="Ver requisitos" onClick={() => navegar('/app')} />
      )}

      <Tarjeta style={{ marginTop: 14, padding: 16, display: 'flex', gap: 14, alignItems: 'center', opacity: 0.55 }}>
        <span style={{ width: 52, height: 52, borderRadius: 16, background: '#EEF0F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><IcoCandado w={20} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Próxima misión</div>
          <div className="cd-mut" style={{ fontSize: 13 }}>Se desbloquea al completar las anteriores</div>
        </div>
        <span className="cd-mut" style={{ fontSize: 13 }}>Próximamente</span>
      </Tarjeta>
    </div>
  )
}

function Mision({ icono, titulo, texto, derecha, boton, hecha, onClick, oscuro }) {
  return (
    <Tarjeta style={{ marginTop: 14, padding: 16, display: 'flex', gap: 14, alignItems: 'center' }}>
      <span style={{ width: 56, height: 56, borderRadius: 16, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: oscuro ? '#15152B' : '#FFE8EF', color: ROSA }}>{icono}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{titulo}</div>
        <div className="cd-mut" style={{ fontSize: 13, lineHeight: 1.3, marginTop: 2 }}>{texto}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flex: 'none' }}>
        {derecha && <b style={{ fontSize: 15, whiteSpace: 'nowrap' }}>{derecha}</b>}
        {hecha ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#3B6B00', background: '#F1FBD2', padding: '6px 12px', borderRadius: 999 }}><IcoCheck w={11} />Hecho</span>
        ) : boton && (
          <button onClick={onClick} style={{ height: 34, border: 0, borderRadius: 999, padding: '0 14px', background: ROSA, color: '#fff', font: "700 14px 'Outfit',sans-serif", cursor: 'pointer' }}>{boton}</button>
        )}
      </div>
    </Tarjeta>
  )
}

const NotaBeneficios = () => (
  <div className="cd-mut" style={{ fontSize: 13, textAlign: 'center', margin: '12px 24px 0', lineHeight: 1.4 }}>
    Tu beneficio cambia según cómo pagas: entre 50 % y 150 % del de tu ruta. Premia pagar a tiempo y antes, nunca usar más crédito.
  </div>
)

/** Puntos: total, de dónde vienen y cómo sumar más */
function Puntos({ club }) {
  const sig = club.siguiente
  const d = club.desglose
  const fila = (txt, valor, color) => (
    <div className="cd-row" style={{ marginTop: 12, fontSize: 15 }}><span>{txt}</span><b style={{ color }}>{valor}</b></div>
  )
  const pct = sig ? Math.max(0, Math.min(100, (club.puntos / sig.desde) * 100)) : 100
  return (
    <div style={{ padding: '22px 16px 0' }}>
      <Tarjeta style={{ padding: 18 }}>
        <div className="cd-mut" style={{ fontSize: 14 }}>Tus puntos del Club</div>
        <div style={{ fontSize: 38, fontWeight: 700 }}>{entero(club.puntos ?? 0)} pts</div>
        <div style={{ fontSize: 14 }}>{club.texto || '—'}</div>
        {sig && (
          <>
            <div style={{ height: 10, borderRadius: 5, background: '#EEF0F5', marginTop: 12 }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 5, background: ROSA }} />
            </div>
            <div className="cd-mut" style={{ fontSize: 13, marginTop: 6 }}>Faltan {entero(sig.faltan)} pts para {sig.nivel_nombre} · {sig.ruta}</div>
          </>
        )}
        {d && (
          <div style={{ borderTop: '1px solid #F0F1F5', marginTop: 14, paddingTop: 2 }}>
            {fila('Pagos de servicios', `${entero(d.servicios)} pts`)}
            {fila('Cuotas de Credirecto', `${entero(d.credirecto)} pts`, '#3B6B00')}
            {fila('Rutas completadas', `${entero(d.rutas)} pts`)}
          </div>
        )}
      </Tarjeta>
      <Tarjeta style={{ padding: 18, marginTop: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>Cómo sumar</div>
        {fila('Pago de un servicio', `+${club.puntos_por_pago ?? 100} pts`)}
        {fila('Cuota de Credirecto a tiempo', `+${club.puntos_por_pago ?? 100} pts`)}
        {fila('Antes del vencimiento o con la racha completa', `×${String(club.multiplicador ?? 1.5).replace('.', ',')}`)}
        {fila('Completar una ruta', `+${entero(club.bono_ruta ?? 500)} pts`)}
        <div className="cd-mut" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.4 }}>Las cuotas de menos de $0,50 no suman puntos ni racha.</div>
      </Tarjeta>
    </div>
  )
}

const Vacio = ({ texto }) => (
  <div style={{ padding: '22px 16px 0' }}><Tarjeta style={{ padding: 20, textAlign: 'center' }}><span className="cd-mut">{texto}</span></Tarjeta></div>
)

const IcoLlave = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="8" cy="8" r="4" /><path d="M3 21c.5-3.5 2.5-6 5-6" /><path d="M14 13l7 7M17 16l2-2M15 18l1.5-1.5" />
  </svg>
)
const IcoCarro = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M5 16V11l2-5h10l2 5v5" /><path d="M3 16h18v3H3z" /><circle cx="7.5" cy="13" r=".8" /><circle cx="16.5" cy="13" r=".8" />
  </svg>
)
