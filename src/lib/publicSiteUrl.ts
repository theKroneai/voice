/**
 * Dominio público principal (marketing / legales).
 * Enlaces absolutos aseguran thekroneai.com aunque la app cargue desde voice.thekroneai.com u otro host.
 */
const raw = import.meta.env.VITE_PUBLIC_SITE_URL ?? 'https://thekroneai.com'

export const PUBLIC_SITE_ORIGIN = String(raw).trim().replace(/\/+$/, '') || 'https://thekroneai.com'

export function publicLegalPath(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${PUBLIC_SITE_ORIGIN}${p}`
}
