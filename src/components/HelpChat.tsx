import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { emailTicketCreado, enviarCorreo } from '../lib/emails'
import { KRONE_BRAND_ICON } from '../utils/logos'

const WELCOME_TEXT =
  '¡Hola! Soy el asistente de Krone AI. Puedo ayudarte con cualquier pregunta sobre la plataforma. ¿En qué te puedo ayudar hoy? 😊'

const SYSTEM_PROMPT = `Eres el asistente de ayuda de Krone Agent AI,
una plataforma SaaS de agentes de voz IA para
el mercado latino en EE.UU. y LATAM.

## SOBRE KRONE AGENT AI
- Plataforma de agentes de voz IA outbound/inbound
- Los agentes llaman en español perfecto 24/7
- Modelo pay per use — solo pagas lo que usas
- 3 planes: Prospectador ($0.45/min), 
  Vendedor ($0.75/min), Cazador ($0.90/min)
- Plan Cazador incluye SMS automático
- 26 nichos prefabricados disponibles

## PÁGINAS Y FUNCIONALIDADES

Dashboard: Métricas de llamadas, créditos 
disponibles y recomendaciones IA.

Campañas: Crear y gestionar campañas outbound.
Cada campaña tiene nicho, horario, max intentos
y cadencia de llamadas.

Contactos: Importar y gestionar leads.
Acepta CSV con campos: nombre, telefono, 
ciudad, zipcode, email, pais.

Llamadas: Historial de todas las llamadas
con transcripciones y sentiment analysis.

SMS: Historial de SMS enviados (plan Cazador).

Citas: Citas agendadas por los agentes.

Créditos: Recargar saldo y ver historial.
Mínimos: Prospectador $20, Vendedor $50, 
Cazador $100.

Secuencias: Automatizar seguimientos por
días. 14 secuencias predefinidas disponibles.

Integraciones: Conectar con CRMs externos.
CRM Personalizado es gratis para todos.

Referidos: Gana 20% del consumo de tus 
referidos durante 12 meses.

Configuración: Datos de la empresa, 
horarios y preferencias.

## CÓMO RESPONDER
- Siempre en español
- Respuestas cortas y directas (máximo 3 párrafos)
- Si no sabes algo → decir honestamente
- Si el usuario reporta un error → 
  preguntar detalles y decirle que 
  se creará un ticket para el equipo
- Tono amigable y profesional
- Usa emojis ocasionalmente

## CUANDO EL USUARIO REPORTA UN ERROR
1. Preguntar: ¿En qué página ocurrió?
   ¿Qué estabas haciendo? ¿Qué mensaje viste?
2. Al tener los detalles responder:
   "Entendido, voy a crear un ticket para 
   que nuestro equipo lo revise."
3. Incluir en la respuesta el texto:
   [CREAR_TICKET: descripción del error]
   (esto lo detecta el código para crear el ticket)

## PÁGINAS LEGALES
- Política de Privacidad: thekroneai.com/privacy-policy
- Términos de Servicio: thekroneai.com/terms
- Compliance/Habeas Data: thekroneai.com/compliance

## NUEVAS FUNCIONALIDADES
- Login con Google disponible en la página de login
- Créditos universales en USD (no minutos)
  Prospectador mínimo $20, Vendedor $50, Cazador $100
- SMS campaigns disponibles en /sms
- 8 plantillas de campaña predefinidas
- Sistema de compliance legal en /compliance
  (requerido antes de lanzar campañas)
- Tickets de soporte desde este chat

## PRECIOS ACTUALIZADOS
- Voz Prospectador: $0.45/min
- Voz Vendedor: $0.75/min  
- Voz Cazador: $0.90/min
- SMS: $0.08/mensaje
- Créditos universales — sirven para 
  voz, SMS y futuros servicios

## CONTACTO Y SOPORTE
- Email: hola@thekroneai.com
- Web: thekroneai.com
- Para reportar errores: usar este chat
  y se crea un ticket automáticamente`

const TICKET_REGEX = /\[CREAR_TICKET:\s*([^\]]+)]/i

