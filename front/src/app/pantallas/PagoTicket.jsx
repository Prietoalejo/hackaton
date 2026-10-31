// Pantalla 04 · Pago con ticket. El usuario elige servicio y comercio e ingresa el monto en Bs.
// Si el monto supera el máximo por ticket se muestra la variante "supera el máximo" (ticket + saldo).
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { bs, fechaCorta } from '../../formato.js'
import { useApp } from '../contexto.js'
import { datos, mensajeError } from '../datos.js'
import { bsAUsd, cupoServicios, esDiaDeCobro, esFactura, NOMBRE_SERVICIO, parseBs, sumarDias, SERVICIOS_NIVEL } from '../util.js'
import { BotonPildora, Encabezado, MensajeError, Pantalla, Tarjeta } from '../componentes/Base.jsx'
import { IcoInfo, IcoServicio, LogoCD } from '../componentes/Iconos.jsx'

const COMERCIOS = {
  estacionamiento: ['C.C. Sambil Chacao', 'C.C. El Tolón', 'C.C. Líder', 'C.C. San Ignacio'],
  parquimetro: ['Parquímetro Chacao', 'Parquímetro Baruta'],
  peaje: ['Peaje Tazón', 'Peaje Caracas–La Guaira'],
  luz: ['Corpoelec'],
  internet: ['CANTV ABA', 'Inter', 'NetUno'],
  telefono: ['Movistar', 'Digitel', 'Movilnet'],
  seguro: ['Seguros Caracas', 'Mercantil Seguros'],
}

/** Código corto estable a partir de un texto (decorativo, como el "Ticket ID" del diseño) */
const codigoDe = (txt) => {
  let h = 2166136261
  for (const c of txt) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0).toString(16).toUpperCase().padStart(7, '0').slice(0, 7)
}

