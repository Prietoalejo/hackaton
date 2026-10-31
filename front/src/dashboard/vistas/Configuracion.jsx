// Vista 06 · Configuración (GET/PUT /config, POST /config/simular) + reloj de demo (GET /reloj).
// El formulario se genera desde los grupos que manda el back (numérico o interruptor booleano).
import { useEffect, useMemo, useState } from 'react'
import { fechaCorta, fechaRelojLarga } from '../../formato.js'
import { Boton, ErrorCaja, Esqueleto, Spinner } from '../componentes.jsx'
import { fuente, useDatos, useDemo } from '../datos.jsx'
import { diferencia, valorUnidad } from '../util.js'

const valoresDe = (cfg) => Object.fromEntries(cfg.grupos.flatMap((g) => g.campos.map((c) => [c.clave, c.valor])))

/** Convierte lo escrito en el input al valor que espera el back (o undefined si no es válido). */
const parsear = (campo, crudo) => {
  if (campo.tipo === 'booleano') return !!crudo
  if (crudo === '' || crudo === null || crudo === undefined) return undefined
  const n = Number(String(crudo).replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

function Campo({ campo, valor, cambiado, invalido, onCambio }) {
  if (campo.tipo === 'booleano') {
    return (
      <label className="rt-f">
        <span>{campo.etiqueta}{cambiado && <span style={{ color: '#4D7C0F' }}> ·</span>}</span>
        <input type="checkbox" checked={!!valor} onChange={(e) => onCambio(e.target.checked)} />
      </label>
    )
  }
  return (
    <label className="rt-f">
      <span>{campo.etiqueta}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="number" value={valor ?? ''} step={campo.paso ?? 'any'} onChange={(e) => onCambio(e.target.value)}
          className={cambiado ? 'rt-cambiado' : undefined} aria-invalid={invalido || undefined}
          style={invalido ? { boxShadow: 'inset 0 0 0 1.5px #B42318' } : undefined} />
        <span className="rt-lbl" style={{ width: 34 }}>{campo.unidad}</span>
      </span>
    </label>
  )
}

function Simulacion({ estado }) {
  const cab = { fontSize: 12, color: '#6B6B80', padding: '8px 0' }
  const celda = { padding: '10px 0', borderTop: '1px solid #E8EAEE' }
  return (
    <section style={{ borderRadius: 12, padding: '22px 24px', color: '#15152B', background: '#FFFFFF', border: '1px solid #E3E5EA' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="rt-h2">Simulación · antes y después</h2><span style={{ fontSize: 12, color: '#6B6B80' }}>No se guarda</span>
      </div>
      {estado.fase === 'idle' && (
        <div style={{ padding: '40px 10px', textAlign: 'center', color: '#6B6B80' }}>
          Cambia parámetros y pulsa <b style={{ color: '#3F6212' }}>Simular</b> para ver el impacto en los mismos usuarios.
        </div>
      )}
      {estado.fase === 'cargando' && (
        <div style={{ padding: '40px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, color: '#6B6B80' }} role="status">
          <Spinner tam={36} />Recalculando scores…
        </div>
      )}
      {estado.fase === 'error' && (
        <div style={{ padding: '28px 10px', textAlign: 'center', color: '#B42318', fontWeight: 600 }} role="alert">{estado.error}</div>
      )}
      {estado.fase === 'listo' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', marginTop: 14, fontSize: 15 }}>
          <span style={cab}>Métrica</span><span style={cab}>Antes</span><span style={cab}>Después</span><span style={cab}>Cambio</span>
          {estado.metricas.map((m) => {
            const d = diferencia(m.unidad, m.antes, m.despues, m.mejor_si_sube)
            return (
              <div key={m.metrica} style={{ display: 'contents' }}>
                <span style={celda}>{m.metrica}</span>
                <span style={celda}>{valorUnidad(m.unidad, m.antes)}</span>
                <span style={{ ...celda, fontWeight: 700 }}>{valorUnidad(m.unidad, m.despues)}</span>
                <span style={{ ...celda, fontWeight: 700, color: d.color }}>{d.texto}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Reloj() {
  const { ocupado, avanzar, aviso } = useDemo()
  const { datos: r, error, recargar } = useDatos((f) => f.reloj())
  return (
    <section className="rt-card">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="rt-h2">Reloj de demo</h2>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{r ? fechaRelojLarga(r.hoy) : '—'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {ocupado === 'dia' && <Spinner chico />}
          <Boton variante="suave" disabled={!!ocupado} onClick={() => avanzar(1)}>+1 día</Boton>
          <Boton variante="suave" disabled={!!ocupado} onClick={() => avanzar(7)}>+7 días</Boton>
        </div>
      </div>
      {error ? <div style={{ marginTop: 14 }}><ErrorCaja error={error} onReintentar={recargar} /></div> : (
        <div style={{ marginTop: 14, background: '#F5F6F8', border: '1px solid #E3E5EA', borderRadius: 10, padding: '14px 16px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, color: '#15152B', height: 260, overflowY: 'auto' }} aria-live="polite">
          {!r && <div style={{ color: '#6B6B80' }}>Cargando bitácora…</div>}
          {r?.bitacora.length === 0 && <div style={{ color: '#6B6B80' }}>Sin eventos todavía.</div>}
          {r?.bitacora.map((l, i) => (
            <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid #E8EAEE' }}><span style={{ color: '#3F6212' }}>{fechaCorta(l.fecha)}</span> {l.mensaje}</div>
          ))}
        </div>
      )}
      <div className="rt-lbl" style={{ marginTop: 8 }}>
        {aviso?.tipo === 'error' ? <span style={{ color: '#B42318' }}>{aviso.texto}</span>
          : 'Worker de mora: comisiones aplicadas, créditos congelados, scores recalculados y usuarios habilitados.'}
      </div>
    </section>
  )
}

export default function Configuracion() {
  const { refrescar } = useDemo()
  const { datos: cfg, error, recargar } = useDatos((f) => f.config())
  // Solo guardamos lo que el usuario cambió; así recargar la config no borra sus ediciones.
  const [cambios, setCambios] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState(null)
  const [sim, setSim] = useState({ fase: 'idle' })

  const original = useMemo(() => (cfg ? valoresDe(cfg) : {}), [cfg])
  const campos = useMemo(() => (cfg ? cfg.grupos.flatMap((g) => g.campos) : []), [cfg])

  const actual = (c) => (c.clave in cambios ? cambios[c.clave] : c.valor)
  const valores = {}
  const invalidos = new Set()
  campos.forEach((c) => {
    const v = parsear(c, actual(c))
    if (v === undefined) invalidos.add(c.clave)
    else valores[c.clave] = v
  })
  const cambiados = new Set(campos.filter((c) => !invalidos.has(c.clave) && valores[c.clave] !== original[c.clave]).map((c) => c.clave))
  const sucio = cambiados.size > 0 || invalidos.size > 0
  // Campos cuyo valor (guardado o editado) no es el de fábrica: la config guardada puede venir de una versión anterior
  const distintos = campos.filter((c) => c.defecto !== undefined && valores[c.clave] !== c.defecto)
  const porDefecto = () => {
    setCambios((c) => ({ ...c, ...Object.fromEntries(distintos.map((x) => [x.clave, x.defecto])) }))
    setGuardado(false); setErrorGuardar(null)
  }

  // Aviso del navegador si se intenta salir con cambios sin guardar
  useEffect(() => {
    if (!sucio) return undefined
    const h = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [sucio])

  const cambiar = (clave, v) => { setCambios((c) => ({ ...c, [clave]: v })); setGuardado(false); setErrorGuardar(null) }

  const simular = async () => {
    setSim({ fase: 'cargando' })
    try {
      const r = await fuente.simularConfig(valores)
      setSim({ fase: 'listo', metricas: r.metricas })
    } catch (e) {
      setSim({ fase: 'error', error: e?.detail || e?.message || 'No se pudo simular.' })
    }
  }

  const guardar = async () => {
    setGuardando(true)
    setErrorGuardar(null)
    try {
      await fuente.guardarConfig(valores)
      setCambios({})
      setGuardado(true)
      setSim({ fase: 'idle' })
      refrescar() // el back recalcula a todos: que todas las vistas vuelvan a pedir datos
    } catch (e) {
      setErrorGuardar(e?.detail || e?.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  let subtitulo = '—'
  if (cfg) {
    subtitulo = sucio ? 'Tienes cambios sin guardar'
      : `Configuración activa · guardada el ${fechaCorta(cfg.guardado.fecha)} por ${cfg.guardado.por}`
  }

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Configuración</h1>
          <div className="rt-lbl" style={{ fontSize: 15, color: sucio ? '#B42318' : undefined }}>
            {subtitulo}{invalidos.size > 0 ? ' · revisa los valores marcados en rojo' : ''}
          </div>
          {errorGuardar && <div role="alert" style={{ color: '#B42318', fontSize: 14, fontWeight: 600, marginTop: 4 }}>{errorGuardar}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {sucio && <Boton variante="borde" grande onClick={() => { setCambios({}); setErrorGuardar(null) }} disabled={guardando}>Descartar</Boton>}
          {distintos.length > 0 && (
            <Boton variante="borde" grande onClick={porDefecto} disabled={guardando}
              title={`Distintos de fábrica: ${distintos.map((c) => `${c.etiqueta} (${c.valor} → ${c.defecto})`).join(', ')}`}>
              Valores por defecto ({distintos.length})
            </Boton>
          )}
          <Boton variante="borde" grande onClick={simular} disabled={!cfg || invalidos.size > 0 || sim.fase === 'cargando'}>Simular</Boton>
          <Boton grande onClick={guardar} disabled={!cfg || !sucio || invalidos.size > 0 || guardando}
            style={guardado && !sucio ? { opacity: 1 } : undefined}>
            {guardando ? <><Spinner chico /> Guardando…</> : guardado && !sucio ? 'Guardado ✓' : 'Guardar configuración'}
          </Boton>
        </div>
      </div>

      {error && <ErrorCaja error={error} onReintentar={recargar} />}
      {!cfg && !error && (
        <div className="rt-groups">{Array.from({ length: 6 }, (_, i) => <div key={i} className="rt-card"><Esqueleto alto={18} ancho="50%" /><Esqueleto alto={150} style={{ marginTop: 12 }} /></div>)}</div>
      )}
      {cfg && (
        <div className="rt-groups">
          {cfg.grupos.map((g) => (
            <section key={g.titulo} className="rt-card">
              <h2 style={{ margin: '0 0 6px', fontSize: 17 }}>{g.titulo}</h2>
              {g.campos.map((c) => (
                <Campo key={c.clave} campo={c} valor={actual(c)} cambiado={cambiados.has(c.clave)} invalido={invalidos.has(c.clave)}
                  onCambio={(v) => cambiar(c.clave, v)} />
              ))}
            </section>
          ))}
        </div>
      )}

      <div className="rt-bot">
        <Simulacion estado={sim} />
        <Reloj />
      </div>
    </>
  )
}
