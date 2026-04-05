import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BadgeCheck, Loader2, MessageSquare, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getPublicWebhookBaseUrl } from '../lib/getPublicWebhookBaseUrl'

type Plan = 'BASICO' | 'PRO' | 'PREMIUM'

const WEBHOOK_BASE_URL = getPublicWebhookBaseUrl()

const MONTOS_POR_PLAN: Record<string, number[]> = {
  prospectador: [20, 50, 100, 200],
  vendedor: [50, 100, 200, 500],
  cazador: [100, 200, 500, 1000],
}
const RECARGA_TEXTO_POR_PLAN: Record<string, string> = {
  prospectador: 'Recarga mínima $20 — Solo voz outbound',
  vendedor: 'Recarga mínima $50 — Incluye voz outbound + inbound',
  cazador: 'Recarga mínima $100 — Incluye voz + SMS automático',
}
const PLAN_NOMBRE_PARA_ERROR: Record<string, string> = {
  prospectador: 'Prospectador',
  vendedor: 'Vendedor',
  cazador: 'Cazador',
}

const MENSAJES_MOTIVADORES: Record<number, string> = {
  20: 'Perfecto para empezar',
  50: 'Ideal para probar tu primer campaña',
  100: 'Lanza tu primera campaña completa',
  200: 'Para equipos que quieren resultados',
  500: 'Escala tus ventas este mes',
  1000: 'El paquete de los que van en serio',
}

const PLAN_TO_STRIPE: Record<Plan, string> = {
  BASICO: 'prospectador',
  PRO: 'vendedor',
  PREMIUM: 'cazador',
}
const PLAN_ID_TO_DB: Record<string, Plan> = {
  prospectador: 'BASICO',
  vendedor: 'PRO',
  cazador: 'PREMIUM',
}

type PlanConfig = {
  id: string
  plan_id: string
  nombre: string
  emoji: string | null
  precio_por_minuto: number
  descripcion: string | null
  features: string[] | null
  activo: boolean
}

type CreditTransaction = {
  id: string
  user_id: string
  created_at: string
  tipo: string | null
  monto_usd: number | null
  descripcion: string | null
  minutos: number | null
  sms_cantidad: number | null
  call_id: string | null
}

const PLAN_LABEL: Record<Plan, string> = {
  BASICO: 'Básico',
  PRO: 'Pro',
  PREMIUM: 'Premium',
}
const DEFAULT_PLAN_COST_PER_MIN: Record<Plan, number> = {
  BASICO: 0.45,
  PRO: 0.75,
  PREMIUM: 0.9,
}

const FALLBACK_PLANES: PlanConfig[] = [
  {
    id: '',
    plan_id: 'prospectador',
    nombre: 'El Prospectador',
    emoji: '🎯',
    precio_por_minuto: 0.45,
    descripcion: 'Lanza campañas outbound ilimitadas. Llama, hace seguimiento y reintenta hasta cerrar.',
    features: ['Solo Outbound', 'Reintentos ilimitados', 'Transcripciones', 'Dashboard básico'],
    activo: true,
  },
  {
    id: '',
    plan_id: 'vendedor',
    nombre: 'El Vendedor',
    emoji: '⚡',
    precio_por_minuto: 0.75,
    descripcion: 'Llama y también atiende. Tu negocio nunca pierde una llamada entrante ni una oportunidad.',
    features: ['Outbound + Inbound', 'Reintentos ilimitados', 'Transcripciones', 'Dashboard completo', 'Historial de llamadas'],
    activo: true,
  },
  {
    id: '',
    plan_id: 'cazador',
    nombre: 'El Cazador',
    emoji: '👑',
    precio_por_minuto: 0.9,
    descripcion: 'El arsenal completo. Llama, atiende y si no contestan les llega un SMS automático.',
    features: ['Todo en El Vendedor', 'SMS automático si no contesta', 'SMS confirmación de cita', 'Reportes avanzados'],
    activo: true,
  },
]

