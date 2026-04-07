import { supabase } from './supabase'

export type Categoria =
  | 'navegacion'
  | 'auth'
  | 'campana'
  | 'contacto'
  | 'pago'
  | 'llamada'
  | 'error'
  | 'chatbot'
  | 'creditos'
  | 'secuencia'
  | 'integracion'

export interface LogParams {
  accion: string
  categoria: Categoria
  pagina?: string
  detalle?: Record<string, unknown>
  error_mensaje?: string
  error_stack?: string
  user_id?: string
}

export const logActivity = async (params: LogParams) => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const pagina =
      params.pagina ??
      (typeof window !== 'undefined' ? window.location.pathname : undefined)
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null

    await supabase.from('activity_logs').insert({
      user_id: user?.id ?? params.user_id ?? null,
      accion: params.accion,
      categoria: params.categoria,
      pagina: pagina ?? null,
      detalle: params.detalle ?? null,
      error_mensaje: params.error_mensaje ?? null,
      error_stack: params.error_stack ?? null,
      user_agent: userAgent,
    })
  } catch (e) {
    console.warn('Log failed:', e)
  }
}

export const logError = async (
  error: Error,
  contexto: string,
  detalle?: Record<string, unknown>,
) => {
  await logActivity({
    accion: 'error_' + contexto,
    categoria: 'error',
    error_mensaje: error.message,
    error_stack: error.stack?.substring(0, 500),
    detalle,
  })
}
