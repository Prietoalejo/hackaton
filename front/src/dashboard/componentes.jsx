// Componentes compartidos del dashboard Credirecto (plano: borde 1px, radio 12, sin sombras).
import { bs, usd } from '../formato.js'

const cx = (...c) => c.filter(Boolean).join(' ')

/** Tarjeta blanca estándar (.card del diseño). `variante="dk"` = padding 24/26 del bloque principal. */
export function Tarjeta({ as: Tag = 'div', variante, className, children, ...resto }) {
  return <Tag className={cx(variante === 'dk' ? 'rt-dk' : 'rt-card', className)} {...resto}>{children}</Tag>
}

/** Título de la vista con subtítulo gris y acciones a la derecha. */
export function Encabezado({ titulo, subtitulo, children }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>{titulo}</h1>
        {subtitulo && <div className="rt-lbl" style={{ fontSize: 15 }}>{subtitulo}</div>}
      </div>
      {children && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>{children}</div>}
    </div>
  )
}

/** KPI: etiqueta, valor grande y lo que venga debajo (Bs, chip de variación, barra…). */
export function Kpi({ etiqueta, valor, children }) {
  return (
    <div className="rt-card">
      <div className="rt-lbl">{etiqueta}</div>
      <div className="rt-big">{valor}</div>
      {children}
    </div>
  )
}

const TONOS = {
  neutro: { background: '#F3F4F8', color: '#15152B' },
  claro: { background: '#F3F4F8', color: '#4A4A5E' },
  oscuro: { background: '#15152B', color: '#FFFFFF' },
  positivo: { background: '#EEF4E4', color: '#3F6212' },
  negativo: { background: '#FDECEC', color: '#B42318' },
  vacio: { background: 'transparent', color: '#6B6B80' },
}

/** Chip / píldora (.pill del diseño). */
export function Chip({ tono = 'neutro', style, children, ...resto }) {
  return <span className="rt-pill" style={{ ...TONOS[tono], ...style }} {...resto}>{children}</span>
}

/** Botón. variante: primario | borde | suave. grande = 48 px (Configuración). */
export function Boton({ variante = 'primario', grande, chico, className, children, ...resto }) {
  return (
    <button type="button" className={cx('rt-btn', 'rt-btn-' + variante, grande && 'rt-btn-grande', chico && 'rt-btn-chico', className)} {...resto}>
      {children}
    </button>
  )
}

/** Barra de progreso horizontal. pct de 0 a 100. */
export function Barra({ pct, color = '#4D7C0F', fondo = '#EEF0F3', alto = 8, radio, ancho, style }) {
  const r = radio ?? alto / 2
  return (
    <div style={{ height: alto, borderRadius: r, background: fondo, width: ancho, ...style }}>
      <div style={{ height: '100%', borderRadius: r, background: color, width: `${Math.max(0, Math.min(100, pct || 0))}%` }} />
    </div>
  )
}

/** Barra segmentada (tickets, repagos): n bloques, los `llenos` en verde. */
export function Segmentos({ total, llenos, desde = 'inicio' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(total, 1)}, minmax(0, 1fr))`, gap: 4, marginTop: 10 }} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const lleno = desde === 'inicio' ? i < llenos : i >= total - llenos
        return <span key={i} style={{ height: 8, borderRadius: 4, background: lleno ? '#4D7C0F' : '#DADCE4' }} />
      })}
    </div>
  )
}

/** Monto en USD con su equivalente en Bs debajo, en gris. */
export function Monto({ valor, decimales = 2, decBs = 2, tamBs = 13, pesoBs = 400 }) {
  return (
    <>
      {usd(valor, decimales)}
      <div style={{ fontSize: tamBs, color: '#6B6B80', fontWeight: pesoBs }}>{bs(valor, decBs)}</div>
    </>
  )
}

export function Esqueleto({ alto = 14, ancho = '100%', style }) {
  return <div className="rt-sk" style={{ height: alto, width: ancho, ...style }} />
}

export function Spinner({ tam = 40, chico }) {
  return <span className={cx('rt-spin', chico && 'rt-spin-chico')} style={chico ? undefined : { width: tam, height: tam }} aria-hidden="true" />
}

/** Tarjeta de carga genérica con spinner. */
export function Cargando({ texto = 'Cargando…', alto = 240 }) {
  return (
    <div className="rt-card" style={{ height: alto, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }} role="status">
      <Spinner />
      <span style={{ color: '#6B6B80' }}>{texto}</span>
    </div>
  )
}

/** Error legible de la API con botón para reintentar. */
export function ErrorCaja({ error, onReintentar }) {
  const texto = error?.detail || (error?.message?.includes('fetch')
    ? 'No hay conexión con el backend de Credirecto.' : error?.message) || 'No se pudo cargar la información.'
  return (
    <div className="rt-card" role="alert" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', borderColor: '#F3C7C2' }}>
      <span style={{ width: 44, height: 44, borderRadius: 10, background: '#FDECEC', color: '#B42318', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16v.5" /></svg>
      </span>
      <div style={{ flex: '1 1 240px' }}>
        <div style={{ fontWeight: 700 }}>No se pudo cargar esta vista</div>
        <div className="rt-lbl" style={{ fontSize: 14 }}>{texto}{error?.status ? ` (error ${error.status})` : ''}</div>
      </div>
      {onReintentar && <Boton variante="borde" onClick={onReintentar}>Reintentar</Boton>}
    </div>
  )
}

/** Fila "etiqueta ······ valor" con barra debajo (motivos, faltantes, segmentos). */
export function FilaBarra({ etiqueta, valor, pct, color, fondo = '#F3F4F8', alto = 8, tam = 14 }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: tam }}><span>{etiqueta}</span><b>{valor}</b></div>
      <Barra pct={pct} color={color} fondo={fondo} alto={alto} style={{ marginTop: alto > 8 ? 6 : 4 }} />
    </div>
  )
}

/**
 * Tabla simple (.tb del diseño).
 * columnas: [{ titulo, render: (fila) => node, style }]
 */
export function Tabla({ columnas, filas, clave, onFila, estiloFila, minAncho = 560, compacta }) {
  return (
    <table className={cx('rt-tb', compacta && 'rt-tb-compacta')} style={{ minWidth: minAncho }}>
      <thead><tr>{columnas.map((c, i) => <th key={i}>{c.titulo}</th>)}</tr></thead>
      <tbody>
        {filas.map((f, i) => (
          <tr key={clave ? clave(f) : i} className={onFila ? 'rt-clic' : undefined} style={estiloFila?.(f)}
            onClick={onFila ? () => onFila(f) : undefined}
            onKeyDown={onFila ? (e) => { if (e.key === 'Enter') onFila(f) } : undefined}
            tabIndex={onFila ? 0 : undefined}>
            {columnas.map((c, j) => <td key={j} style={c.style}>{c.render(f)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