const SUGGESTIONS = [
  '¿Cómo crear una campaña?',
  '¿Cómo recargar créditos?',
  '¿Cómo funciona el plan Cazador?',
  'Reportar un error',
]

type ChatRole = 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function stripTicketTag(text: string): string {
  return text.replace(TICKET_REGEX, '').trim()
}

function buildApiMessages(msgs: ChatMessage[]): { role: ChatRole; content: string }[] {
  return msgs.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-20)
}

export function HelpChat() {
  const location = useLocation()
  const path = location.pathname

  const hidden =
    path === '/login' ||
    path === '/register' ||
    path === '/onboarding' ||
    path.endsWith('/login') ||
    path.endsWith('/register') ||
    path.endsWith('/onboarding')

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [welcomeSent, setWelcomeSent] = useState(false)
  const [headerLogoFailed, setHeaderLogoFailed] = useState(false)
  const listEndRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<ChatMessage[]>([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, loading])

  useEffect(() => {
    if (open && !welcomeSent) {
      const w: ChatMessage = { id: uid(), role: 'assistant', content: WELCOME_TEXT }
      messagesRef.current = [w]
      setMessages([w])
      setWelcomeSent(true)
    }
  }, [open, welcomeSent])

  useEffect(() => {
    if (open) {
      void logActivity({ accion: 'chatbot_abierto', categoria: 'chatbot' })
    }
  }, [open])

  const sendViaOpenRouter = useCallback(async (userText: string, history: ChatMessage[]) => {
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY?.trim()
    if (!apiKey) {
      return {
        text: 'No hay clave de OpenRouter (VITE_OPENROUTER_API_KEY). Configúrala en el entorno para usar el asistente.',
        raw: '',
      }
    }

    const conversationHistory = buildApiMessages([
      ...history,
      { id: '', role: 'user', content: userText },
    ]).map((m) => ({ role: m.role, content: m.content }))

    let res: Response
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://voice.thekroneai.com',
          'X-Title': 'Krone Agent AI',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-haiku-4.5',
          max_tokens: 1000,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...conversationHistory],
        }),
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return {
        text: `No pude conectar con el asistente (${msg}).`,
        raw: '',
      }
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      error?: { message?: string }
    }

    if (!res.ok) {
      const errMsg = data.error?.message?.trim() || 'Error desconocido'
      return {
        text: `No pude conectar con el asistente (${res.status}). ${errMsg}`,
        raw: '',
      }
    }

    const respuesta = data.choices?.[0]?.message?.content?.trim() ?? ''
    if (!respuesta && data.error?.message) {
      return { text: data.error.message, raw: '' }
    }
    return { text: respuesta || 'Sin respuesta.', raw: respuesta }
  }, [])

  const tryCreateTicket = useCallback(async (rawResponse: string) => {
    const match = rawResponse.match(TICKET_REGEX)
    if (!match?.[1]?.trim()) return null

    const descripcionError = match[1].trim()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user?.id ?? null,
        descripcion: descripcionError,
        pagina: typeof window !== 'undefined' ? window.location.pathname : null,
        status: 'pendiente',
      })
      .select('id')
      .maybeSingle()

    if (error) {
      return `No se pudo crear el ticket: ${error.message}`
    }
    void logActivity({
      accion: 'ticket_creado',
      categoria: 'error',
      detalle: { descripcion: descripcionError.substring(0, 200) },
    })
    const ticketUuid = data?.id
    const email = user?.email?.trim()
    if (email && user?.id && typeof ticketUuid === 'string') {
      const { data: prof } = await supabase
        .from('users')
        .select('nombre')
        .eq('id', user.id)
        .maybeSingle()
      const nombre =
        (typeof prof?.nombre === 'string' && prof.nombre.trim()) ||
        email.split('@')[0] ||
        email
      void enviarCorreo({
        to: email,
        subject: '🎫 Ticket recibido — Krone Agent AI',
        html: emailTicketCreado(nombre, ticketUuid, descripcionError),
      })
    }
    const id = ticketUuid ?? '—'
    const short = typeof id === 'string' && id.length > 8 ? id.slice(0, 8) : id
    return `✅ Ticket #${short} creado. Nuestro equipo lo revisará pronto.`
  }, [])

  const handleSend = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    void logActivity({
      accion: 'chatbot_mensaje',
      categoria: 'chatbot',
      detalle: { mensaje: trimmed.substring(0, 100) },
    })

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: trimmed }
    const prior = messagesRef.current
    const nextWithUser = [...prior, userMsg]
    messagesRef.current = nextWithUser
    setMessages(nextWithUser)
    setInput('')
    setLoading(true)

    try {
      const { text: rawReply, raw } = await sendViaOpenRouter(trimmed, prior)
      const ticketNote = await tryCreateTicket(raw || rawReply)
      const displayAssistant = stripTicketTag(rawReply)
      const finalContent = ticketNote
        ? `${displayAssistant}\n\n${ticketNote}`.trim()
        : displayAssistant

      const assistantMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: finalContent || 'Listo.',
      }
      const withAssistant = [...messagesRef.current, assistantMsg]
      messagesRef.current = withAssistant
      setMessages(withAssistant)
    } catch {
      const errMsg: ChatMessage = {
        id: uid(),
        role: 'assistant',
        content: 'Hubo un error al enviar el mensaje. Intenta de nuevo en un momento.',
      }
      const withErr = [...messagesRef.current, errMsg]
      messagesRef.current = withErr
      setMessages(withErr)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void handleSend(input)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend(input)
    }
  }

  if (hidden) return null

  return (
    <>
      <button
        type="button"
        aria-label="Abrir asistente Krone AI"
        onClick={() => setOpen(true)}
        className={
          'fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-[#22c55e] text-2xl text-[#0b0b0b] shadow-lg shadow-[#22c55e]/30 transition hover:scale-105 hover:bg-[#1fb455] ' +
          (open ? 'pointer-events-none scale-0 opacity-0' : 'scale-100 opacity-100')
        }
      >
        💬
      </button>

      <div
        ref={panelRef}
        className={
          'fixed bottom-6 right-6 z-[100] flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#111111] shadow-2xl transition-all duration-300 ease-out ' +
          (open
            ? 'h-[520px] w-[380px] max-w-[calc(100vw-1.5rem)] translate-y-0 opacity-100'
            : 'pointer-events-none h-[520px] w-[380px] translate-y-8 opacity-0')
        }
        style={{ maxHeight: 'calc(100vh - 3rem)' }}
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-zinc-800 bg-[#0b0b0b] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-transparent">
              {!headerLogoFailed ? (
                <img
                  src={KRONE_BRAND_ICON}
                  alt="Krone AI"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    setHeaderLogoFailed(true)
                  }}
                />
              ) : (
                <span className="text-sm font-bold text-[#22c55e]" aria-hidden>
                  K
                </span>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100">Krone AI Asistente</div>
              <div className="text-xs text-zinc-500">Respondo al instante</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar chat"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={'flex ' + (m.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={
                  'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed ' +
                  (m.role === 'user'
                    ? 'rounded-br-md bg-[#22c55e] text-[#0b0b0b]'
                    : 'rounded-bl-md bg-zinc-800 text-zinc-100')
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-zinc-800 px-4 py-3">
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
              </div>
            </div>
          )}
          <div ref={listEndRef} />
        </div>

        <div className="shrink-0 border-t border-zinc-800 bg-[#0b0b0b] px-3 py-2">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                disabled={loading}
                onClick={() => void handleSend(s)}
                className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-[#22c55e]/50 hover:text-[#86efac] disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Escribe tu mensaje..."
              disabled={loading}
              className="max-h-24 min-h-[40px] flex-1 resize-none rounded-xl border border-zinc-700 bg-[#111111] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#22c55e] focus:outline-none focus:ring-1 focus:ring-[#22c55e]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 rounded-xl bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-50"
            >
              →
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
