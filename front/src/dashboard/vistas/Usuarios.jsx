// Vista 05 · Usuarios (GET /usuarios): búsqueda, filtros, paginación y ficha (GET /usuarios/{id}).
// Los filtros viven en la URL (?q=&nivel=&segmento=&pag=) para conservarlos al abrir una ficha.
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { bs, entero, NIVELES, usd } from '../../formato.js'
import { Barra, Boton, Chip, Encabezado, ErrorCaja, Esqueleto, Spinner, Tabla } from '../componentes.jsx'
import { useDatos } from '../datos.jsx'
import { colorScore } from '../util.js'
import FichaUsuario from './FichaUsuario.jsx'

// 10 filas como en el diseño: así la ficha queda justo debajo de la tabla
const POR_PAGINA = 10
const SEGMENTOS = ['Puntual', 'Conductor diario', 'Nuevo', 'En enfriamiento', 'En riesgo', 'Sin crédito']
const FILTROS_NIVEL = [['', 'Todos'], ['0', 'Inicial'], ['1', 'Básico'], ['2', 'Confiable'], ['3', 'Premium'], ['espera', 'En espera']]

const TONO_NIVEL = ['claro', 'neutro', 'positivo', 'oscuro']

export function ChipNivel({ nivel, nombre }) {
  if (nivel === null || nivel === undefined) return <Chip tono="vacio">—</Chip>
  return <Chip tono={TONO_NIVEL[nivel]}>{nombre || NIVELES[nivel]}</Chip>
}

function Atraso({ u }) {
  if (!u.dias_atraso) return <Chip tono="claro">Al día</Chip>
  return <Chip tono="negativo">{u.dias_atraso} {u.dias_atraso === 1 ? 'día' : 'días'}{u.modo_recuperacion ? ' · mora' : ''}</Chip>
}

