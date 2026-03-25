import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type NichoFromDb = {
  nicho: string
  nicho_problema: string | null
}

const NICHO_EMOJI: Record<string, string> = {
  agua: '💧',
  roofing: '🏠',
  siding: '🏗️',
  solar: '☀️',
  pest_control: '🐛',
  hvac: '❄️',
  windows: '🪟',
  insulation: '🏡',
  remodeling: '🔨',
  dental: '🦷',
  optometria: '👁️',
  medico_primario: '🩺',
  quiropráctico: '💆',
  itin_taxes: '📋',
  seguros_inmigrantes: '🛡️',
  remesas: '💸',
  inmigracion: '🌎',
  credito: '💳',
  real_estate_compra: '🏡',
  real_estate_venta: '💰',
  gym: '💪',
  nutricion: '🥗',
  auto_insurance: '🚗',
  autos: '🚙',
  ingles: '🇺🇸',
  internet: '📶',
  otro: '✏️',
}

function getNichoEmoji(nicho: string): string {
  return NICHO_EMOJI[nicho.toLowerCase()] ?? '✏️'
}

type NichoTemplate = {
  nicho: string
  nicho_problema: string
  nicho_contexto: string
  nicho_objetivo: string
  nicho_apertura: string
  nicho_pregunta_gancho: string
  nicho_oferta: string
  nicho_objecion_1: string
  nicho_objecion_ya_tiene: string
  nicho_urgencia: string
  nicho_urgencia_alta: string
  nicho_ultimo_intento: string
  nicho_descripcion_empresa: string
  nicho_contexto_corto: string
  objeciones_nicho_extra: string
  buyer_persona: string
  buyer_ingresos: string
  buyer_situacion: string
  buyer_edad: string
  buyer_hijos: boolean
  buyer_calificacion: string
  buyer_descripcion: string
}

const TEMPLATE_FIELDS: { key: keyof NichoTemplate; label: string }[] = [
  { key: 'nicho_problema', label: 'Problema que resuelves' },
  { key: 'nicho_contexto', label: 'Contexto de la zona' },
  { key: 'nicho_objetivo', label: 'Objetivo de la visita' },
  { key: 'nicho_apertura', label: 'Frase de apertura' },
  { key: 'nicho_pregunta_gancho', label: 'Pregunta gancho' },
  { key: 'nicho_oferta', label: 'Oferta gratuita' },
  { key: 'nicho_objecion_1', label: 'Objeción principal' },
  { key: 'nicho_objecion_ya_tiene', label: 'Objeción "ya tengo"' },
  { key: 'nicho_urgencia', label: 'Urgencia' },
  { key: 'nicho_urgencia_alta', label: 'Urgencia alta' },
  { key: 'nicho_ultimo_intento', label: 'Último intento' },
  { key: 'nicho_descripcion_empresa', label: 'Descripción empresa' },
  { key: 'nicho_contexto_corto', label: 'Contexto corto' },
  { key: 'objeciones_nicho_extra', label: 'Objeciones extra (opcional)' },
  { key: 'buyer_descripcion', label: 'Descripción del cliente ideal' },
  { key: 'buyer_calificacion', label: 'Pregunta de calificación del agente' },
]

const INGRESOS_OPTIONS = [
  'Menos de $3,000/mes',
  '$3,000 - $6,000/mes',
  '$6,000 - $10,000/mes',
  'Más de $10,000/mes',
  'No es relevante',
]

const EDAD_OPTIONS = [
  '18-30 años',
  '25-45 años',
  '35-55 años',
  '45-65 años',
  'Cualquier edad',
]

const SITUACION_OPTIONS = [
  'Dueño de casa',
  'Arrendatario',
  'Ambos',
  'No es relevante',
]

const REF_STORAGE_KEY = 'krone_ref'

