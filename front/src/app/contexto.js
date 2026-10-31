// Contexto compartido por todas las pantallas: ficha del usuario, fecha del reloj y avisos.
import { createContext, useContext } from 'react'

export const AppCtx = createContext(null)

/** { userId, ficha, hoy, recargarFicha(), avisar(texto) } */
export const useApp = () => useContext(AppCtx)