export default function Usuarios() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const nivel = params.get('nivel') || ''
  const segmento = params.get('segmento') || ''
  const pag = Math.max(0, Number(params.get('pag') || 0))

  // Texto del buscador con espera de 300 ms antes de pedir
  const [texto, setTexto] = useState(q)
  useEffect(() => { setTexto(q) }, [q])
  useEffect(() => {
    if (texto === q) return undefined
    const t = setTimeout(() => cambiar({ q: texto }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto])

  function cambiar(nuevos) {
    const p = new URLSearchParams(params)
    Object.entries(nuevos).forEach(([k, v]) => (v === '' || v === null || v === undefined ? p.delete(k) : p.set(k, v)))
    if (!('pag' in nuevos)) p.delete('pag')
    setParams(p, { replace: true })
  }
  const quitarFiltros = () => { setTexto(''); setParams(new URLSearchParams(), { replace: true }) }

  const { datos: d, cargando, error, recargar } = useDatos(
    (f) => f.usuarios({ q, nivel, segmento, limit: POR_PAGINA, offset: pag * POR_PAGINA }),
    [q, nivel, segmento, pag],
  )

  const abrir = (u) => navigate({ pathname: `/dashboard/usuarios/${u.user_id}`, search: params.toString() })

  const columnas = [
    { titulo: 'ID', render: (u) => <><b>{u.user_id}</b> <span className="rt-lbl">· {u.nombre}</span></> },
    {
      titulo: 'Score',
      render: (u) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <b style={{ width: 26 }}>{u.trust_score}</b>
          <Barra pct={u.trust_score} color={colorScore(u.trust_score)} fondo="#EEF0F5" alto={6} ancho={70} />
        </span>
      ),
    },
    { titulo: 'Nivel', render: (u) => <ChipNivel nivel={u.nivel} nombre={u.nivel_nombre} /> },
    { titulo: 'Segmento', render: (u) => u.segmento },
    {
      titulo: 'Tickets usados / total',
      render: (u) => (u.habilitado
        ? <>{u.tickets_usados} / {u.tickets_total} tickets{u.servicios_total > 0 && <div className="rt-lbl">{u.servicios_usados ?? 0} / {u.servicios_total} servicios</div>}<div className="rt-lbl">hasta {usd(u.monto_max, Number.isInteger(u.monto_max) ? 0 : 2)} c/u</div></>
        : <>—<div className="rt-lbl">No habilitado</div></>),
    },
    { titulo: 'Deuda', render: (u) => <>{usd(u.deuda)}<div className="rt-lbl">{bs(u.deuda)}</div></> },
    { titulo: 'Días de atraso', render: (u) => <Atraso u={u} /> },
  ]

  const total = d?.total ?? 0
  const desde = total ? pag * POR_PAGINA + 1 : 0
  const hasta = d ? pag * POR_PAGINA + d.usuarios.length : 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  return (
    <>
      <Encabezado titulo="Usuarios" subtitulo={`${!d ? 'Cargando usuarios' : q || nivel || segmento ? `${entero(total)} ${total === 1 ? 'coincide' : 'coinciden'} con los filtros` : `${entero(total)} usuarios`} · busca por ID o nombre`} />

      <section className="rt-card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B6B80" strokeWidth="2" style={{ position: 'absolute', left: 16, top: 14 }} aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            <label htmlFor="rt-q" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Buscar usuario</label>
            <input id="rt-q" className="rt-in" placeholder="Buscar: u_0142, María…" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }} role="group" aria-label="Filtrar por nivel">
            {FILTROS_NIVEL.map(([valor, etiqueta]) => {
              const on = nivel === valor
              return (
                <button key={etiqueta} type="button" className="rt-fb" aria-pressed={on} onClick={() => cambiar({ nivel: valor })}
                  style={on ? { background: '#15152B', color: '#FFFFFF' } : { background: '#F3F4F8', color: '#4A4A5E' }}>{etiqueta}</button>
              )
            })}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="rt-lbl">Segmento
            <select value={segmento} onChange={(e) => cambiar({ segmento: e.target.value })}
              style={{ height: 38, border: 0, borderRadius: 6, background: '#F3F4F8', padding: '0 12px', font: "500 14px 'Outfit',sans-serif", color: '#15152B' }}>
              <option value="">Todos</option>
              {SEGMENTOS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>

        {error && <div style={{ marginTop: 14 }}><ErrorCaja error={error} onReintentar={recargar} /></div>}

        {!d && !error && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }} role="status" aria-label="Cargando usuarios">
            {Array.from({ length: 8 }, (_, i) => <Esqueleto key={i} alto={36} />)}
          </div>
        )}

        {d && d.usuarios.length > 0 && (
          <>
            <div style={{ overflowX: 'auto', marginTop: 14, opacity: cargando ? 0.6 : 1, transition: 'opacity .15s' }}>
              <Tabla columnas={columnas} filas={d.usuarios} clave={(u) => u.user_id} onFila={abrir} minAncho={820} compacta
                estiloFila={(u) => (u.user_id === id ? { background: '#F3F7EC' } : undefined)} />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <span className="rt-lbl" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                Mostrando {entero(desde)}–{entero(hasta)} de {entero(total)}{cargando && <Spinner chico />}
              </span>
              {paginas > 1 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Boton variante="suave" chico disabled={pag === 0 || cargando} onClick={() => cambiar({ pag: pag - 1 || '' })}>← Anterior</Boton>
                  <span className="rt-lbl">Página {pag + 1} de {paginas}</span>
                  <Boton variante="suave" chico disabled={pag + 1 >= paginas || cargando} onClick={() => cambiar({ pag: pag + 1 })}>Siguiente →</Boton>
                </span>
              )}
            </div>
          </>
        )}

        {d && d.usuarios.length === 0 && (
          <div style={{ padding: '44px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 60, height: 60, borderRadius: 10, background: '#F3F4F8', color: '#6B6B80', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
            </span>
            <div style={{ fontSize: 19, fontWeight: 700 }}>Ningún usuario coincide</div>
            <div className="rt-lbl" style={{ fontSize: 15 }}>Prueba con otro ID o quita los filtros.</div>
            <button type="button" className="rt-fb" onClick={quitarFiltros} style={{ background: '#15152B', color: '#fff', marginTop: 6 }}>Quitar filtros</button>
          </div>
        )}
      </section>

      {id ? <FichaUsuario id={id} /> : (
        <div className="rt-card" style={{ textAlign: 'center', color: '#6B6B80', padding: '28px 24px' }}>
          Elige un usuario de la tabla para ver su ficha: score, decisiones y línea de tiempo.
        </div>
      )}
    </>
  )
}