export default function Onboarding() {
  const navigate = useNavigate()
  const [refCode, setRefCode] = useState<string | null>(null)

  const [loadingInitial, setLoadingInitial] = useState(true)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [companyName, setCompanyName] = useState('')
  const [nicho, setNicho] = useState<string | null>(null)
  const [customNicho, setCustomNicho] = useState('')
  const [nichosFromDb, setNichosFromDb] = useState<NichoFromDb[]>([])
  const [loadingNichos, setLoadingNichos] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Paso 3 — preguntas negocio
  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  const [q3, setQ3] = useState('')
  const [q4, setQ4] = useState('')

  // Paso 4 — buyer persona
  const [bpIngresos, setBpIngresos] = useState('')
  const [bpSituacion, setBpSituacion] = useState('')
  const [bpEdad, setBpEdad] = useState('')
  const [bpHijos, setBpHijos] = useState<boolean | null>(null)
  const [bpOtras, setBpOtras] = useState('')

  // Paso 5 — template generado
  const [template, setTemplate] = useState<NichoTemplate | null>(null)

  const totalSteps = 5

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref') || sessionStorage.getItem(REF_STORAGE_KEY)
    if (ref) {
      setRefCode(ref)
      sessionStorage.setItem(REF_STORAGE_KEY, ref)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function checkOnboarding() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw new Error(sessionError.message)
        const userId = session?.user?.id
        if (!userId) { navigate('/login', { replace: true }); return }
        const { data: userRow, error: userError } = await supabase
          .from('users').select('company_name, nicho, onboarding_completado').eq('id', userId).maybeSingle()
        if (userError) throw userError
        if (!mounted) return
        if (userRow?.company_name) setCompanyName(userRow.company_name)
        if (userRow?.nicho || userRow?.onboarding_completado) { navigate('/dashboard', { replace: true }); return }
      } catch { /* dejamos seguir */ } finally {
        if (mounted) setLoadingInitial(false)
      }
    }
    void checkOnboarding()
    return () => { mounted = false }
  }, [navigate])

  useEffect(() => {
    if (step !== 2) return
    let mounted = true
    setLoadingNichos(true)
    supabase
      .from('nicho_templates')
      .select('nicho, nicho_problema')
      .order('nicho')
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) { setNichosFromDb([]); return }
        const list = (data ?? []) as NichoFromDb[]
        const sinOtro = list.filter((r) => r.nicho.toLowerCase() !== 'otro')
        const otroRow = list.find((r) => r.nicho.toLowerCase() === 'otro')
        setNichosFromDb([...sinOtro, ...(otroRow ? [otroRow] : [{ nicho: 'otro', nicho_problema: 'Otro' }])])
      })
      .finally(() => { if (mounted) setLoadingNichos(false) })
    return () => { mounted = false }
  }, [step])

  async function handleContinue() {
    setError(null)
    if (!companyName.trim()) { setError('Por favor escribe el nombre de tu empresa.'); return }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error('No hay sesión activa.')
      await supabase.from('users').update({ company_name: companyName.trim() }).eq('id', userId)
      setStep(2)
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al guardar la empresa.') }
  }

  async function handleNichoSelected() {
    setError(null)
    if (!nicho) { setError('Selecciona un nicho para continuar.'); return }
    if (nicho.toLowerCase() === 'otro') {
      if (!customNicho.trim()) { setError('Escribe el nombre de tu nicho.'); return }
      setStep(3)
      return
    }
    setSaving(true)
    try {
      await saveUserNicho(nicho)
    } finally { setSaving(false) }
  }

  async function saveReferralIfRef(referredUserId: string) {
    if (!refCode?.trim()) return
    try {
      const { data: referrer } = await supabase.from('users').select('id').eq('referral_code', refCode.trim()).maybeSingle()
      if (!referrer?.id) return
      await supabase.from('users').update({ referred_by: referrer.id }).eq('id', referredUserId)
      await supabase.from('referrals').upsert(
        { referrer_id: referrer.id, referred_id: referredUserId, status: 'pending' },
        { onConflict: 'referred_id' }
      )
      sessionStorage.removeItem(REF_STORAGE_KEY)
    } catch {
      // silencioso
    }
  }

  async function saveUserNicho(nichoKey: string) {
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error('No hay sesión activa.')
      await saveReferralIfRef(userId)
      await supabase.from('users').update({ nicho: nichoKey, onboarding_completado: true }).eq('id', userId)
      navigate('/dashboard', { replace: true })
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al guardar.') }
    finally { setSaving(false) }
  }

  async function handleGenerateTemplate() {
    setError(null)
    if (!bpIngresos || !bpSituacion || !bpEdad || bpHijos === null) {
      setError('Por favor completa todos los campos del cliente ideal.')
      return
    }
    const nichoLabel = (nicho?.toLowerCase() === 'otro' ? customNicho.trim() : nicho) ?? ''
    const nichoKey = nicho?.toLowerCase() === 'otro' ? customNicho.trim().toLowerCase().replace(/\s+/g, '_') : (nicho ?? '')
    const buyerPersonaDesc = `${bpSituacion}, ingresos ${bpIngresos}, edad ${bpEdad}, ${bpHijos ? 'con hijos' : 'sin hijos'}${bpOtras ? `, ${bpOtras}` : ''}`

    setGenerating(true)
    try {
      const prompt = `Eres un experto en ventas B2C y agentes de voz con IA para llamadas outbound en español latino.

Un cliente tiene una empresa en el nicho de "${nichoLabel}":
- Empresa: ${companyName}
- Problema que resuelven: ${q1}
- Oferta gratuita: ${q2}
- Mayor objeción: ${q3}
- Descripción empresa: ${q4}

Cliente ideal (buyer persona):
- Situación del hogar: ${bpSituacion}
- Ingresos: ${bpIngresos}
- Edad: ${bpEdad}
- Tiene hijos: ${bpHijos ? 'Sí' : 'No'}
- Otras características: ${bpOtras || 'No especificadas'}

Genera variables para un agente de voz outbound en español. El agente debe:
1. Calificar al prospecto según el buyer persona
2. Si no cumple el perfil, terminar amablemente
3. Usar frases naturales, no de script

Responde ÚNICAMENTE con JSON válido sin markdown:
{
  "nicho_problema": "problema del prospecto en 1 oración",
  "nicho_contexto": "contexto del problema en su área",
  "nicho_objetivo": "qué se ofrece gratis",
  "nicho_apertura": "frase de apertura natural",
  "nicho_pregunta_gancho": "pregunta que genera curiosidad",
  "nicho_oferta": "descripción detallada de la oferta",
  "nicho_objecion_1": "respuesta a no me interesa con Brian Tracy",
  "nicho_objecion_ya_tiene": "respuesta a ya tengo solución",
  "nicho_urgencia": "razón de urgencia",
  "nicho_urgencia_alta": "razón emocional de urgencia",
  "nicho_ultimo_intento": "frase para último intento",
  "nicho_descripcion_empresa": "descripción breve empresa",
  "nicho_contexto_corto": "contexto muy corto máx 5 palabras",
  "objeciones_nicho_extra": "",
  "buyer_descripcion": "descripción del cliente ideal para que el agente lo identifique",
  "buyer_calificacion": "pregunta natural para calificar si cumple el perfil"
}`

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Krone Agent AI',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-haiku-4-5',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content ?? ''
      const clean = content.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(clean)

      setTemplate({
        nicho: nichoKey,
        ...parsed,
        buyer_ingresos: bpIngresos,
        buyer_situacion: bpSituacion,
        buyer_edad: bpEdad,
        buyer_hijos: bpHijos,
        buyer_persona: buyerPersonaDesc,
      })
      setStep(5)
    } catch (e) {
      setError('Error al generar el template. Intenta de nuevo.')
      console.error(e)
    } finally { setGenerating(false) }
  }

  async function handleConfirmTemplate() {
    if (!template) return
    setSaving(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error('No hay sesión activa.')
      await saveReferralIfRef(userId)
      await supabase.from('nicho_templates').insert(template)
      await supabase.from('users').update({ nicho: template.nicho, onboarding_completado: true }).eq('id', userId)
      navigate('/dashboard', { replace: true })
    } catch (e) { setError(e instanceof Error ? e.message : 'Error al guardar.') }
    finally { setSaving(false) }
  }

  if (loadingInitial) {
    return (
      <div className="min-h-screen theme-bg-base text-zinc-100 flex items-center justify-center">
        <div className="text-sm theme-text-muted">Preparando tu experiencia...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen theme-bg-base text-zinc-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-2xl rounded-2xl border theme-border/80 bg-[#141414] px-6 py-7 shadow-[0_0_0_1px_rgba(34,197,94,0.08)]">
        {refCode && (
          <div className="mb-4 rounded-xl border border-[#22c55e]/40 bg-[#22c55e]/10 px-4 py-3 text-sm text-[#22c55e]">
            ✅ Fuiste referido por un usuario de Krone Agent AI. Ambos ganarán créditos cuando uses la plataforma.
          </div>
        )}
        <div className="mb-6">
          <div className="text-sm font-semibold tracking-tight text-[#22c55e]">Krone Agent AI</div>
          <div className="mt-1 text-xs text-zinc-500">Paso {step} de {totalSteps} · Configuraremos tu agente en menos de 2 minutos.</div>
          <div className="mt-3 h-1 w-full rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-[#22c55e] transition-all" style={{ width: `${(step / totalSteps) * 100}%` }} />
          </div>
        </div>

        {/* Paso 1 */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">Bienvenido a Krone Agent AI</h1>
              <p className="mt-2 text-sm theme-text-muted">Antes de comenzar, cuéntanos sobre tu negocio.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="companyName" className="text-sm theme-text-muted">¿Cómo se llama tu empresa?</label>
              <input id="companyName" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
                className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                placeholder="Ej. Krone Water Solutions" />
            </div>
            {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
            <div className="flex justify-end">
              <button type="button" onClick={handleContinue} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition">Continuar →</button>
            </div>
          </div>
        )}

        {/* Paso 2 */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">¿En qué industria trabajas?</h1>
              <p className="mt-2 text-sm theme-text-muted">Personalizaremos tu agente de voz para tu sector.</p>
            </div>
            {loadingNichos ? (
              <div className="py-8 text-center text-sm text-zinc-500">Cargando nichos...</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {nichosFromDb.map((n) => {
                  const isSelected = nicho === n.nicho
                  const label = n.nicho_problema?.trim() || n.nicho.replace(/_/g, ' ')
                  return (
                    <button
                      key={n.nicho}
                      type="button"
                      onClick={() => setNicho(n.nicho)}
                      className={['text-left rounded-2xl border p-4 transition', isSelected ? 'border-[#22c55e] theme-bg-base shadow-[0_0_0_1px_rgba(34,197,94,0.25)]' : 'theme-border/80 theme-bg-base hover:bg-zinc-900/40'].join(' ')}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-xl">{getNichoEmoji(n.nicho)}</div>
                        <div className="text-sm font-semibold theme-text-primary">{label}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {nicho?.toLowerCase() === 'otro' && (
              <div className="space-y-2">
                <label htmlFor="customNicho" className="text-sm theme-text-muted">Especifica tu nicho</label>
                <input id="customNicho" type="text" value={customNicho} onChange={(e) => setCustomNicho(e.target.value)}
                  className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  placeholder="Ej. Paneles solares B2C" />
              </div>
            )}
            {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(1)} className="rounded-lg px-4 py-2 text-sm theme-text-muted hover:theme-text-primary transition">← Atrás</button>
              <button type="button" onClick={handleNichoSelected} disabled={saving || loadingNichos} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition">
                {saving ? 'Guardando...' : 'Continuar →'}
              </button>
            </div>
          </div>
        )}

        {/* Paso 3 — Preguntas negocio */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">Cuéntanos sobre tu negocio</h1>
              <p className="mt-2 text-sm theme-text-muted">Esta información le dará contexto a tu agente de voz.</p>
            </div>
            <div className="space-y-4">
              {[
                { label: '¿Qué problema resuelves para tus clientes?', value: q1, set: setQ1, placeholder: 'Ej. Alta contaminación en el agua del grifo' },
                { label: '¿Qué ofreces gratis para enganchar al prospecto?', value: q2, set: setQ2, placeholder: 'Ej. Análisis de agua gratuito en el hogar' },
                { label: '¿Cuál es la objeción más común que recibes?', value: q3, set: setQ3, placeholder: 'Ej. No me interesa / No tengo tiempo' },
                { label: '¿Cómo describes tu empresa en una frase?', value: q4, set: setQ4, placeholder: 'Ej. Empresa especializada en calidad del agua potable' },
              ].map((q, i) => (
                <div key={i}>
                  <label className="text-sm theme-text-muted">{q.label}</label>
                  <input type="text" value={q.value} onChange={(e) => q.set(e.target.value)}
                    className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    placeholder={q.placeholder} />
                </div>
              ))}
            </div>
            {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(2)} className="rounded-lg px-4 py-2 text-sm theme-text-muted hover:theme-text-primary transition">← Atrás</button>
              <button type="button" onClick={() => {
                if (!q1.trim() || !q2.trim() || !q3.trim() || !q4.trim()) { setError('Por favor responde todas las preguntas.'); return }
                setError(null); setStep(4)
              }} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition">
                Continuar →
              </button>
            </div>
          </div>
        )}

        {/* Paso 4 — Buyer Persona */}
        {step === 4 && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">¿Quién es tu cliente ideal?</h1>
              <p className="mt-2 text-sm theme-text-muted">Tu agente usará este perfil para calificar prospectos durante la llamada.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm theme-text-muted">Situación del hogar</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SITUACION_OPTIONS.map((op) => (
                    <button key={op} type="button" onClick={() => setBpSituacion(op)}
                      className={['rounded-full px-3 py-1.5 text-xs font-medium transition border', bpSituacion === op ? 'border-[#22c55e] bg-[#22c55e]/15 text-[#22c55e]' : 'border-zinc-700 theme-text-muted hover:border-zinc-500'].join(' ')}>
                      {op}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm theme-text-muted">Rango de ingresos mensual</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {INGRESOS_OPTIONS.map((op) => (
                    <button key={op} type="button" onClick={() => setBpIngresos(op)}
                      className={['rounded-full px-3 py-1.5 text-xs font-medium transition border', bpIngresos === op ? 'border-[#22c55e] bg-[#22c55e]/15 text-[#22c55e]' : 'border-zinc-700 theme-text-muted hover:border-zinc-500'].join(' ')}>
                      {op}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm theme-text-muted">Rango de edad</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {EDAD_OPTIONS.map((op) => (
                    <button key={op} type="button" onClick={() => setBpEdad(op)}
                      className={['rounded-full px-3 py-1.5 text-xs font-medium transition border', bpEdad === op ? 'border-[#22c55e] bg-[#22c55e]/15 text-[#22c55e]' : 'border-zinc-700 theme-text-muted hover:border-zinc-500'].join(' ')}>
                      {op}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm theme-text-muted">¿Tiene hijos en casa?</label>
                <div className="mt-2 flex gap-3">
                  {[{ label: 'Sí, preferiblemente', value: true }, { label: 'No es relevante', value: false }].map((op) => (
                    <button key={op.label} type="button" onClick={() => setBpHijos(op.value)}
                      className={['rounded-full px-4 py-1.5 text-xs font-medium transition border', bpHijos === op.value ? 'border-[#22c55e] bg-[#22c55e]/15 text-[#22c55e]' : 'border-zinc-700 theme-text-muted hover:border-zinc-500'].join(' ')}>
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm theme-text-muted">Otras características <span className="text-zinc-500">(opcional)</span></label>
                <input type="text" value={bpOtras} onChange={(e) => setBpOtras(e.target.value)}
                  className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  placeholder="Ej. Vive en casa unifamiliar, mascotas en casa..." />
              </div>
            </div>
            {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(3)} className="rounded-lg px-4 py-2 text-sm theme-text-muted hover:theme-text-primary transition">← Atrás</button>
              <button type="button" onClick={handleGenerateTemplate} disabled={generating}
                className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition">
                {generating ? '✨ Generando tu agente...' : '✨ Generar agente con IA →'}
              </button>
            </div>
          </div>
        )}

        {/* Paso 5 — Revisar template */}
        {step === 5 && template && (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">Tu agente está listo 🎉</h1>
              <p className="mt-2 text-sm theme-text-muted">Revisa y edita el guión. Puedes ajustar cualquier campo antes de confirmar.</p>
            </div>
            <div className="rounded-xl border theme-border/80 theme-bg-base px-4 py-3">
              <div className="text-xs font-semibold theme-text-muted mb-2">👤 Cliente ideal configurado</div>
              <div className="flex flex-wrap gap-2">
                {[template.buyer_situacion, template.buyer_ingresos, template.buyer_edad, template.buyer_hijos ? 'Con hijos' : null]
                  .filter(Boolean).map((tag) => (
                    <span key={tag as string} className="rounded-full bg-[#22c55e]/10 px-2 py-0.5 text-xs text-[#22c55e] border border-[#22c55e]/20">{tag}</span>
                  ))}
              </div>
            </div>
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {TEMPLATE_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-zinc-500">{f.label}</label>
                  <textarea
                    value={(template[f.key] as string) ?? ''}
                    onChange={(e) => setTemplate((prev) => prev ? { ...prev, [f.key]: e.target.value } : prev)}
                    rows={2}
                    className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                  />
                </div>
              ))}
            </div>
            {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div>}
            <div className="flex justify-between">
              <button type="button" onClick={() => setStep(4)} className="rounded-lg px-4 py-2 text-sm theme-text-muted hover:theme-text-primary transition">← Regenerar</button>
              <button type="button" onClick={handleConfirmTemplate} disabled={saving}
                className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition">
                {saving ? 'Guardando...' : '🚀 Confirmar y comenzar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
