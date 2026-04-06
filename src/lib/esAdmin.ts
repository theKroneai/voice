/**
 * Interpreta es_admin desde Postgres/PostgREST (boolean) o valores raros en JSON.
 */
export function parseEsAdmin(value: unknown): boolean {
  if (value === true) return true
  if (value === false || value == null) return false
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase()
    return s === 'true' || s === 't' || s === '1' || s === 'yes'
  }
  if (typeof value === 'number') return value === 1
  return false
}
