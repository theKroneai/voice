import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan variables de entorno: VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY',
  )
}

/** Cliente browser: siempre URL del proyecto + clave ANON (pública). RLS aplica en cada request. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.log('[Supabase] VITE_SUPABASE_URL:', supabaseUrl)
  // eslint-disable-next-line no-console
  console.log(
    '[Supabase] VITE_SUPABASE_ANON_KEY en uso (solo prefijo, no es la service role):',
    `${supabaseAnonKey.slice(0, 12)}…`,
  )
}

