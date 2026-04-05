/**
 * Base URL "pública" para webhooks que deben apuntar al subdominio propio
 * (ej. https://voice.kronecrm.com) y no exponer la URL interna de n8n.
 *
 * Se usa:
 * - `VITE_WEBHOOK_BASE_URL` si está definida (recomendado para staging/prod)
 * - si no, el `window.location.origin` (útil cuando el frontend vive en el subdominio)
 */
export function getPublicWebhookBaseUrl(): string {
  const envBase = (import.meta.env.VITE_WEBHOOK_BASE_URL as string | undefined)?.replace(
    /\/$/,
    '',
  )
  if (envBase) return envBase

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '')
  }

  return ''
}

