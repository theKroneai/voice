import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ThemeToggle } from '../components/ThemeToggle'
import { KRONE_BRAND_ICON } from '../utils/logos'
import { getPublicWebhookBaseUrl } from '../lib/getPublicWebhookBaseUrl'

type PlanConfigLanding = {
  plan_id: string
  nombre: string
  emoji: string | null
  precio_por_minuto: number
  descripcion: string | null
  features: string[] | null
}

const FALLBACK_PLANES_LANDING: PlanConfigLanding[] = [
  { plan_id: 'prospectador', nombre: 'El Prospectador', emoji: '🎯', precio_por_minuto: 0.45, descripcion: null, features: ['Solo Outbound', 'Reintentos ilimitados', 'Transcripciones', 'Dashboard básico'] },
  { plan_id: 'vendedor', nombre: 'El Vendedor', emoji: '⚡', precio_por_minuto: 0.75, descripcion: null, features: ['Outbound + Inbound', 'Reintentos ilimitados', 'Transcripciones', 'Dashboard completo', 'Historial de llamadas'] },
  { plan_id: 'cazador', nombre: 'El Cazador', emoji: '👑', precio_por_minuto: 0.9, descripcion: null, features: ['Todo en El Vendedor', 'SMS automático si no contesta', 'SMS confirmación de cita', 'Reportes avanzados'] },
]

const FALLBACK_SMS_PLAN: PlanConfigLanding & { plan_id: 'sms' } = {
  plan_id: 'sms',
  nombre: 'SMS Outbound',
  emoji: '💬',
  precio_por_minuto: 0.05,
  descripcion: null,
  features: ['SMS post-llamada automático', 'Confirmación de cita', 'Recordatorio 24h antes', 'Respuestas monitoreadas'],
}

const NAV_LINKS = [
  { label: 'Soluciones', href: '#soluciones' },
  { label: 'Casos de uso', href: '#casos' },
  { label: 'Precios', href: '#precios' },
  { label: 'Demo', href: '#demo' },
]

const SOLUCIONES = [
  {
    badge: 'OUTBOUND',
    badgeClass: 'bg-orange-500/20 text-orange-300',
    icon: '📞',
    title: 'Llama en frío automáticamente',
    description: 'Tu agente llama a toda tu lista, presenta tu oferta, maneja objeciones y agenda visitas. Sin intervención humana.',
    features: ['Cadencia automática', 'Respeta horarios', 'Reintentos inteligentes'],
    cta: 'Ver campañas outbound →',
    href: '/campaigns',
    bgClass: 'bg-[#22c55e]/5 border-[#22c55e]/20',
  },
  {
    badge: 'INBOUND',
    badgeClass: 'bg-sky-500/20 text-sky-300',
    icon: '📲',
    title: 'Atiende llamadas 24/7',
    description: 'Nunca pierdas un prospecto. Tu agente contesta, identifica la necesidad y agenda la cita aunque sean las 2AM.',
    features: ['Door hanger water', 'Agenda citas médicas/legales', 'Multi-idioma automático'],
    cta: 'Ver agentes inbound →',
    href: '/login',
    bgClass: '',
  },
  {
    badge: 'SMS',
    badgeClass: 'bg-violet-500/20 text-violet-300',
    icon: '💬',
    title: 'Seguimiento por SMS',
    description: 'Si no contesta, envía SMS automático. Confirmaciones de cita, recordatorios y más.',
    features: ['SMS post-llamada', 'Confirmación de cita', 'Recordatorio 24h antes'],
    cta: 'Ver integración SMS →',
    href: '/login',
    bgClass: '',
  },
  {
    badge: 'ANALYTICS',
    badgeClass: 'bg-cyan-500/20 text-cyan-300',
    icon: '📊',
    title: 'Métricas en tiempo real',
    description: 'Ve transcripciones, grabaciones, tasa de contacto y ROI de cada campaña en tu dashboard.',
    features: ['Transcripciones automáticas', 'Sentiment analysis', 'Reportes exportables'],
    cta: 'Ver dashboard →',
    href: '/login',
    bgClass: '',
  },
]

const CASOS_USO = [
  { emoji: '💧', name: 'Agua y Filtración', desc: 'Door hangers y análisis gratuito' },
  { emoji: '🏠', name: 'Roofing', desc: 'Inspecciones post-tormenta' },
  { emoji: '🔆', name: 'Solar', desc: 'Análisis de ahorro energético' },
  { emoji: '🦷', name: 'Dental', desc: 'Nuevos pacientes y citas' },
  { emoji: '⚖️', name: 'Legal', desc: 'Consultas y calificación de casos' },
  { emoji: '🏡', name: 'Real Estate', desc: 'Compradores y vendedores' },
  { emoji: '🐛', name: 'Pest Control', desc: 'Inspecciones gratuitas' },
  { emoji: '❄️', name: 'HVAC', desc: 'Mantenimiento y reparaciones' },
  { emoji: '🌎', name: 'Inmigrantes', desc: 'ITIN, seguros, remesas' },
  { emoji: '🚗', name: 'Auto Insurance', desc: 'Cotizaciones gratis' },
  { emoji: '💳', name: 'Crédito', desc: 'Reparación y asesoría' },
  { emoji: '💪', name: 'Fitness', desc: 'Membresías y nutrición' },
]

