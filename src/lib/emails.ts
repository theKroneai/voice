/**
 * Envío de correo vía n8n (proxy → Resend). Sin API key en el cliente.
 */

const N8N_URL = String(import.meta.env.VITE_N8N_URL ?? '')
  .trim()
  .replace(/\/+$/, '')

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const enviarCorreo = async ({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) => {
  if (!N8N_URL || !to.trim()) return
  try {
    await fetch(`${N8N_URL}/webhook/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: to.trim(), subject, html }),
    })
  } catch (error) {
    console.error('Error enviando correo:', error)
  }
}

const base = (contenido: string) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body{font-family:Arial,sans-serif;
       background:#0a0a0a;margin:0;padding:0}
  .wrap{max-width:600px;margin:0 auto;padding:40px 20px}
  .logo{text-align:center;margin-bottom:30px}
  .card{background:#111;border-radius:12px;
        padding:32px;border:1px solid #1f1f1f}
  h1{color:#fff;font-size:24px;margin:0 0 16px}
  p{color:#888;font-size:15px;
    line-height:1.6;margin:0 0 16px}
  .btn{display:inline-block;background:#22c55e;
       color:#000;padding:14px 28px;
       border-radius:8px;text-decoration:none;
       font-weight:bold;font-size:15px;margin:16px 0}
  .stat{background:#0a0a0a;border-radius:8px;
        padding:16px;margin:16px 0}
  .stat-label{margin:0;color:#888;font-size:13px}
  .stat-value{margin:4px 0 0;font-size:28px;
              font-weight:bold}
  .footer{text-align:center;margin-top:32px;
          color:#444;font-size:13px}
  hr{border:none;border-top:1px solid #1f1f1f;
     margin:24px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">
    <h2 style="color:#22c55e;margin:0">The Krone AI</h2>
  </div>
  <div class="card">${contenido}</div>
  <div class="footer">
    <p>© 2026 Pineapple Group LLC · The Krone AI</p>
    <p>hola@thekroneai.com · thekroneai.com</p>
  </div>
</div>
</body>
</html>`

export const emailBienvenida = (nombre: string) =>
  base(`
    <h1>¡Bienvenido a Krone Agent AI! 🎉</h1>
    <p>Hola ${escapeHtml(nombre)},</p>
    <p>Tu cuenta está lista. Tienes acceso 
    a tu vendedor de IA que nunca duerme.</p>
    <p style="color:#ccc">
      ✅ Crea tu primera campaña<br>
      ✅ Importa tus contactos<br>
      ✅ Recarga créditos y lanza llamadas
    </p>
    <a href="https://thekroneai.com/dashboard" 
       class="btn">Ir al Dashboard →</a>
    <hr>
    <p>¿Dudas? Escríbenos a hola@thekroneai.com</p>
  `)

export const emailRecargaExitosa = (nombre: string, monto: number, saldoTotal: number) =>
  base(`
  <h1>✅ Recarga exitosa</h1>
  <p>Hola ${escapeHtml(nombre)},</p>
  <p>Tu recarga de 
  <strong style="color:#22c55e">$${monto}.00 USD</strong>
  fue procesada correctamente.</p>
  <div class="stat">
    <p class="stat-label">Saldo actual</p>
    <p class="stat-value" style="color:#22c55e">
      $${saldoTotal.toFixed(2)} USD
    </p>
  </div>
  <a href="https://thekroneai.com/campaigns" 
     class="btn">Lanzar campaña →</a>
`)

export const emailSaldoBajo = (nombre: string, saldo: number) =>
  base(`
  <h1>⚠️ Saldo bajo</h1>
  <p>Hola ${escapeHtml(nombre)},</p>
  <p>Tu saldo está por debajo de $5.00 USD.
  Recarga para no interrumpir tus campañas.</p>
  <div class="stat">
    <p class="stat-label">Saldo actual</p>
    <p class="stat-value" style="color:#ef4444">
      $${saldo.toFixed(2)} USD
    </p>
  </div>
  <a href="https://thekroneai.com/credits" 
     class="btn">Recargar ahora →</a>
`)

export const emailTicketCreado = (nombre: string, ticketId: string, descripcion: string) =>
  base(`
  <h1>🎫 Ticket recibido</h1>
  <p>Hola ${escapeHtml(nombre)},</p>
  <p>Recibimos tu reporte. Lo revisaremos pronto.</p>
  <div class="stat">
    <p class="stat-label">Número de ticket</p>
    <p style="color:#fff;font-weight:bold;margin:4px 0">
      #${escapeHtml(ticketId.substring(0, 8).toUpperCase())}
    </p>
    <p class="stat-label" style="margin-top:8px">
      Descripción
    </p>
    <p style="color:#ccc;margin:4px 0">${escapeHtml(descripcion)}</p>
  </div>
  <p>Te responderemos en menos de 24 horas.</p>
`)

export const emailReferidoRegistrado = (nombre: string, referidoNombre: string) =>
  base(`
  <h1>🤝 Nuevo referido</h1>
  <p>Hola ${escapeHtml(nombre)},</p>
  <p><strong style="color:#fff">${escapeHtml(referidoNombre)}</strong>
  se registró con tu código.</p>
  <p>Ganarás el 
  <strong style="color:#22c55e">20%</strong>
  de su consumo por 12 meses.</p>
  <a href="https://thekroneai.com/referrals" 
     class="btn">Ver mis referidos →</a>
`)

export const emailTicketRespondido = (nombre: string, ticketId: string, respuesta: string) =>
  base(`
  <h1>✅ Tu ticket fue respondido</h1>
  <p>Hola ${escapeHtml(nombre)},</p>
  <p>El equipo de Krone AI respondió 
  tu ticket #${escapeHtml(ticketId.substring(0, 8).toUpperCase())}.</p>
  <div class="stat">
    <p class="stat-label">Respuesta</p>
    <p style="color:#ccc;margin:4px 0">${escapeHtml(respuesta)}</p>
  </div>
  <a href="https://thekroneai.com/settings" 
     class="btn">Ver en la app →</a>
`)