export default function Credits() {
  const [currentPlan, setCurrentPlan] = useState<Plan>('PRO')
  const [voiceMinutes, setVoiceMinutes] = useState<number>(0)
  const [smsBalance, setSmsBalance] = useState<number>(0)
  const [saldoReferidosUsd, setSaldoReferidosUsd] = useState<number>(0)

  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [transactionsError, setTransactionsError] = useState<string | null>(null)

  const [planCosts, setPlanCosts] = useState<Record<Plan, number>>(DEFAULT_PLAN_COST_PER_MIN)
  const [planes, setPlanes] = useState<PlanConfig[]>(FALLBACK_PLANES)
  const [smsPrice, setSmsPrice] = useState<number>(0.05)

  const [searchParams, setSearchParams] = useSearchParams()
  const [successBanner, setSuccessBanner] = useState(false)
  const [successPaymentInfo, setSuccessPaymentInfo] = useState<{ amount: number; plan: string } | null>(null)
  const [cancelledBanner, setCancelledBanner] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<number | null>(null)
  const [customAmount, setCustomAmount] = useState('')
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'recarga' | 'uso' | 'referido'>('all')
  const [selectingPlanId, setSelectingPlanId] = useState<string | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [recargaError, setRecargaError] = useState<string | null>(null)

  const currentPlanLabel = useMemo(
    () => PLAN_LABEL[currentPlan] ?? 'Pro',
    [currentPlan],
  )
  const currentPlanRate = useMemo(
    () => planCosts[currentPlan] ?? DEFAULT_PLAN_COST_PER_MIN.PRO,
    [currentPlan, planCosts],
  )

  const planIdForCheckout = useMemo(() => PLAN_TO_STRIPE[currentPlan], [currentPlan])
  const montosDisponibles = useMemo(
    () => MONTOS_POR_PLAN[planIdForCheckout] ?? MONTOS_POR_PLAN.prospectador,
    [planIdForCheckout],
  )
  const minimoDelPlan = useMemo(
    () => (MONTOS_POR_PLAN[planIdForCheckout]?.[0] ?? 20),
    [planIdForCheckout],
  )

  function minutesForAmount(amountUsd: number, applyVolumeBonus: boolean): number {
    let min = amountUsd / currentPlanRate
    if (applyVolumeBonus) {
      if (amountUsd >= 500) min *= 1.1
      else if (amountUsd >= 200) min *= 1.05
    }
    return min
  }

  const filteredTransactions = useMemo(() => {
    if (transactionFilter === 'all') return transactions.slice(0, 50)
    const lower = transactionFilter.toLowerCase()
    return transactions
      .filter((t) => {
        const tipo = (t.tipo ?? '').toLowerCase()
        const desc = (t.descripcion ?? '').toLowerCase()
        if (transactionFilter === 'recarga') return tipo.includes('recarga') || desc.includes('recarga') || desc.includes('stripe')
        if (transactionFilter === 'uso') return tipo.includes('uso') || tipo.includes('llamada') || desc.includes('llamada')
        if (transactionFilter === 'referido') return tipo.includes('referido') || desc.includes('comisión') || desc.includes('referido')
        return true
      })
      .slice(0, 50)
  }, [transactions, transactionFilter])

  useEffect(() => {
    const success = searchParams.get('success') === 'true'
    const cancelled = searchParams.get('cancelled') === 'true'
    if (success) {
      setSuccessBanner(true)
      const amountParam = searchParams.get('amount')
      const planParam = searchParams.get('plan')
      const amount = amountParam ? Number(amountParam) : 0
      if (amount > 0 && planParam) {
        setSuccessPaymentInfo({ amount, plan: planParam })
      }
    }
    if (cancelled) setCancelledBanner(true)
    if (success || cancelled) {
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (!successBanner) return
    let mounted = true
    const t = setTimeout(() => {
      if (mounted) {
        loadBalancesAndPlan()
        loadTransactions()
      }
    }, 2000)
    return () => {
      mounted = false
      clearTimeout(t)
    }
  }, [successBanner])

  async function loadBalancesAndPlan() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) return

      const { data: profile, error: creditsError } = await supabase
        .from('credits')
        .select('plan_voz, minutos_voz, sms_disponibles, saldo_referidos_usd')
        .eq('user_id', userId)
        .maybeSingle()

      if (creditsError) return
      if (profile) {
        const planVoz = profile.plan_voz as string | null
        if (planVoz === 'prospectador') setCurrentPlan('BASICO')
        else if (planVoz === 'vendedor') setCurrentPlan('PRO')
        else if (planVoz === 'cazador') setCurrentPlan('PREMIUM')
        if (typeof profile.minutos_voz === 'number') {
          setVoiceMinutes(profile.minutos_voz)
        }
        if (typeof profile.sms_disponibles === 'number') {
          setSmsBalance(profile.sms_disponibles)
        }
        const saldoRef = profile.saldo_referidos_usd
        setSaldoReferidosUsd(typeof saldoRef === 'number' ? saldoRef : Number(saldoRef) || 0)
      }
    } catch {
      // silencioso
    }
  }

  async function loadTransactions() {
    setTransactionsError(null)
    setLoadingTransactions(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError) throw new Error(sessionError.message)
      const userId = session?.user?.id
      if (!userId) throw new Error('No hay sesión activa.')

      const { data, error } = await supabase
        .from('credit_transactions')
        .select(
          'id, user_id, tipo, monto_usd, minutos, sms_cantidad, descripcion, call_id, created_at',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw new Error(error.message)
      setTransactions((data ?? []) as CreditTransaction[])
    } catch (e) {
      setTransactions([])
      setTransactionsError(
        e instanceof Error ? e.message : 'Error al cargar transacciones.',
      )
    } finally {
      setLoadingTransactions(false)
    }
  }

  async function startCheckout(amountUsd: number) {
    setRecargaError(null)
    if (amountUsd < minimoDelPlan) {
      const planNombre = PLAN_NOMBRE_PARA_ERROR[planIdForCheckout] ?? 'Prospectador'
      setRecargaError(`El plan ${planNombre} requiere una recarga mínima de $${minimoDelPlan}`)
      return
    }
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId || !WEBHOOK_BASE_URL) {
      setCheckoutLoading(null)
      return
    }
    setCheckoutLoading(amountUsd)
    try {
      const res = await fetch(`${WEBHOOK_BASE_URL}/webhook/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          amount: amountUsd,
          plan: planIdForCheckout,
        }),
      })
      const json = await res.json().catch(() => ({}))
      const url = json.checkout_url
      if (url) {
        window.location.href = url
        return
      }
    } catch {
      // fallthrough
    }
    setCheckoutLoading(null)
  }

  async function selectPlan(planId: string) {
    const planDb = PLAN_ID_TO_DB[planId]
    if (!planDb) return
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId) return
    setPlanError(null)
    setSelectingPlanId(planId)
    try {
      const planVoz = planId
      const { data: existing } = await supabase
        .from('credits')
        .select('minutos_voz, sms_disponibles, saldo_referidos_usd')
        .eq('user_id', userId)
        .maybeSingle()

      if (existing) {
        const { error } = await supabase
          .from('credits')
          .update({ plan_voz: planVoz })
          .eq('user_id', userId)
        if (error) {
          setPlanError(error.message)
          return
        }
      } else {
        const { error } = await supabase.from('credits').insert({
          user_id: userId,
          plan_voz: planVoz,
          minutos_voz: 0,
          sms_disponibles: 0,
          saldo_referidos_usd: 0,
        })
        if (error) {
          setPlanError(error.message)
          return
        }
      }
      setCurrentPlan(planDb)
    } finally {
      setSelectingPlanId(null)
    }
  }

  useEffect(() => {
    async function loadPricing() {
      try {
        const { data, error } = await supabase
          .from('admin_config')
          .select('price_per_min_basico, price_per_min_pro, price_per_min_premium')
          .limit(1)
          .maybeSingle()

        if (error || !data) return
        setPlanCosts({
            BASICO: typeof data.price_per_min_basico === 'number' ? data.price_per_min_basico : DEFAULT_PLAN_COST_PER_MIN.BASICO,
            PRO: typeof data.price_per_min_pro === 'number' ? data.price_per_min_pro : DEFAULT_PLAN_COST_PER_MIN.PRO,
            PREMIUM: typeof data.price_per_min_premium === 'number' ? data.price_per_min_premium : DEFAULT_PLAN_COST_PER_MIN.PREMIUM,
          })
      } catch {
        // usamos DEFAULT_PLAN_COST_PER_MIN si admin_config no existe o falla
      }
    }

    async function loadPlanes() {
      try {
        const { data } = await supabase
          .from('plan_config')
          .select('*')
          .eq('activo', true)
          .order('precio_por_minuto', { ascending: true })

        if (data?.length) {
          const voicePlans = data.filter((row: Record<string, unknown>) => String(row.plan_id) !== 'sms')
          setPlanes(
            voicePlans.map((row: Record<string, unknown>) => ({
              id: String(row.id),
              plan_id: String(row.plan_id),
              nombre: String(row.nombre),
              emoji: row.emoji != null ? String(row.emoji) : null,
              precio_por_minuto: Number(row.precio_por_minuto),
              descripcion: row.descripcion != null ? String(row.descripcion) : null,
              features: Array.isArray(row.features) ? (row.features as string[]) : null,
              activo: Boolean(row.activo),
            }))
          )
          const smsRow = data.find((row: Record<string, unknown>) => String(row.plan_id) === 'sms')
          if (smsRow && typeof (smsRow as { precio_por_minuto?: number }).precio_por_minuto === 'number') {
            setSmsPrice(Number((smsRow as { precio_por_minuto: number }).precio_por_minuto))
          }
        }
      } catch {
        // usar FALLBACK_PLANES
      }
    }

    void loadBalancesAndPlan()
    void loadTransactions()
    void loadPricing()
    void loadPlanes()
  }, [])

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">
            Créditos
          </h1>
          <p className="mt-1 text-sm theme-text-muted">
            Consulta tu balance actual y paquetes disponibles.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 rounded-full border border-[#22c55e]/40 theme-bg-base px-3 py-1.5 text-xs font-semibold text-[#22c55e]">
          <BadgeCheck className="h-3 w-3" />
          Plan actual: {currentPlanLabel}
        </div>
      </div>

      {successBanner && (
        <div className="rounded-xl border border-[#22c55e]/50 bg-[#22c55e]/15 px-4 py-3 text-sm text-[#22c55e]">
          ✅ ¡Recarga exitosa!
          {successPaymentInfo ? (
            <> Recarga de ${successPaymentInfo.amount} acreditada en tu plan {successPaymentInfo.plan}. </>
          ) : null}
          Tus créditos han sido acreditados. Ya puedes lanzar tus campañas.
        </div>
      )}
      {cancelledBanner && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 py-3 text-sm text-amber-200">
          Recarga cancelada.
        </div>
      )}

      {/* Balance actual */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold theme-text-primary">Voz</div>
              <div className="mt-1 text-xs theme-text-muted">
                Minutos disponibles para llamadas IA.
              </div>
            </div>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#22c55e]/15 text-[#22c55e] ring-1 ring-[#22c55e]/25">
              <Phone className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <div className="text-3xl font-semibold tracking-tight theme-text-primary">
              {voiceMinutes.toFixed(0)}
            </div>
            <div className="text-sm theme-text-muted">min</div>
          </div>
          <div className="mt-2 text-xs theme-text-muted">
            Plan: <span className="theme-text-secondary">{currentPlanLabel}</span> ·{' '}
            Costo: <span className="theme-text-secondary">${currentPlanRate.toFixed(2)}/min</span>
          </div>
        </div>

        <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold theme-text-primary">SMS</div>
              <div className="mt-1 text-xs theme-text-muted">
                Mensajes disponibles para notificaciones.
              </div>
            </div>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/15 text-sky-300 ring-1 ring-sky-300/25">
              <MessageSquare className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <div className="text-3xl font-semibold tracking-tight theme-text-primary">
              {smsBalance.toFixed(0)}
            </div>
            <div className="text-sm theme-text-muted">SMS</div>
          </div>
          <div className="mt-2 text-xs theme-text-muted">
            El saldo se descuenta automáticamente a <span className="theme-text-secondary">${smsPrice.toFixed(2)}/mensaje</span> por cada SMS enviado.
          </div>
        </div>
      </div>

      {/* Saldo de Referidos */}
      <div className="rounded-2xl border border-[#22c55e]/30 theme-bg-card p-5 bg-[#22c55e]/5">
        <div className="text-sm font-semibold theme-text-primary">💰 Saldo de Referidos</div>
        <div className="mt-1 text-2xl font-semibold text-[#22c55e]">${saldoReferidosUsd.toFixed(2)}</div>
        <p className="mt-1 text-xs theme-text-muted">
          Este saldo se aplica automáticamente a tus próximas llamadas.
        </p>
      </div>

      {/* Selección de plan VOZ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold theme-text-primary">
              Plan de voz
            </div>
            <div className="text-xs theme-text-muted">
              Elige el plan según cómo quieres usar la IA (outbound, inbound, SMS).
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full theme-bg-base px-1 py-1 text-xs">
            <span className="rounded-full theme-bg-card px-3 py-1.5 font-semibold text-zinc-100 ring-1 ring-zinc-700/80">
              Pay Per Use
            </span>
          </div>
        </div>

        {planError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {planError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {planes.map((plan, index) => {
            const isPopular = plan.plan_id === 'vendedor'
            const accentColor = isPopular ? '#f97316' : index === 0 ? '#22c55e' : '#eab308'
            const features = plan.features ?? []
            const isCurrentPlan = PLAN_ID_TO_DB[plan.plan_id] === currentPlan
            const loading = selectingPlanId === plan.plan_id

            return (
              <div
                key={plan.plan_id}
                className={`relative flex h-full flex-col rounded-2xl border theme-bg-card p-5 ${
                  isPopular
                    ? 'border-[#f97316]/70 shadow-[0_0_0_1px_rgba(249,115,22,0.35)]'
                    : 'theme-border/80'
                } ${isCurrentPlan ? 'ring-2 ring-[#22c55e]/60' : ''}`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-4 rounded-full bg-[#22c55e] px-2 py-0.5 text-[11px] font-semibold text-[#0b0b0b]">
                    Plan actual
                  </div>
                )}
                {isPopular && !isCurrentPlan && (
                  <div className="absolute -top-3 right-4 rounded-full bg-[#f97316] px-2 py-0.5 text-[11px] font-semibold text-[#0b0b0b]">
                    Más Popular
                  </div>
                )}

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="mt-1 flex items-center gap-2 text-lg font-semibold theme-text-primary">
                      <span>{plan.emoji ?? '•'}</span>
                      <span>{plan.nombre}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs theme-text-muted">Precio</div>
                    <div className="text-xl font-semibold" style={{ color: accentColor }}>
                      ${plan.precio_por_minuto.toFixed(2)}
                      <span className="text-xs theme-text-muted">/min</span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 text-xs theme-text-muted">
                  {plan.descripcion ?? ''}
                </div>

                <ul className="mt-4 space-y-2 text-xs theme-text-muted">
                  {features.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-[2px]" style={{ color: accentColor }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs italic" style={{ color: accentColor }}>
                  <span>Con $50 → ~{Math.floor(50 / plan.precio_por_minuto)} min</span>
                  <span>Con $100 → ~{Math.floor(100 / plan.precio_por_minuto)} min</span>
                </div>

                <button
                  type="button"
                  disabled={isCurrentPlan || loading}
                  onClick={() => selectPlan(plan.plan_id)}
                  className="mt-5 w-full rounded-lg px-3 py-2 text-sm font-semibold text-[#0b0b0b] transition disabled:opacity-60 disabled:cursor-default"
                  style={{ backgroundColor: isCurrentPlan ? '#333' : accentColor }}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin inline" />
                      Guardando...
                    </span>
                  ) : isCurrentPlan ? (
                    'Plan actual'
                  ) : (
                    'Seleccionar este plan'
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recarga rápida — VOZ (Stripe) */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5 space-y-4">
        <div>
          <div className="text-sm font-semibold theme-text-primary">
            Recargar Créditos — VOZ
          </div>
          <div className="text-xs theme-text-muted">
            Plan actual: {currentPlanLabel} · ${currentPlanRate.toFixed(2)}/min · Pay per use
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {montosDisponibles.map((amount) => {
            const minBase = Math.floor(minutesForAmount(amount, false))
            const minBonus = Math.floor(minutesForAmount(amount, true))
            const hasBonus = amount >= 200
            const loading = checkoutLoading === amount
            const mensaje = MENSAJES_MOTIVADORES[amount] ?? ''
            return (
              <button
                key={amount}
                type="button"
                disabled={!!checkoutLoading || !WEBHOOK_BASE_URL}
                onClick={() => startCheckout(amount)}
                className="relative flex flex-col items-center justify-center rounded-xl border theme-border bg-[#0b0b0b]/80 px-4 py-5 text-center hover:border-[#22c55e]/50 hover:bg-[#22c55e]/10 transition disabled:opacity-60 disabled:cursor-not-allowed min-h-[120px]"
              >
                {hasBonus && (
                  <span className="absolute -top-1.5 right-1.5 rounded bg-[#22c55e] px-1.5 py-0.5 text-[10px] font-semibold text-[#0b0b0b]">
                    {amount >= 500 ? '10% extra' : '5% extra'}
                  </span>
                )}
                <span className="text-xl font-bold text-[#22c55e]">${amount}</span>
                <span className="mt-1 text-xs theme-text-muted">
                  ~{hasBonus ? minBonus : minBase} min
                </span>
                {mensaje && (
                  <span className="mt-2 text-[11px] text-zinc-400 leading-tight max-w-full px-1">
                    {mensaje}
                  </span>
                )}
                {loading && (
                  <span className="mt-2 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-[#22c55e]" />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="rounded-xl border theme-border bg-[#0b0b0b]/80 px-4 py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <span className="text-sm font-semibold theme-text-primary sm:min-w-[100px]">Otro monto</span>
          <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <input
              type="number"
              min={minimoDelPlan}
              step={5}
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value)
                setRecargaError(null)
              }}
              placeholder="Ingresa el monto"
              className="flex-1 min-w-0 rounded-lg border theme-border theme-bg-base px-3 py-2.5 text-sm theme-text-primary placeholder:theme-text-dim"
            />
            <button
              type="button"
              disabled={!!checkoutLoading || !WEBHOOK_BASE_URL || !customAmount}
              onClick={() => {
                const n = Number(customAmount)
                setRecargaError(null)
                if (n < minimoDelPlan) {
                  setRecargaError(`Mínimo $${minimoDelPlan} para tu plan`)
                  return
                }
                startCheckout(n)
              }}
              className="rounded-lg bg-[#22c55e] px-4 py-2.5 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {checkoutLoading !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pagar'}
            </button>
          </div>
          <div className="text-xs theme-text-muted sm:min-w-[120px] text-left sm:text-right">
            {customAmount && Number(customAmount) >= minimoDelPlan
              ? `~${Math.floor(minutesForAmount(Number(customAmount), Number(customAmount) >= 200))} min disponibles`
              : customAmount
                ? `Mínimo $${minimoDelPlan} para tu plan`
                : null}
          </div>
        </div>

        <p className="text-xs theme-text-muted">
          {RECARGA_TEXTO_POR_PLAN[planIdForCheckout] ?? RECARGA_TEXTO_POR_PLAN.prospectador}
        </p>

        {recargaError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {recargaError}
          </div>
        )}

        {!WEBHOOK_BASE_URL && (
          <p className="text-xs text-amber-200">
            Configura `VITE_WEBHOOK_BASE_URL` o usa el subdominio del frontend para habilitar recargas con Stripe.
          </p>
        )}
      </div>

      {/* SMS Outbound */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold theme-text-primary">SMS Outbound</div>
            <div className="text-xs theme-text-muted">
              Paga solo por los mensajes que envías. El saldo se descuenta automáticamente a ${smsPrice.toFixed(2)} por mensaje, igual que los minutos de voz.
            </div>
          </div>
        </div>
        <div className="rounded-2xl border theme-border theme-bg-card p-5 max-w-md">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💬</span>
            <h3 className="text-lg font-semibold theme-text-primary">SMS Outbound</h3>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-2xl font-bold theme-accent-text">${smsPrice.toFixed(2)}</span>
            <span className="text-sm theme-text-muted">/mensaje</span>
          </div>
          <ul className="mt-4 space-y-2 text-xs theme-text-muted">
            <li className="flex gap-2">
              <span className="theme-accent-text">✓</span> SMS post-llamada automático
            </li>
            <li className="flex gap-2">
              <span className="theme-accent-text">✓</span> Confirmación de cita
            </li>
            <li className="flex gap-2">
              <span className="theme-accent-text">✓</span> Recordatorio 24h antes
            </li>
            <li className="flex gap-2">
              <span className="theme-accent-text">✓</span> Respuestas monitoreadas
            </li>
          </ul>
          <button
            type="button"
            className="mt-5 w-full rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
          >
            Integración de pagos próximamente
          </button>
        </div>
      </div>

      {/* Historial de transacciones */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold theme-text-primary">
              Historial de Transacciones
            </div>
            <div className="text-xs theme-text-muted">
              Últimas 50. Recargas, consumos y referidos.
            </div>
          </div>
          <div className="inline-flex rounded-lg border theme-border p-0.5 text-xs">
            {(['all', 'recarga', 'uso', 'referido'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setTransactionFilter(f)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  transactionFilter === f
                    ? 'theme-bg-elevated theme-text-primary'
                    : 'theme-text-muted hover:theme-text-secondary'
                }`}
              >
                {f === 'all' ? 'Todos' : f === 'recarga' ? 'Recargas' : f === 'uso' ? 'Uso' : 'Referidos'}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border theme-border/80 theme-bg-card">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide theme-text-muted">
                <tr className="border-b theme-border/80">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Minutos</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {loadingTransactions ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center theme-text-muted">
                      Cargando transacciones...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center theme-text-muted">
                      No hay transacciones aún
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((t) => {
                    const tipoLower = (t.tipo ?? '').toLowerCase()
                    const descLower = (t.descripcion ?? '').toLowerCase()
                    const isRecarga = tipoLower.includes('recarga') || descLower.includes('recarga') || descLower.includes('stripe')
                    const isReferido = tipoLower.includes('referido') || descLower.includes('comisión') || descLower.includes('referido')
                    const tipoLabel = isRecarga ? '💳 Recarga' : isReferido ? '🤝 Referido' : '📞 Uso'
                    const minStr = t.minutos != null ? (t.minutos >= 0 ? `+${t.minutos.toFixed(1)}` : `${t.minutos.toFixed(1)}`) : '—'
                    const montoStr = t.monto_usd != null ? (t.monto_usd >= 0 ? `+$${t.monto_usd.toFixed(2)}` : `-$${Math.abs(t.monto_usd).toFixed(2)}`) : '—'
                    return (
                      <tr key={t.id} className="border-b theme-border/80 last:border-b-0">
                        <td className="px-4 py-3 theme-text-secondary">
                          {new Date(t.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-4 py-3 theme-text-secondary">
                          {t.descripcion ?? '—'}
                        </td>
                        <td className="px-4 py-3 theme-text-secondary">{montoStr}</td>
                        <td className="px-4 py-3 theme-text-secondary">{minStr}</td>
                        <td className="px-4 py-3 theme-text-secondary">{tipoLabel}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {transactionsError ? (
            <div className="border-t border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
              {transactionsError}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