const PASOS = [
  { num: '①', title: 'CREA TU CUENTA (2 min)', desc: 'Regístrate gratis. Sin tarjeta de crédito.' },
  { num: '②', title: 'ELIGE TU NICHO (1 min)', desc: 'Selecciona tu industria y el sistema carga el guión optimizado automáticamente.' },
  { num: '③', title: 'IMPORTA CONTACTOS (5 min)', desc: 'Sube tu lista en CSV o Excel. El sistema los organiza.' },
  { num: '④', title: 'CONFIGURA Y ACTIVA (5 min)', desc: 'Define horario, intentos máximos y activa la campaña.' },
  { num: '⑤', title: 'TU AGENTE LLAMA SOLO', desc: 'Llama, convence, agenda. Tú solo revisas los resultados.' },
]

const LOGOS = ['Pasteur Water', 'SolarMax USA', 'Dental Familiar', 'LegalPro Group', 'RoofPro CT', 'CleanPest Inc']

export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const [businessDesc, setBusinessDesc] = useState('')
  const [phoneRaw, setPhoneRaw] = useState('')
  const [agentName, setAgentName] = useState<'Sofia' | 'Alex'>('Sofia')
  const [agentGender, setAgentGender] = useState<'femenino' | 'masculino'>(
    'femenino',
  )
  const [demoLoading, setDemoLoading] = useState(false)
  const [demoSuccess, setDemoSuccess] = useState(false)
  const [demoError, setDemoError] = useState(false)
  const [pricingTab, setPricingTab] = useState<'voz' | 'sms'>('voz')
  const [planesPrecios, setPlanesPrecios] = useState<PlanConfigLanding[]>(FALLBACK_PLANES_LANDING)
  const [planSms, setPlanSms] = useState<PlanConfigLanding>(FALLBACK_SMS_PLAN)
  const [demoGenerateLoading, setDemoGenerateLoading] = useState(false)
  /** True después de pulsar "Generar con IA" (mensaje en textarea sustituido por la IA). */
  const [demoAiGenerated, setDemoAiGenerated] = useState(false)
  /** Texto del contexto antes de generar; se usa en "Regenerar". */
  const [demoContextSnapshot, setDemoContextSnapshot] = useState('')
  /** Ejemplo real seleccionado (cards superiores). */
  const [demoFromExample, setDemoFromExample] = useState(false)
  const [demoSelectedExampleId, setDemoSelectedExampleId] = useState<string | null>(null)
  const demoFormRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    let mounted = true
    supabase
      .from('plan_config')
      .select('plan_id, nombre, emoji, precio_por_minuto, descripcion, features')
      .eq('activo', true)
      .order('precio_por_minuto', { ascending: true })
      .then(({ data }) => {
        if (!mounted || !data?.length) return
        const rows = data as Record<string, unknown>[]
        const toPlan = (row: Record<string, unknown>) => ({
          plan_id: String(row.plan_id),
          nombre: String(row.nombre),
          emoji: row.emoji != null ? String(row.emoji) : null,
          precio_por_minuto: Number(row.precio_por_minuto),
          descripcion: row.descripcion != null ? String(row.descripcion) : null,
          features: Array.isArray(row.features) ? (row.features as string[]) : null,
        })
        setPlanesPrecios(rows.filter((r) => String(r.plan_id) !== 'sms').map(toPlan))
        const smsRow = rows.find((r) => String(r.plan_id) === 'sms')
        if (smsRow) setPlanSms(toPlan(smsRow) as PlanConfigLanding)
      })
    return () => { mounted = false }
  }, [])

  const phoneFormatted = (() => {
    const d = phoneRaw.slice(0, 10)
    const part1 = d.slice(0, 3)
    const part2 = d.slice(3, 6)
    const part3 = d.slice(6, 10)
    if (d.length <= 3) return part1
    if (d.length <= 6) return `(${part1}) ${part2}`
    return `(${part1}) ${part2}-${part3}`
  })()

  const phoneIsValid = phoneRaw.length === 10

  /** Genera con IA un guion breve y natural para que la llamada demo suene más real */
  async function generateCallScript(description: string): Promise<string | null> {
    const key = import.meta.env.VITE_OPENROUTER_API_KEY
    if (!key?.trim() || !description?.trim()) return null
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Krone Demo',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-haiku',
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: `Eres un asistente que prepara guiones para llamadas de demostración de un agente de voz IA.

El usuario va a recibir una llamada demo. Solo tienes que generar un guion corto (2-4 frases en español) que el agente dirá al inicio para sonar natural y real, basado en esta descripción del negocio:

"${description.trim()}"

Reglas:
- Saludo breve y profesional.
- Presentar el negocio con las palabras del usuario (nombre, especialidad, etc.).
- Una frase que invite a la conversación (ej. "Te llamo para contarte cómo podemos ayudarte").
- Tono cercano pero profesional. Sin listas ni viñetas.
- Responde ÚNICAMENTE con el guion, sin comillas ni "Guion:" ni explicaciones.`,
            },
          ],
        }),
      })
      if (!res.ok) return null
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content?.trim?.()
      return text && text.length > 0 ? text : null
    } catch {
      return null
    }
  }

  type RealCallExample = {
    id: string
    emoji: string
    title: string
    badge: string
    badgeClass: string
    tipo: string
    nicho: string
    preview: string
    preGeneratedMessage: string
  }

  const REAL_CALL_EXAMPLES: RealCallExample[] = [
    {
      id: 'cold-water',
      emoji: '💧',
      title: 'Llamada en frío Agua',
      badge: 'Más popular',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30',
      tipo: 'Llamada en frío',
      nicho: 'Purificación de agua',
      preview: 'Detectamos niveles elevados en su área y queremos...',
      preGeneratedMessage:
        'Hola, le llamo de parte de Water Systems. Detectamos niveles elevados de contaminantes en su área y queremos ofrecerle un análisis de agua completamente gratuito en su hogar. ¿Tendría unos minutos para coordinar una visita sin ningún compromiso?',
    },
    {
      id: 'followup-cita',
      emoji: '📅',
      title: 'Seguimiento cita no confirmada',
      badge: 'Muy efectivo',
      badgeClass: 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30',
      tipo: 'Seguimiento',
      nicho: 'General',
      preview: 'Confirmar su cita del jueves a las 3pm...',
      preGeneratedMessage:
        'Hola, le llamo de Krone Services para confirmar su cita del jueves a las 3 de la tarde. ¿Sigue en pie o necesita reagendar? Solo toma un momento confirmarlo.',
    },
    {
      id: 'reactivate',
      emoji: '🔄',
      title: 'Reactivación cliente inactivo',
      badge: 'Alto ROI',
      badgeClass: 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/35',
      tipo: 'Reactivación',
      nicho: 'General',
      preview: 'Descuento especial del 15% por ser cliente...',
      preGeneratedMessage:
        'Hola, le llamo de Mi Negocio Latino. Ha pasado un tiempo desde su última visita y queremos ofrecerle un descuento especial del 15% en su próxima compra como agradecimiento por ser nuestro cliente. ¿Le interesa?',
    },
  ]

  function scrollToDemoForm() {
    demoFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function applyRealCallExample(ex: RealCallExample) {
    setBusinessDesc(ex.preGeneratedMessage.slice(0, 300))
    setDemoSelectedExampleId(ex.id)
    setDemoFromExample(true)
    setDemoAiGenerated(false)
    setDemoContextSnapshot('')
    scrollToDemoForm()
  }

  function handleBusinessDescChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value
    setBusinessDesc(next)
    if (demoFromExample && demoSelectedExampleId) {
      const ex = REAL_CALL_EXAMPLES.find((x) => x.id === demoSelectedExampleId)
      if (ex && next !== ex.preGeneratedMessage.slice(0, 300)) {
        setDemoFromExample(false)
        setDemoSelectedExampleId(null)
      }
    }
  }

  async function handleGenerateDemoWithAI() {
    if (!businessDesc.trim() || demoGenerateLoading) return
    setDemoGenerateLoading(true)
    try {
      const snapshot = businessDesc.trim()
      const script = await generateCallScript(snapshot)
      if (script) {
        setDemoContextSnapshot(snapshot)
        setBusinessDesc(script.slice(0, 300))
        setDemoAiGenerated(true)
        setDemoFromExample(false)
        setDemoSelectedExampleId(null)
      }
    } finally {
      setDemoGenerateLoading(false)
    }
  }

  async function handleRegenerateDemoMessage() {
    if (!demoContextSnapshot.trim() || demoGenerateLoading) return
    setDemoGenerateLoading(true)
    try {
      const script = await generateCallScript(demoContextSnapshot)
      if (script) {
        setBusinessDesc(script.slice(0, 300))
        setDemoAiGenerated(true)
      }
    } finally {
      setDemoGenerateLoading(false)
    }
  }

  async function handleDemoSubmit() {
    if (!phoneIsValid || demoLoading || !businessDesc.trim()) return
    setDemoLoading(true)
    setDemoSuccess(false)
    setDemoError(false)
    try {
      const trimmed = businessDesc.trim()
      const body = {
        phone: `+1${phoneRaw}`,
        agent_name: agentName,
        agent_gender: agentGender,
        business_description: trimmed,
        call_script: trimmed,
        demo: true,
      }
      const n8nUrl = getPublicWebhookBaseUrl()
      if (!n8nUrl) throw new Error('Falta configurar VITE_WEBHOOK_BASE_URL o el frontend debe correr en tu subdominio.')
      const res = await fetch(
        `${n8nUrl}/webhook/demo-call`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      )
      if (!res.ok) throw new Error('Respuesta no válida')
      setDemoSuccess(true)
    } catch {
      setDemoError(true)
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="min-h-screen theme-bg-page theme-text-primary font-sans antialiased">
      {/* ═══════════════════════════════════════════ */}
      {/* 1. NAVBAR */}
      {/* ═══════════════════════════════════════════ */}
      <header
        className={
          'sticky top-0 z-50 border-b transition-all duration-300 ' +
          (scrolled ? 'theme-border theme-navbar-bg backdrop-blur-xl' : 'border-transparent bg-transparent')
        }
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={KRONE_BRAND_ICON}
              alt="Krone"
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-zinc-700/50"
            />
            <span className="text-xl font-bold theme-text-primary">Krone</span>
            <span className="text-xl font-bold theme-accent-text">Agent AI</span>
            <span className="rounded theme-bg-elevated px-2 py-0.5 text-[10px] font-medium theme-text-muted">
              Voice Agents
            </span>
          </Link>

          <div className="hidden md:flex md:items-center md:gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium theme-text-muted hover:theme-text-primary transition"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex md:items-center md:gap-3">
            <ThemeToggle />
            <Link to="/login" className="text-sm font-medium theme-text-muted hover:theme-text-primary transition">
              Iniciar sesión
            </Link>
            <Link
              to="/login"
              className="rounded-lg theme-accent px-4 py-2 text-sm font-semibold theme-accent-contrast hover:opacity-90 transition"
            >
              Empezar gratis →
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 theme-text-muted hover:theme-bg-hover"
              aria-label="Menú"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </nav>

        {mobileMenuOpen && (
          <div className="border-t theme-border theme-bg-page px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium theme-text-muted hover:theme-text-primary"
                >
                  {link.label}
                </a>
              ))}
              <Link to="/login" className="text-sm font-medium theme-text-muted pt-2" onClick={() => setMobileMenuOpen(false)}>
                Iniciar sesión
              </Link>
              <Link
                to="/login"
                className="rounded-lg theme-accent py-2 text-center text-sm font-semibold theme-accent-contrast"
                onClick={() => setMobileMenuOpen(false)}
              >
                Empezar gratis →
              </Link>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ═══════════════════════════════════════════ */}
        {/* 2. HERO */}
        {/* ═══════════════════════════════════════════ */}
        <section className="relative overflow-hidden px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#22c55e]/40 bg-[#22c55e]/10 px-4 py-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22c55e]" />
                  </span>
                  <span className="text-xs font-semibold text-[#22c55e]">Agente disponible ahora</span>
                </div>
                <h1 className="text-5xl font-black leading-tight tracking-tight theme-text-primary md:text-6xl">
                  El vendedor que
                  <br />
                  nunca duerme,
                  <br />
                  nunca descansa
                  <br />
                  y siempre cierra.
                </h1>
                <p className="mt-4 max-w-lg text-lg theme-text-muted">
                  Automatiza tus llamadas de ventas en español e inglés. Tu agente llama, convence, maneja objeciones y agenda visitas — 24/7, sin supervisión humana.
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <a
                    href="#demo"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#22c55e] px-6 py-3.5 text-base font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
                  >
                    📞 Recibir llamada demo
                  </a>
                  <a
                    href="#como-funciona"
                    className="inline-flex items-center rounded-xl border border-zinc-600 px-6 py-3.5 text-base font-medium theme-text-muted hover:border-zinc-500 hover:theme-bg-elevated/50 transition"
                  >
                    Ver cómo funciona
                  </a>
                </div>
                <div className="mt-12 flex flex-wrap gap-8 border-t theme-border/80 pt-10">
                  <div>
                    <div className="text-2xl font-bold theme-text-primary">&lt; 1s</div>
                    <div className="text-xs theme-text-dim">latencia de voz</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold theme-text-primary">ES + EN</div>
                    <div className="text-xs theme-text-dim">bilingüe nativo</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold theme-text-primary">24/7</div>
                    <div className="text-xs theme-text-dim">sin días libres</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold theme-text-primary">+25</div>
                    <div className="text-xs theme-text-dim">nichos disponibles</div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="rounded-2xl border theme-border theme-bg-card p-4 shadow-2xl">
                  <div className="border-b theme-border/80 pb-3 text-sm font-semibold theme-text-muted">
                    Dashboard — Krone Agent AI
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-[#111111] p-3">
                      <div className="text-xs theme-text-dim">Llamadas hoy</div>
                      <div className="text-lg font-bold text-[#22c55e]">47</div>
                    </div>
                    <div className="rounded-lg bg-[#111111] p-3">
                      <div className="text-xs theme-text-dim">Citas agendadas</div>
                      <div className="text-lg font-bold theme-text-primary">12</div>
                    </div>
                    <div className="rounded-lg bg-[#111111] p-3">
                      <div className="text-xs theme-text-dim">Tasa contacto</div>
                      <div className="text-lg font-bold theme-text-primary">34%</div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end gap-1 h-16">
                    {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-[#22c55e]/80 transition-all"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    {['Maria G. — Contestó', 'Juan P. — Cita agendada', 'Ana L. — Voicemail'].map((label, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg bg-[#111111] px-3 py-2 text-xs">
                        <span className="theme-text-muted">{label}</span>
                        <span className="rounded-full bg-[#22c55e]/20 px-2 py-0.5 text-[10px] font-medium text-[#22c55e]">
                          {i === 0 ? 'Activo' : i === 1 ? 'Cita' : 'Pendiente'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════ */}
        {/* 3. DEMO EN VIVO */}
        {/* ═══════════════════════════════════════════ */}
        <section
          id="demo"
          className="border-y theme-border/50 bg-[#111111] px-4 py-20 sm:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-7xl">
            {/* Ejemplos de llamadas reales — encima del bloque demo */}
            <div className="mb-12">
              <h3 className="text-center text-2xl font-black tracking-tight text-zinc-100 md:text-3xl">
                Prueba con un ejemplo real
              </h3>
              <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-zinc-400 md:text-base">
                Haz click en cualquier ejemplo y llámalo en segundos
              </p>
              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
                {REAL_CALL_EXAMPLES.map((ex) => {
                  const selected = demoSelectedExampleId === ex.id
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => applyRealCallExample(ex)}
                      className={
                        'group flex w-full flex-col rounded-2xl border bg-[#0b0b0b] p-4 text-left transition ' +
                        (selected
                          ? 'border-[#22c55e] ring-2 ring-[#22c55e]/50'
                          : 'border-zinc-800 hover:border-[#22c55e]/70')
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-zinc-100">
                          {ex.emoji} {ex.title}
                        </span>
                        <span
                          className={
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ' + ex.badgeClass
                          }
                        >
                          {ex.badge}
                        </span>
                      </div>
                      <div className="my-3 h-px bg-zinc-800" />
                      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                        {ex.tipo}
                      </p>
                      <p className="mt-0.5 text-sm text-zinc-300">{ex.nicho}</p>
                      <p className="mt-3 flex-1 text-[13px] leading-snug text-zinc-500">
                        &quot;{ex.preview}&quot;
                      </p>
                      <span className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-[#22c55e]/15 py-2.5 text-xs font-semibold text-[#22c55e] ring-1 ring-[#22c55e]/30 group-hover:bg-[#22c55e]/25">
                        ⚡ Usar este ejemplo
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">
              {/* Columna izquierda: texto */}
              <div>
                <span className="inline-block rounded-full border border-[#22c55e]/40 bg-[#22c55e]/10 px-4 py-1.5 text-xs font-semibold text-[#22c55e]">
                  🎙️ Demo en vivo
                </span>
                <h2 className="mt-6 text-4xl font-black leading-tight theme-text-primary md:text-5xl">
                  Habla con nuestro agente ahora mismo
                </h2>
                <p className="mt-4 max-w-lg text-lg theme-text-muted">
                  Ingresa tu teléfono y recibirás una llamada real de nuestro agente de IA en menos de 30 segundos.
                </p>
                <ul className="mt-6 space-y-2 text-sm theme-text-muted">
                  <li>
                    <span className="mr-2 text-[#22c55e]">✅</span> Voz natural en español
                  </li>
                  <li>
                    <span className="mr-2 text-[#22c55e]">✅</span> Manejo de objeciones en vivo
                  </li>
                  <li>
                    <span className="mr-2 text-[#22c55e]">✅</span> Agenda una cita real
                  </li>
                  <li>
                    <span className="mr-2 text-[#22c55e]">✅</span> Menos de 30 segundos de espera
                  </li>
                </ul>
                <div className="mt-6 rounded-xl border theme-border/80 theme-bg-base px-4 py-3 text-sm theme-text-muted">
                  <p className="italic">
                    &quot;Pensé que era una persona real. Increíble.&quot;
                  </p>
                  <p className="mt-1 text-xs theme-text-dim">— Roberto G., Miami FL</p>
                </div>
              </div>

              {/* Columna derecha: formulario */}
              <div
                id="demo-form"
                ref={demoFormRef}
                className="rounded-2xl border theme-border theme-bg-card p-6"
              >
                <h3 className="text-lg font-semibold theme-text-primary">
                  Recibir llamada de demo
                </h3>
                <p className="mt-1 text-xs theme-text-dim">
                  Gratis · Sin registro · 30 segundos
                </p>
                <p className="mt-0.5 text-[11px] text-zinc-600">
                  Escribe qué debe decir la llamada; la IA mejorará tu mensaje para que suene natural.
                </p>

                <div className="mt-4 space-y-4">
                  {/* Campo 1: mensaje de la llamada */}
                  <div>
                    <label className="text-sm font-medium theme-text-muted">
                      Qué debe decir la llamada
                    </label>
                    <p className="mt-0.5 text-[11px] theme-text-dim">
                      Escribe en tus palabras el mensaje que quieres que el agente transmita. La IA lo mejorará para que suene natural al hablar.
                    </p>
                    <textarea
                      rows={4}
                      maxLength={300}
                      value={businessDesc}
                      onChange={handleBusinessDescChange}
                      placeholder="Ej: Que la Empresa X le desea un feliz cumpleaños y que Dios lo llene de bendiciones..."
                      className="mt-2 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 theme-border/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                    />
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] theme-text-dim">
                        {businessDesc.length} / 300
                      </span>
                      <button
                        type="button"
                        onClick={handleGenerateDemoWithAI}
                        disabled={demoGenerateLoading || !businessDesc.trim() || demoFromExample}
                        title={
                          demoFromExample
                            ? 'Edita el mensaje para salir del ejemplo y poder usar la IA'
                            : undefined
                        }
                        className="rounded-lg bg-[#22c55e]/20 px-3 py-1.5 text-xs font-semibold text-[#22c55e] hover:bg-[#22c55e]/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {demoGenerateLoading ? 'Generando...' : 'Generar con IA'}
                      </button>
                    </div>
                    {demoFromExample && (
                      <p className="mt-2 text-[11px] text-[#86efac]/90">
                        ✨ Ejemplo real — puedes editarlo
                      </p>
                    )}
                    {demoAiGenerated && (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] text-[#86efac]/90">
                          ✨ Mensaje generado por IA — puedes editarlo
                        </p>
                        <button
                          type="button"
                          onClick={handleRegenerateDemoMessage}
                          disabled={demoGenerateLoading || !demoContextSnapshot.trim()}
                          className="rounded-lg border border-zinc-600/80 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700/80 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          🔄 Regenerar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Campo 2: teléfono */}
                  <div>
                    <label className="text-sm theme-text-muted">
                      Tu número de teléfono (USA)
                    </label>
                    <div className="mt-1 flex items-center gap-2 rounded-lg theme-bg-base px-3 py-2 ring-1 theme-border/80 focus-within:ring-2 focus-within:ring-[#22c55e]">
                      <span className="text-sm theme-text-dim">+1</span>
                      <input
                        type="tel"
                        value={phoneFormatted}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                          setPhoneRaw(digits)
                        }}
                        placeholder="(555) 000-0000"
                        className="w-full bg-transparent text-sm text-zinc-100 outline-none"
                      />
                    </div>
                    {!phoneIsValid && phoneRaw.length > 0 && (
                      <p className="mt-1 text-[11px] text-red-300">
                        Ingresa 10 dígitos válidos para un número de USA.
                      </p>
                    )}
                  </div>

                  {/* Campo 3: nombre del agente */}
                  <div>
                    <div className="text-sm theme-text-muted">Nombre del agente</div>
                    <div className="mt-1 inline-flex rounded-full theme-bg-base p-1 ring-1 theme-border/80">
                      <button
                        type="button"
                        onClick={() => {
                          setAgentName('Sofia')
                          setAgentGender('femenino')
                        }}
                        className={
                          'px-3 py-1 text-xs font-medium rounded-full ' +
                          (agentName === 'Sofia'
                            ? 'bg-[#22c55e] text-[#0b0b0b]'
                            : 'theme-text-muted hover:theme-bg-elevated/60')
                        }
                      >
                        👩 Sofia
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAgentName('Alex')
                          setAgentGender('masculino')
                        }}
                        className={
                          'px-3 py-1 text-xs font-medium rounded-full ' +
                          (agentName === 'Alex'
                            ? 'bg-[#22c55e] text-[#0b0b0b]'
                            : 'theme-text-muted hover:theme-bg-elevated/60')
                        }
                      >
                        👨 Alex
                      </button>
                    </div>
                  </div>

                  {/* Campo 4: voz */}
                  <div>
                    <div className="text-sm theme-text-muted">Voz</div>
                    <div className="mt-1 inline-flex rounded-full theme-bg-base p-1 ring-1 theme-border/80">
                      <button
                        type="button"
                        onClick={() => setAgentGender('femenino')}
                        className={
                          'px-3 py-1 text-xs font-medium rounded-full ' +
                          (agentGender === 'femenino'
                            ? 'bg-zinc-200 text-[#0b0b0b]'
                            : 'theme-text-muted hover:theme-bg-elevated/60')
                        }
                      >
                        🎵 Femenina
                      </button>
                      <button
                        type="button"
                        onClick={() => setAgentGender('masculino')}
                        className={
                          'px-3 py-1 text-xs font-medium rounded-full ' +
                          (agentGender === 'masculino'
                            ? 'bg-zinc-200 text-[#0b0b0b]'
                            : 'theme-text-muted hover:theme-bg-elevated/60')
                        }
                      >
                        🎵 Masculina
                      </button>
                    </div>
                  </div>

                  {/* Botón y estados */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleDemoSubmit}
                      disabled={!phoneIsValid || demoLoading || !businessDesc.trim()}
                      className={
                        'inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ' +
                        (demoLoading || !phoneIsValid || !businessDesc.trim()
                          ? 'bg-[#22c55e] text-[#0b0b0b] opacity-60'
                          : (demoAiGenerated || demoFromExample) && phoneIsValid
                            ? 'bg-[#22c55e] text-[#0b0b0b] shadow-lg shadow-[#22c55e]/40 ring-2 ring-[#86efac] hover:bg-[#4ade80]'
                            : 'bg-[#22c55e] text-[#0b0b0b] hover:bg-[#1fb455]')
                      }
                    >
                      {demoLoading ? (
                        <>
                          <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-[#0b0b0b] border-b-transparent" />
                          Conectando con el agente...
                        </>
                      ) : (
                        <>📞 Llamarme ahora →</>
                      )}
                    </button>

                    {demoSuccess && (
                      <div className="rounded-lg border border-emerald-400/40 bg-emerald-400/15 px-3 py-2 text-xs text-emerald-200">
                        ✅ ¡Llamada en camino! Contesta en los próximos 30 segundos.
                      </div>
                    )}
                    {demoError && (
                      <div className="rounded-lg border border-red-400/40 bg-red-400/15 px-3 py-2 text-xs text-red-200">
                        ❌ Error al conectar. Intenta de nuevo.
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] theme-text-dim">
                    Al solicitar la demo aceptas recibir una llamada de prueba. Solo números de
                    USA.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>



        {/* ═══════════════════════════════════════════ */}
        {/* 4. LOGOS CLIENTES */}
        {/* ═══════════════════════════════════════════ */}
        <section className="border-y theme-border/50 bg-[#111111] py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm theme-text-dim">Negocios que ya automatizan sus ventas</p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold theme-text-dim">
              {LOGOS.map((name, i) => (
                <span key={name} className="flex items-center gap-4">
                  {name}
                  {i < LOGOS.length - 1 ? <span className="text-zinc-600">·</span> : null}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════ */}
        {/* 5. SOLUCIONES */}
        {/* ═══════════════════════════════════════════ */}
        <section id="soluciones" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-center text-3xl font-bold tracking-tight theme-text-primary md:text-4xl">
              Una solución para cada momento del ciclo de ventas
            </h2>
            <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2">
              {SOLUCIONES.map((s) => (
                <div
                  key={s.title}
                  className={`rounded-2xl border theme-border/80 theme-bg-card p-6 ${s.bgClass}`}
                >
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${s.badgeClass}`}>
                    {s.badge}
                  </span>
                  <div className="mt-4 text-4xl">{s.icon}</div>
                  <h3 className="mt-3 text-xl font-bold theme-text-primary">{s.title}</h3>
                  <p className="mt-2 text-sm theme-text-muted">{s.description}</p>
                  <ul className="mt-4 space-y-1 text-xs theme-text-dim">
                    {s.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <span className="text-[#22c55e]">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={s.href}
                    className="mt-4 inline-block text-sm font-medium text-[#22c55e] hover:underline"
                  >
                    {s.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════ */}
        {/* 6. CASOS DE USO */}
        {/* ═══════════════════════════════════════════ */}
        <section id="casos" className="border-t theme-border/50 bg-[#111111] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-center text-3xl font-bold tracking-tight theme-text-primary md:text-4xl">
              Para cualquier negocio que vende en USA
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-center theme-text-muted">
              +25 nichos preconfigurados. Listo para usar en minutos.
            </p>
            <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3">
              {CASOS_USO.map((c) => (
                <div
                  key={c.name}
                  className="rounded-xl border theme-border/80 theme-bg-card p-4 transition hover:border-zinc-600 hover:theme-bg-elevated/50"
                >
                  <div className="text-3xl">{c.emoji}</div>
                  <div className="mt-2 text-sm font-semibold theme-text-primary">{c.name}</div>
                  <div className="mt-1 text-xs theme-text-dim">{c.desc}</div>
                </div>
              ))}
            </div>
            <p className="mt-8 text-center text-sm theme-text-dim">
              ¿Tu nicho no está aquí?{' '}
              <Link to="/login" className="font-medium text-[#22c55e] hover:underline">
                Configura uno personalizado en minutos →
              </Link>
            </p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════ */}
        {/* 7. CÓMO FUNCIONA */}
        {/* ═══════════════════════════════════════════ */}
        <section id="como-funciona" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-center text-3xl font-bold tracking-tight theme-text-primary md:text-4xl">
              De cero a llamadas en 15 minutos
            </h2>
            <div className="mt-14 flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-4">
              {PASOS.map((p, i) => (
                <div key={p.title} className="relative flex flex-1 flex-col">
                  <div className="flex flex-col items-center rounded-2xl border theme-border/80 theme-bg-card p-6 text-center">
                    <div className="text-2xl font-black text-[#22c55e]">{p.num}</div>
                    <div className="mt-2 text-sm font-bold theme-text-primary">{p.title}</div>
                    <p className="mt-2 text-xs theme-text-dim">{p.desc}</p>
                  </div>
                  {i < PASOS.length - 1 && (
                    <div className="hidden flex-1 items-center lg:flex">
                      <div className="h-0.5 w-full bg-gradient-to-r from-[#22c55e]/60 to-transparent" />
                    </div>
                  )}
                  {i < PASOS.length - 1 && (
                    <div className="flex justify-center py-2 lg:hidden">
                      <div className="h-4 w-0.5 bg-[#22c55e]/50" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Precios */}
        <section id="precios" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold theme-text-primary md:text-4xl">
                Precios simples
              </h2>
              <p className="mt-4 theme-text-muted">
                Paga solo por los minutos que usas. Sin contratos ni sorpresas.
              </p>
            </div>

            <div className="mt-8 flex justify-center">
              <div className="inline-flex rounded-full theme-bg-base p-1 ring-1 theme-border/80">
                <button
                  type="button"
                  onClick={() => setPricingTab('voz')}
                  className={
                    'px-4 py-1.5 text-xs font-medium rounded-full ' +
                    (pricingTab === 'voz'
                      ? 'bg-[#22c55e] text-[#0b0b0b]'
                      : 'theme-text-muted hover:theme-bg-elevated/60')
                  }
                >
                  🎙️ Voz
                </button>
                <button
                  type="button"
                  onClick={() => setPricingTab('sms')}
                  className={
                    'px-4 py-1.5 text-xs font-medium rounded-full ' +
                    (pricingTab === 'sms'
                      ? 'bg-[#22c55e] text-[#0b0b0b]'
                      : 'theme-text-muted hover:theme-bg-elevated/60')
                  }
                >
                  💬 SMS
                </button>
              </div>
            </div>

            {pricingTab === 'voz' ? (
              <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
                {planesPrecios.map((plan) => {
                  const isPopular = plan.plan_id === 'vendedor'
                  const ctaText =
                    plan.plan_id === 'prospectador'
                      ? 'Empezar gratis'
                      : plan.plan_id === 'vendedor'
                        ? 'Comenzar ahora'
                        : 'Hablar con ventas'
                  const features = plan.features ?? []

                  return (
                    <div
                      key={plan.plan_id}
                      className={`relative flex flex-col rounded-2xl border p-6 ${
                        isPopular
                          ? 'border-[#f97316]/70 bg-[#111111] ring-1 ring-[#f97316]/30'
                          : 'theme-border/80 theme-bg-card'
                      }`}
                    >
                      {isPopular && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#f97316] px-3 py-1 text-[10px] font-semibold text-[#0b0b0b]">
                          Más Popular
                        </span>
                      )}
                      <div className="mt-1">
                        <h3 className="text-lg font-semibold theme-text-primary">
                          {plan.emoji ?? ''} {plan.nombre}
                        </h3>
                        <div className="mt-4 flex items-baseline gap-1">
                          <span className="text-3xl font-bold theme-text-primary">
                            ${plan.precio_por_minuto.toFixed(2)}
                          </span>
                          <span className="text-xs theme-text-dim">/minuto</span>
                        </div>
                      </div>
                      <ul className="mt-4 space-y-1 text-xs theme-text-muted">
                        {features.map((f, i) => (
                          <li key={i}>✅ {f}</li>
                        ))}
                      </ul>
                      <Link
                        to="/login"
                        className={
                          isPopular
                            ? 'mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#f97316] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#ea6a0f] transition'
                            : 'mt-6 inline-flex w-full items-center justify-center rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:theme-bg-elevated/60 transition'
                        }
                      >
                        {ctaText}
                      </Link>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="mt-12 flex justify-center">
                <div className="w-full max-w-sm rounded-2xl border theme-border theme-bg-card p-6 text-center">
                  <h3 className="text-lg font-semibold theme-text-primary">
                    {planSms.emoji ?? '💬'} {planSms.nombre}
                  </h3>
                  <div className="mt-3 flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold theme-text-primary">
                      ${planSms.precio_por_minuto.toFixed(2)}
                    </span>
                    <span className="text-xs theme-text-dim">/mensaje</span>
                  </div>
                  <ul className="mt-4 space-y-1 text-xs theme-text-muted text-left">
                    {(planSms.features ?? []).map((f, i) => (
                      <li key={i}>✅ {f}</li>
                    ))}
                  </ul>
                  <Link
                    to="/login"
                    className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
                  >
                    Empezar gratis
                  </Link>
                </div>
              </div>
            )}

            <p className="mt-10 text-center text-sm theme-text-dim">
              💳 Ingresa ya tu número de teléfono y prueba nuestra demo.
            </p>
          </div>
        </section>

        {/* Testimonios */}
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-center text-3xl font-bold tracking-tight theme-text-primary md:text-4xl">
              Resultados reales
            </h2>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-2xl border theme-border/80 theme-bg-card p-6">
                <div className="text-sm text-yellow-400">⭐⭐⭐⭐⭐</div>
                <p className="mt-3 text-sm theme-text-muted">
                  &quot;Pasamos de 20 citas semanales a más de 80 sin contratar más
                  personal.&quot;
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-300">
                    CM
                  </div>
                  <div className="text-xs">
                    <div className="font-semibold theme-text-primary">Carlos M.</div>
                    <div className="theme-text-dim">
                      Empresa de Agua — Miami, FL
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border theme-border/80 theme-bg-card p-6">
                <div className="text-sm text-yellow-400">⭐⭐⭐⭐⭐</div>
                <p className="mt-3 text-sm theme-text-muted">
                  &quot;El agente habla mejor español que muchos de mis empleados.
                  Increíble naturalidad.&quot;
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/20 text-sm font-semibold text-sky-300">
                    AR
                  </div>
                  <div className="text-xs">
                    <div className="font-semibold theme-text-primary">Ana R.</div>
                    <div className="theme-text-dim">
                      Clínica Dental — Houston, TX
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border theme-border/80 theme-bg-card p-6">
                <div className="text-sm text-yellow-400">⭐⭐⭐⭐⭐</div>
                <p className="mt-3 text-sm theme-text-muted">
                  &quot;En 2 semanas recuperé la inversión. El ROI es impresionante.&quot;
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20 text-sm font-semibold text-orange-300">
                    MS
                  </div>
                  <div className="text-xs">
                    <div className="font-semibold theme-text-primary">Miguel S.</div>
                    <div className="theme-text-dim">
                      Roofing Contractor — Orlando, FL
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="border-t border-[#22c55e]/20 bg-gradient-to-b from-[#0b0b0b] to-[#0f1a0f] px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-4xl font-black tracking-tight theme-text-primary md:text-5xl">
              ¿Listo para automatizar tus ventas?
            </h2>
            <p className="mt-4 text-sm theme-text-muted md:text-base">
              Únete a negocios en USA que ya usan Krone Agent AI para generar más citas
              sin más vendedores.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-xl bg-[#22c55e] px-8 py-4 text-base font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
              >
                Crear cuenta gratis →
              </Link>
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById('demo')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
                className="inline-flex items-center justify-center rounded-xl border border-zinc-600 px-8 py-4 text-base font-semibold theme-text-muted hover:theme-bg-elevated/50 transition"
              >
                📞 Probar demo ahora
              </button>
            </div>
            <p className="mt-4 text-xs theme-text-dim">
              Sin tarjeta de crédito · 30 min gratis · Cancela cuando quieras
            </p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t theme-border/80 theme-bg-page px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2">
              <span className="font-bold theme-text-primary">Krone</span>
              <span className="font-bold text-[#22c55e]">Agent AI</span>
            </div>
            <div className="flex gap-8 text-sm theme-text-dim">
              <a href="#soluciones" className="hover:theme-text-primary transition">Soluciones</a>
              <a href="#casos" className="hover:theme-text-primary transition">Casos de uso</a>
              <a href="#demo" className="hover:theme-text-primary transition">Demo</a>
              <Link to="/login" className="hover:theme-text-primary transition">Iniciar sesión</Link>
            </div>
          </div>
          <p className="mx-auto mt-8 max-w-7xl text-center text-xs text-zinc-600">
            © {new Date().getFullYear()} Krone Agent AI. Voice agents para ventas en USA.
          </p>
        </footer>
      </main>
    </div>
  )
}