export default function PagoTicket() {
  const { ficha, hoy, recargarFicha, avisar } = useApp()
  const navegar = useNavigate()
  const [params] = useSearchParams()
  const inicial = params.get('servicio') && NOMBRE_SERVICIO[params.get('servicio')] ? params.get('servicio') : 'estacionamiento'
  const [servicio, setServicio] = useState(inicial)
  const [comercio, setComercio] = useState(COMERCIOS[inicial][0])
  const [texto, setTexto] = useState('1.520,00')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  // Movilidad gasta un ticket; luz, internet, teléfono y seguros gastan un pago de servicios
  const { monto_max: maxUsd, servicios } = ficha.tickets
  const factura = esFactura(servicio)
  const { total, usados, disponibles } = factura ? cupoServicios(ficha) : ficha.tickets
  const unidad = factura ? 'pago de servicios' : 'ticket'
  const unidades = factura ? 'pagos de servicios' : 'tickets'
  const montoBs = parseBs(texto)
  const montoUsd = bsAUsd(montoBs)
  const excede = montoUsd > maxUsd + 1e-9
  const cubre = Math.min(montoUsd, maxUsd)
  const conSaldo = Math.max(0, montoUsd - maxUsd)
  const plazo = ficha.decisiones?.prestar?.plazo_dias
  const vence = hoy && plazo ? sumarDias(hoy, plazo) : null
  const cubierto = servicios.includes(servicio)
  const nombre = NOMBRE_SERVICIO[servicio].toLowerCase()

  const elegirServicio = (s) => { setServicio(s); setComercio(COMERCIOS[s][0]); setError(null) }

  const pagar = async () => {
    if (!(montoBs > 0)) { setError('Ingresa el monto a pagar.'); return }
    setCargando(true); setError(null)
    try {
      const r = await datos.crearTicket({ user_id: ficha.user_id, servicio, monto: montoUsd, comercio: comercio.trim() })
      recargarFicha()
      if (r.ticket?.oferta_quincena) {
        navegar(`/app/quincena/${r.ticket.id}`, { state: { ticket: r.ticket } })
      } else {
        avisar(`Listo: pagaste ${bs(r.cubierto_por_credito + r.pagado_con_saldo)} con tu ${unidad}. Tu cuota vence el ${fechaCorta(r.ticket.vence)}.`)
        navegar('/app/detalle')
      }
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }

  // Estado visual de cada ticket del diseño: usados, el que se usa ahora y los disponibles
  const fichas = Array.from({ length: total }, (_, i) =>
    i < usados ? 'usado' : i === usados && disponibles > 0 ? 'ahora' : 'disponible')

  return (
    <Pantalla padding="22px 0 0" pie={
      <>
        <BotonPildora cargando={cargando} onClick={pagar}>{factura ? 'Pagar con Credirecto' : 'Pagar con ticket'}</BotonPildora>
        <BotonPildora variante="secundario" onClick={() => avisar('El pago con saldo es el flujo normal de PagoDirecto; en esta demo solo probamos Credirecto.')}>Pagar con mi saldo</BotonPildora>
      </>
    }>
      <Encabezado titulo={`Pago de ${nombre}`} />

      {/* Selector de servicio (solo para pruebas; el diseño llega con el servicio ya elegido) */}
      <div className="cd-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '16px 16px 2px' }}>
        {SERVICIOS_NIVEL.map((s) => {
          const activo = s.clave === servicio
          const ok = servicios.includes(s.clave)
          return (
            <button key={s.clave} onClick={() => elegirServicio(s.clave)}
              style={{ flex: 'none', height: 36, padding: '0 12px', borderRadius: 999, border: 0, display: 'flex', alignItems: 'center', gap: 6, font: "600 13px 'Outfit',sans-serif",
                background: activo ? '#15152B' : '#fff', color: activo ? '#fff' : ok ? '#15152B' : '#9A9AAE', boxShadow: '0 2px 10px rgba(21,21,43,.05)' }}>
              <IcoServicio servicio={s.clave} w={16} />{s.nombre}
            </button>
          )
        })}
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        <Tarjeta style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ width: 50, height: 50, borderRadius: 16, background: '#FFE8EF', color: '#E0124F', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><IcoServicio servicio={servicio} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input list="cd-comercios" value={comercio} onChange={(e) => setComercio(e.target.value)} aria-label="Comercio"
                style={{ width: '100%', border: 0, borderBottom: '1px dashed #D5D8E1', padding: '0 0 2px', font: "700 17px 'Outfit',sans-serif", color: '#15152B', outline: 'none', background: 'transparent' }} />
              <datalist id="cd-comercios">{COMERCIOS[servicio].map((c) => <option key={c} value={c} />)}</datalist>
              <div className="cd-mut" style={{ fontSize: 13 }}>
                Ticket ID: {codigoDe(comercio + servicio)}{servicio === 'estacionamiento' && montoUsd > 0 ? ` · ${tiempo(montoUsd)}` : ''}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <div className="cd-mut" style={{ fontSize: 14 }}>Monto {servicio === 'estacionamiento' ? 'del estacionamiento' : 'a pagar'}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 38, fontWeight: 700 }}>Bs</span>
              <input inputMode="decimal" value={texto} onChange={(e) => { setTexto(e.target.value); setError(null) }} aria-label="Monto en bolívares"
                onBlur={() => montoBs > 0 && setTexto(montoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                style={{ width: `${Math.max(4, texto.length) * 0.62}em`, maxWidth: 230, border: 0, outline: 'none', background: 'transparent', font: "700 38px 'Outfit',sans-serif", color: '#15152B', padding: 0, textAlign: 'left' }} />
            </div>
          </div>
        </Tarjeta>
      </div>

      <div style={{ padding: '12px 16px 0' }}>
        <Tarjeta style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><LogoCD w={26} h={18} color="#8CC20B" /><span style={{ fontSize: 20, fontWeight: 700 }}>Usar 1 {unidad}</span></div>
          <div style={{ fontSize: 15, marginTop: 4 }}>
            {disponibles > 0
              ? disponibles === 1 ? `Este pago usa tu ${unidad} disponible.` : `Este pago usa 1 de tus ${disponibles} ${unidades} disponibles.`
              : total > 0
                ? `Tus ${unidades} están en uso. Paga una cuota y vuelven a estar disponibles.`
                : `Tu nivel ${ficha.nivel_nombre} todavía no incluye pagos de servicios. Llegan en Credirecto Confiable.`}
          </div>

          {total > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(total, 5)}, minmax(0, 1fr))`, gap: total >= 5 ? 6 : 8, marginTop: 14 }}>
              {fichas.map((e, i) => <FichaTicket key={i} n={i + 1} estado={e} rotulo={factura ? 'SERVICIO' : 'TICKET'} />)}
            </div>
          )}

          {!cubierto && (total > 0 || !factura) && !error && (
            <div style={{ fontSize: 13, marginTop: 12, color: '#8A4B00', background: '#FFF1D6', borderRadius: 12, padding: '8px 10px' }}>
              Tu nivel {ficha.nivel_nombre} todavía no cubre {nombre}.
            </div>
          )}

          {!excede ? (
            <>
              <div className="cd-row" style={{ marginTop: 16 }}><span>Lo cubre tu {unidad}</span><b style={{ fontSize: 17 }}>{bs(cubre)}</b></div>
              <div className="cd-mut" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.4 }}>
                Tu {unidad} cubre hasta {bs(maxUsd)}.{vence && ` Su cuota vence el ${fechaCorta(vence)}${esDiaDeCobro(ficha, vence) ? ', tu día de cobro' : ''}.`}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#F6FCE3', borderRadius: 16, padding: '10px 12px', marginTop: 14 }}>
                <IcoInfo color="#3B6B00" style={{ flex: 'none', marginTop: 1 }} />
                <span style={{ fontSize: 14, lineHeight: 1.35, color: '#2C4F00' }}>Tu {unidad} cubre hasta {bs(maxUsd)}; el resto lo pagas con tu saldo.</span>
              </div>
              <div className="cd-row" style={{ marginTop: 12, fontSize: 15 }}><span>Cubre tu {unidad}</span><b>{bs(cubre)}</b></div>
              <div className="cd-row" style={{ marginTop: 6, fontSize: 15 }}><span>Pagas con tu saldo</span><b>{bs(conSaldo)}</b></div>
              <div className="cd-row" style={{ borderTop: '1px dashed #D5D8E1', marginTop: 10, paddingTop: 10 }}><span style={{ fontWeight: 600 }}>Total</span><b style={{ fontSize: 18 }}>{bs(montoUsd)}</b></div>
            </>
          )}
          <MensajeError style={{ marginTop: 12 }}>{error}</MensajeError>
        </Tarjeta>
      </div>
    </Pantalla>
  )
}

/** Tiempo de estacionamiento aproximado (decorativo, como "3 h 20 min" del diseño) */
const tiempo = (usdMonto) => {
  const min = Math.round(usdMonto * 50)
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`
}

function FichaTicket({ n, estado, rotulo }) {
  const estilos = {
    usado: { caja: { background: '#E6E8EE', color: '#4A4A5E' }, linea: '#C2C5D0', txt: 'Usado' },
    ahora: { caja: { background: '#121412', color: '#C6F432', boxShadow: '0 0 0 3px #FF1F5A' }, linea: 'rgba(198,244,50,.4)', txt: 'Se usa ahora' },
    disponible: { caja: { background: 'linear-gradient(160deg,#D4F95A 0%,#B5E61D 100%)', color: '#121412' }, linea: 'rgba(18,20,18,.3)', txt: 'Disponible' },
  }[estado]
  return (
    <div className="cd-tk" style={estilos.caja}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em' }}>{rotulo} {n}</div>
      <div className="cd-ntc" style={{ borderTop: `2px dashed ${estilos.linea}` }} aria-hidden="true"><span style={{ left: -6 }} /><span style={{ right: -6 }} /></div>
      <b>{estilos.txt}</b>
    </div>
  )
}
