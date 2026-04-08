/**
 * Correos transaccionales (plantillas HTML).
 *
 * Envío: si existe VITE_N8N_URL, se usa POST /webhook/send-email (n8n + Resend en servidor).
 * Si no hay n8n pero sí VITE_RESEND_API_KEY, se usa el SDK de Resend (puede fallar por CORS
 * desde el navegador; la clave queda en el bundle — no recomendado en producción).
 */

import { Resend } from 'resend'

const resendApiKey = String(import.meta.env.VITE_RESEND_API_KEY ?? '').trim()
const resend = resendApiKey ? new Resend(resendApiKey) : null

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const baseTemplate = (contenido: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #0a0a0a; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .logo { text-align: center; margin-bottom: 30px; }
    .logo img { height: 40px; }
    .card { background: #111111; border-radius: 12px; padding: 32px; border: 1px solid #1f1f1f; }
    h1 { color: #ffffff; font-size: 24px; margin: 0 0 16px; }
    p { color: #888888; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; background: #22c55e; color: #000000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px; margin: 16px 0; }
    .footer { text-align: center; margin-top: 32px; color: #444; font-size: 13px; }
    .divider { border: none; border-top: 1px solid #1f1f1f; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h2 style="color: #22c55e; margin: 0;">The Krone AI</h2>
    </div>
    <div class="card">
      ${contenido}
    </div>
    <div class="footer">
      <p>© 2026 Pineapple Group LLC · The Krone AI</p>
      <p>hola@thekroneai.com · thekroneai.com</p>
    </div>
  </div>
</body>
</html>
`

export const emailBienvenida = (nombre: string) =>
  baseTemplate(`
  <h1>¡Bienvenido a Krone Agent AI! 🎉</h1>
  <p>Hola ${escapeHtml(nombre)},</p>
  <p>Tu cuenta ha sido creada exitosamente. 
  Ahora tienes acceso a tu vendedor de IA 
  que nunca duerme.</p>
  <p><strong style="color:#fff">¿Qué puedes hacer ahora?</strong></p>
  <p style="color:#ccc">✅ Crear tu primera campaña<br>
  ✅ Importar tus contactos<br>
  ✅ Recargar créditos y lanzar llamadas</p>
  <a href="https://thekroneai.com/dashboard" class="btn">
    Ir al Dashboard →
  </a>
  <hr class="divider">
  <p>Si tienes dudas escríbenos a hola@thekroneai.com</p>
`)

export const emailRecargaExitosa = (nombre: string, monto: number, saldoTotal: number) =>
  baseTemplate(`
  <h1>✅ Recarga exitosa</h1>
  <p>Hola ${escapeHtml(nombre)},</p>
  <p>Tu recarga de <strong style="color:#22c55e">$${monto}.00 USD</strong> 
  fue procesada correctamente.</p>
  <div style="background:#0a0a0a;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="margin:0;color:#888;font-size:13px;">Saldo actual</p>
    <p style="margin:4px 0 0;color:#22c55e;font-size:28px;font-weight:bold;">
      $${saldoTotal.toFixed(2)} USD
    </p>
  </div>
  <a href="https://thekroneai.com/campaigns" class="btn">
    Lanzar campaña →
  </a>
`)

export const emailSaldoBajo = (nombre: string, saldo: number) =>
  baseTemplate(`
  <h1>⚠️ Saldo bajo</h1>
  <p>Hola ${escapeHtml(nombre)},</p>
  <p>Tu saldo está por debajo de $5.00 USD. 
  Recarga ahora para no interrumpir tus campañas.</p>
  <div style="background:#0a0a0a;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="margin:0;color:#888;font-size:13px;">Saldo actual</p>
    <p style="margin:4px 0 0;color:#ef4444;font-size:28px;font-weight:bold;">
      $${saldo.toFixed(2)} USD
    </p>
  </div>
  <a href="https://thekroneai.com/credits" class="btn">
    Recargar ahora →
  </a>
`)

export const emailTicketCreado = (nombre: string, ticketId: string, descripcion: string) =>
  baseTemplate(`
  <h1>🎫 Ticket recibido</h1>
  <p>Hola ${escapeHtml(nombre)},</p>
  <p>Recibimos tu reporte. Nuestro equipo 
  lo revisará pronto.</p>
  <div style="background:#0a0a0a;border-radius:8px;padding:16px;margin:16px 0;">
    <p style="margin:0;color:#888;font-size:13px;">Número de ticket</p>
    <p style="margin:4px 0;color:#fff;font-weight:bold;">#${escapeHtml(ticketId.substring(0, 8).toUpperCase())}</p>
    <p style="margin:8px 0 0;color:#888;font-size:13px;">Descripción</p>
    <p style="margin:4px 0 0;color:#ccc;">${escapeHtml(descripcion)}</p>
  </div>
  <p>Te responderemos en menos de 24 horas.</p>
`)

export const emailReferidoRegistrado = (nombre: string, referidoNombre: string) =>
  baseTemplate(`
  <h1>🤝 Nuevo referido registrado</h1>
  <p>Hola ${escapeHtml(nombre)},</p>
  <p><strong style="color:#fff">${escapeHtml(referidoNombre)}</strong> 
  se registró usando tu código de referido.</p>
  <p>Ganarás el <strong style="color:#22c55e">20%</strong> 
  de su consumo durante los próximos 12 meses,
  acreditado automáticamente a tu cuenta.</p>
  <a href="https://thekroneai.com/referrals" class="btn">
    Ver mis referidos →
  </a>
`)

export const enviarCorreo = async ({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) => {
  const toTrim = to.trim()
  if (!toTrim) return

  const n8nBase = String(import.meta.env.VITE_N8N_URL ?? '')
    .trim()
    .replace(/\/+$/, '')

  try {
    if (n8nBase) {
      await fetch(`${n8nBase}/webhook/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toTrim,
          subject,
          html,
          template: 'transaccional',
          data: {},
        }),
      })
      return
    }

    if (resend) {
      await resend.emails.send({
        from: 'Krone Agent AI <hola@thekroneai.com>',
        to: toTrim,
        subject,
        html,
      })
    }
  } catch (error) {
    console.error('Error enviando correo:', error)
  }
}
