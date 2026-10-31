// Iconos SVG copiados de los diseños (disenos/app/*.html).
import { MarcaCredirecto } from '../../marcas.jsx'

const S = ({ w = 24, h, vb = '0 0 24 24', sw = 1.8, stroke = 'currentColor', fill = 'none', children, style }) => (
  <svg width={w} height={h ?? w} viewBox={vb} fill={fill} stroke={stroke} strokeWidth={sw} aria-hidden="true" style={style}>
    {children}
  </svg>
)

export const IcoVolver = () => <S w={22} sw={2}><path d="M15 5l-7 7 7 7" /></S>
export const IcoSoporte = () => (
  <S w={22}><path d="M4 14v-2a8 8 0 0116 0v2" /><rect x="3" y="14" width="4" height="6" rx="2" /><rect x="17" y="14" width="4" height="6" rx="2" /></S>
)
export const IcoCampana = () => <S w={22}><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 004 0" /></S>

const LLAMA = 'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-3 2-4 2-6 1 1 2 2 2 3 1-2 1-5 1-7z'
export const IcoLlama = ({ encendida, w = 22, color }) =>
  encendida
    ? <S w={w} fill={color || '#FF1F5A'} stroke={color || '#FF1F5A'} sw={1.6}><path d={LLAMA} /></S>
    : <S w={w}><path d={LLAMA} /></S>

export const IcoUsuario = ({ w = 26 }) => <S w={w}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></S>

/** Logo Credirecto: dos píldoras entrelazadas */
/** Eslabón de Credirecto (marca oficial); `w` × `h` es la caja, la marca conserva su proporción */
export const LogoCD = ({ w = 30, h = 20, style }) => <MarcaCredirecto alto={h} style={{ width: w, ...style }} />

/** Ticket (carrito) de las tarjetas */
export const IcoTicket = ({ w = 34, h = 29, color = 'currentColor', sw = 1.7 }) => (
  <svg width={w} height={h} viewBox="0 0 24 20" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" aria-hidden="true">
    <path d="M5 9l1.6-4.2A2 2 0 018.5 3.5h7a2 2 0 011.9 1.3L19 9" /><rect x="3" y="9" width="18" height="6" rx="2" />
    <path d="M6 15v2M18 15v2" /><circle cx="7.5" cy="12" r="1" /><circle cx="16.5" cy="12" r="1" /><path d="M10 12.5h4" />
  </svg>
)

export const IcoCheck = ({ w = 12, sw = 3.4, color = 'currentColor', style }) => (
  <S w={w} sw={sw} stroke={color} style={style}><path d="M5 12l5 5 9-10" /></S>
)
export const IcoReloj = ({ w = 28, color = 'currentColor', style }) => (
  <S w={w} stroke={color} style={style}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>
)
export const IcoInfo = ({ w = 20, color = 'currentColor', sw = 2, style }) => (
  <S w={w} stroke={color} sw={sw} style={style}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16v.5" /></S>
)
export const IcoCalendario = ({ w = 22 }) => <S w={w}><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></S>
export const IcoCandado = ({ w = 12 }) => <S w={w} sw={2.4}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></S>
export const IcoFlecha = ({ sube }) => <S w={18} sw={2.4}><path d={sube ? 'M17 7L7 17M7 9v8h8' : 'M7 17L17 7M9 7h8v8'} /></S>

// Wallet
export const IcoEnviar = () => <S w={22}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M12 4v8M9 7l3-3 3 3" /></S>
export const IcoDepositar = () => <S w={22}><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M16 13h2M3 10h4" /></S>
export const IcoMas = () => (
  <S w={22}><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></S>
)
export const IcoRecarga = () => <S w={22}><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M16 13h2" /><path d="M7 3h10" /></S>
export const IcoClub = () => (
  <S w={28}><circle cx="10" cy="8" r="4" /><path d="M3 20c1-4 4-6 7-6" /><circle cx="17" cy="17" r="2.5" /><path d="M19 19l2 2" /></S>
)

// Barra inferior
export const IcoHome = () => <S><path d="M4 11l8-7 8 7v9H4z" /></S>
export const IcoMovimientos = () => <S><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" /></S>
export const IcoMisPagos = () => <S><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></S>
export const IcoMenu = () => <S><path d="M4 7h16M4 12h16M4 17h16" /></S>

/** Icono de cada servicio */
export const IcoServicio = ({ servicio, w = 26 }) => {
  switch (servicio) {
    case 'estacionamiento': return <S w={w}><path d="M5 16V11l2-5h10l2 5v5" /><path d="M3 16h18v3H3z" /></S>
    case 'parquimetro': return <S w={w}><circle cx="12" cy="9" r="5" /><path d="M12 14v7M9 21h6M12 9l2-2" /></S>
    case 'peaje': return <S w={w}><path d="M4 20V8h6v12" /><path d="M10 11h10" /><path d="M4 8l3-4 3 4" /></S>
    case 'luz': return <S w={w}><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></S>
    case 'internet': return <S w={w}><path d="M3 9a14 14 0 0118 0M6 12.5a9 9 0 0112 0M9 16a4 4 0 016 0" /><circle cx="12" cy="19" r="1" /></S>
    case 'telefono': return <S w={w}><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 18h2" /></S>
    case 'seguro': return <S w={w}><path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" /></S>
    default: return <S w={w}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 9h6M9 13h6M9 17h4" /></S>
  }
}
