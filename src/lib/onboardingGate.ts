import { supabase } from './supabase'

/** True si el usuario ya completó onboarding (flag o nicho guardado). */
export function isOnboardingDone(
  row: { onboarding_completado?: boolean | null; nicho?: string | null } | null,
): boolean {
  if (!row) return false
  if (row.onboarding_completado === true) return true
  return typeof row.nicho === 'string' && row.nicho.trim().length > 0
}

/** Si coincide con VITE_BOOTSTRAP_ADMIN_EMAIL, la fila nueva se crea con es_admin true (solo tú / primer deploy). */
function shouldBootstrapAdmin(email: string | undefined): boolean {
  const target = (import.meta.env.VITE_BOOTSTRAP_ADMIN_EMAIL as string | undefined)?.trim().toLowerCase()
  if (!target || !email) return false
  return email.trim().toLowerCase() === target
}

/**
 * Crea la fila en public.users si no existe.
 * Sin esto, los UPDATE del onboarding pueden afectar 0 filas y el login sigue mandando a /onboarding.
 */
export async function ensureUserRow(userId: string, email: string | undefined): Promise<void> {
  const user = { id: userId }
  const { data, error } = await supabase
    .from('users')
    .select('id, es_admin, onboarding_completado, nombre')
    .eq('id', user.id)
    .maybeSingle()
  // eslint-disable-next-line no-console
  console.log('users data:', data)
  // eslint-disable-next-line no-console
  console.log('users error:', error)
  if (error) {
    console.warn('[ensureUserRow] select:', error.message)
    return
  }
  if (data?.id) return

  const { error: insErr } = await supabase.from('users').insert({
    id: userId,
    email: email ?? null,
    es_admin: shouldBootstrapAdmin(email),
  })
  if (insErr && insErr.code !== '23505') {
    console.warn('[ensureUserRow] insert:', insErr.message)
  }
}
