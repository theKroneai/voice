import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

type AgentTypeId =
  | 'cold_call'
  | 'collections'
  | 'birthday'
  | 'mothers_day'
  | 'appointment_reminder'
  | 'ask_referrals'
  | 'referral_gift'
  | 'custom'

type Language = 'ES' | 'EN' | 'AUTO'
type Plan = 'BASIC' | 'PRO' | 'PREMIUM'

type CampaignRow = {
  id: string
  nombre: string
  agente_tipo: AgentTypeId
  status: 'draft' | 'active' | 'paused' | 'completed' | string
  empresa_nombre: string
  idioma: Language | string
  max_intentos: number
  created_at: string
  nicho: string | null
  sms_enabled?: boolean
  sms_template?: string | null
  hora_inicio?: string | null
  hora_fin?: string | null
  cadencia_dias?: number | null
  google_review_link?: string | null
  updated_at?: string | null
}

type CampaignProgress = { total: number; processed: number }

type NichoTemplate = {
  id: string
  nicho: string
}

const AGENT_TYPES: Array<{
  id: AgentTypeId
  title: string
  emoji: string
  description: string
  idealFor: string
}> = [
  { id: 'cold_call', title: 'Llamada en Frío', emoji: '📞', description: 'Prospección masiva a nuevos contactos', idealFor: 'agua, solar, roofing, seguros' },
  { id: 'collections', title: 'Cobranza / Pagos Pendientes', emoji: '💵', description: 'Llama a clientes con pagos vencidos y recuerda de forma amable su saldo pendiente.', idealFor: 'servicios por suscripción, academias, despachos legales, financieras' },
  { id: 'birthday', title: 'Feliz Cumpleaños', emoji: '🎂', description: 'Llama a clientes en su día especial', idealFor: 'retención y fidelización' },
  { id: 'mothers_day', title: 'Día de las Madres', emoji: '💐', description: 'Campaña especial del día de las madres', idealFor: 'temporadas y fechas especiales' },
  { id: 'appointment_reminder', title: 'Recordatorio de Cita', emoji: '📅', description: 'Confirma citas agendadas automáticamente', idealFor: 'médicos, dentistas, abogados' },
  { id: 'ask_referrals', title: 'Pedir Referidos', emoji: '🤝', description: 'Solicita referidos a clientes satisfechos', idealFor: 'crecimiento orgánico' },
  { id: 'referral_gift', title: 'Regalo por Referido', emoji: '🎁', description: 'Notifica sobre regalo por referir clientes', idealFor: 'programas de referidos' },
  { id: 'custom', title: 'Personalizado', emoji: '✏️', description: 'Diseña tu propio guión desde cero', idealFor: 'casos específicos' },
]

const PLAN_LABEL: Record<Plan, string> = {
  BASIC: 'Básico $0.45/min',
  PRO: 'Pro $0.75/min',
  PREMIUM: 'Premium $0.90/min',
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

const CATEGORIAS_NICHO: { key: string; emoji: string; label: string; nichos: string[] }[] = [
  { key: 'hogar', emoji: '🏠', label: 'Servicios del Hogar', nichos: ['agua', 'roofing', 'siding', 'solar', 'pest_control', 'hvac', 'windows', 'insulation', 'remodeling'] },
  { key: 'salud', emoji: '🏥', label: 'Salud', nichos: ['dental', 'optometria', 'medico_primario', 'quiropráctico'] },
  { key: 'inmigrantes', emoji: '🌎', label: 'Para Inmigrantes', nichos: ['itin_taxes', 'seguros_inmigrantes', 'remesas', 'inmigracion'] },
  { key: 'real_estate', emoji: '🏡', label: 'Real Estate', nichos: ['real_estate_compra', 'real_estate_venta'] },
  { key: 'legal_financiero', emoji: '⚖️', label: 'Legal y Financiero', nichos: ['credito'] },
  { key: 'fitness', emoji: '💪', label: 'Fitness y Bienestar', nichos: ['gym', 'nutricion'] },
  { key: 'automotriz', emoji: '🚗', label: 'Automotriz', nichos: ['auto_insurance', 'autos'] },
  { key: 'educacion', emoji: '📚', label: 'Educación', nichos: ['ingles', 'internet'] },
  { key: 'otro', emoji: '✏️', label: 'Otro', nichos: ['otro'] },
]

function getNichoEmoji(label: string | null | undefined): string {
  if (!label) return '✏️'
  const k = label.toLowerCase().trim().replace(/\s+/g, '_')
  return NICHO_EMOJI[k] ?? '✏️'
}

function getNichoCategoriaKey(nichoKey: string): string {
  const k = nichoKey.toLowerCase().trim().replace(/\s+/g, '_')
  for (const cat of CATEGORIAS_NICHO) {
    if (cat.nichos.includes(k)) return cat.key
  }
  return 'otro'
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="text-sm theme-text-muted">
      {children}
    </label>
  )
}

function PillButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition',
        active
          ? 'bg-[#22c55e] text-[#0b0b0b] ring-[#22c55e]'
          : 'theme-bg-base theme-text-secondary ring-zinc-800/80 hover:bg-zinc-900/40',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function Campaigns() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [agentType, setAgentType] = useState<AgentTypeId | null>(null)
  const [campaignName, setCampaignName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [language, setLanguage] = useState<Language>('ES')
  const [plan, setPlan] = useState<Plan>('BASIC')
  const [maxAttempts, setMaxAttempts] = useState<number>(3)
  const [callStart, setCallStart] = useState('09:00')
  const [callEnd, setCallEnd] = useState('18:00')
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [smsTemplate, setSmsTemplate] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [campaignProgress, setCampaignProgress] = useState<Record<string, CampaignProgress>>({})
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [campaignsError, setCampaignsError] = useState<string | null>(null)

  const [nichos, setNichos] = useState<NichoTemplate[]>([])
  const [selectedNichoId, setSelectedNichoId] = useState<string | null>(null)
  const [userDefaultNicho, setUserDefaultNicho] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editEmpresaNombre, setEditEmpresaNombre] = useState('')
  const [editNicho, setEditNicho] = useState('')
  const [editAgenteTipo, setEditAgenteTipo] = useState<AgentTypeId>('cold_call')
  const [editIdioma, setEditIdioma] = useState<Language>('ES')
  const [editStatus, setEditStatus] = useState<'active' | 'paused' | 'completed'>('active')
  const [editMaxIntentos, setEditMaxIntentos] = useState<number>(3)
  const [editHoraInicio, setEditHoraInicio] = useState('09:00')
  const [editHoraFin, setEditHoraFin] = useState('18:00')
  const [editCadenciaDias, setEditCadenciaDias] = useState<number>(1)
  const [editSmsEnabled, setEditSmsEnabled] = useState(false)
  const [editSmsTemplate, setEditSmsTemplate] = useState('')
  const [editGoogleReviewLink, setEditGoogleReviewLink] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const selectedAgentLabel = useMemo(() => {
    const found = AGENT_TYPES.find((a) => a.id === agentType)
    return found ? `${found.emoji} ${found.title}` : 'No seleccionado'
  }, [agentType])

  const agentEmojiById = useMemo(() => {
    const map = new Map<AgentTypeId, string>()
    for (const a of AGENT_TYPES) map.set(a.id, a.emoji)
    return map
  }, [])

  const selectedNichoLabel = useMemo(() => {
    const found = nichos.find((n) => n.id === selectedNichoId)
    return found?.nicho ?? ''
  }, [nichos, selectedNichoId])

  function resetForm() {
    setStep(1)
    setAgentType(null)
    setCampaignName('')
    setCompanyName('')
    setLanguage('ES')
    setPlan('BASIC')
    setMaxAttempts(3)
    setCallStart('09:00')
    setCallEnd('18:00')
    setSmsEnabled(false)
    setSmsTemplate('')
    setSaving(false)
    setError(null)
  }

  function openModal() {
    resetForm()
    setOpen(true)
  }

  function closeModal() {
    setOpen(false)
  }

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    window.setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev))
    }, 3000)
  }

  function openEditModal(c: CampaignRow) {
    setEditingCampaignId(c.id)
    setEditNombre(c.nombre ?? '')
    setEditEmpresaNombre(c.empresa_nombre ?? '')
    setEditNicho(c.nicho ?? '')
    setEditAgenteTipo((c.agente_tipo as AgentTypeId) ?? 'cold_call')
    setEditIdioma((c.idioma as Language) ?? 'ES')
    setEditStatus(
      c.status === 'paused' || c.status === 'completed' ? c.status : 'active',
    )
    setEditMaxIntentos(
      Math.min(20, Math.max(1, Number(c.max_intentos) || 1)),
    )
    setEditHoraInicio(c.hora_inicio?.slice(0, 5) || '09:00')
    setEditHoraFin(c.hora_fin?.slice(0, 5) || '18:00')
    setEditCadenciaDias(c.cadencia_dias ?? 1)
    setEditSmsEnabled(Boolean(c.sms_enabled))
    setEditSmsTemplate(c.sms_template ?? '')
    setEditGoogleReviewLink(c.google_review_link ?? '')
    setEditOpen(true)
  }

  function closeEditModal() {
    setEditOpen(false)
    setEditingCampaignId(null)
    setSavingEdit(false)
  }

  async function getUserIdOrThrow(): Promise<string> {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) throw new Error(sessionError.message)
    const userId = session?.user?.id
    if (!userId) throw new Error('No hay sesión activa.')
    return userId
  }

  async function loadCampaigns() {
    setCampaignsError(null)
    setLoadingCampaigns(true)
    try {
      const userId = await getUserIdOrThrow()

      const { data, error: selectError } = await supabase
        .from('campaigns')
        .select(
          'id, nombre, agente_tipo, status, empresa_nombre, idioma, max_intentos, created_at, nicho, sms_enabled, sms_template, hora_inicio, hora_fin, cadencia_dias, google_review_link, updated_at',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (selectError) throw new Error(selectError.message)
      const list = (data ?? []) as CampaignRow[]
      setCampaigns(list)

      if (list.length > 0) {
        const campaignIds = list.map((c) => c.id)
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('campaign_id, status')
          .in('campaign_id', campaignIds)
        const byCampaign: Record<string, CampaignProgress> = {}
        for (const id of campaignIds) byCampaign[id] = { total: 0, processed: 0 }
        for (const row of contactsData ?? []) {
          const cid = row.campaign_id
          if (cid && byCampaign[cid]) {
            byCampaign[cid].total += 1
            if (row.status && row.status !== 'pending') byCampaign[cid].processed += 1
          }
        }
        setCampaignProgress(byCampaign)
      } else {
        setCampaignProgress({})
      }
    } catch (e) {
      setCampaigns([])
      setCampaignsError(e instanceof Error ? e.message : 'Error al cargar campañas.')
    } finally {
      setLoadingCampaigns(false)
    }
  }

  useEffect(() => {
    void loadCampaigns()
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void loadCampaigns()
    })
    return () => {
      sub.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const userId = await getUserIdOrThrow()
        const user = { id: userId }
        const { data: dbgU, error: dbgUErr } = await supabase
          .from('users')
          .select('id, es_admin, onboarding_completado, nombre')
          .eq('id', user.id)
          .maybeSingle()
        // eslint-disable-next-line no-console
        console.log('users data:', dbgU)
        // eslint-disable-next-line no-console
        console.log('users error:', dbgUErr)
        const [userRes, nichosRes] = await Promise.all([
          supabase.from('users').select('nicho').eq('id', userId).maybeSingle(),
          supabase
            .from('nicho_templates')
            .select('id, nicho')
            .order('nicho', { ascending: true }),
        ])

        if (!mounted) return
        // eslint-disable-next-line no-console
        console.log('users data:', userRes.data)
        // eslint-disable-next-line no-console
        console.log('users error:', userRes.error)

        const nichosData = nichosRes.data
        const list = (nichosData ?? []) as NichoTemplate[]
        setNichos(list)
        const userNicho = userRes.data?.nicho ?? null
        setUserDefaultNicho(userNicho)

        if (userNicho && list.length > 0) {
          const match = list.find(
            (n) => n.nicho.toLowerCase() === String(userNicho).toLowerCase(),
          )
          if (match) {
            setSelectedNichoId(match.id)
          }
        }
      } catch {
        if (mounted) {
          setNichos([])
        }
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  function canGoStep2() {
    return agentType !== null
  }

  function canGoStep3() {
    return (
      canGoStep2() &&
      campaignName.trim().length > 0 &&
      companyName.trim().length > 0 &&
      maxAttempts >= 1 &&
      maxAttempts <= 10 &&
      callStart.length > 0 &&
      callEnd.length > 0
    )
  }

  async function onCreateCampaign() {
    setError(null)
    if (!canGoStep3()) {
      setError('Revisa los campos antes de crear la campaña.')
      return
    }
    if (!agentType) {
      setError('Selecciona un tipo de agente.')
      return
    }

    setSaving(true)
    try {
      const userId = await getUserIdOrThrow()

      const payload = {
        user_id: userId,
        agente_tipo: agentType,
        nombre: campaignName.trim(),
        empresa_nombre: companyName.trim(),
        llm_modelo: 'auto',
        voz_proveedor: 'retell',
        idioma: language,
        max_intentos: maxAttempts,
        hora_inicio: callStart,
        hora_fin: callEnd,
        numero_telefono: '',
        nicho: selectedNichoLabel || userDefaultNicho || null,
        status: 'draft',
        sms_enabled: smsEnabled,
        sms_template: smsEnabled ? (smsTemplate.trim().slice(0, 160) || null) : null,
      }

      const { error: insertError } = await supabase
        .from('campaigns')
        .insert(payload)

      if (insertError) {
        setError(insertError.message)
        return
      }

      closeModal()
      await loadCampaigns()
    } finally {
      setSaving(false)
    }
  }

  async function onSaveCampaignEdit() {
    setCampaignsError(null)
    if (!editingCampaignId) return
    if (!editNombre.trim() || !editEmpresaNombre.trim()) {
      showToast('error', 'Nombre y empresa son obligatorios.')
      return
    }
    if (!editHoraInicio || !editHoraFin) {
      showToast('error', 'Define hora de inicio y hora fin.')
      return
    }
    if (editMaxIntentos < 1 || editMaxIntentos > 20) {
      showToast('error', 'Máximo de intentos debe estar entre 1 y 20.')
      return
    }

    setSavingEdit(true)
    try {
      await getUserIdOrThrow()
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({
          nombre: editNombre.trim(),
          empresa_nombre: editEmpresaNombre.trim(),
          nicho: editNicho.trim() || null,
          agente_tipo: editAgenteTipo,
          idioma: editIdioma,
          status: editStatus,
          max_intentos: editMaxIntentos,
          hora_inicio: editHoraInicio,
          hora_fin: editHoraFin,
          cadencia_dias: editCadenciaDias,
          sms_enabled: editSmsEnabled,
          sms_template: editSmsEnabled
            ? editSmsTemplate.trim().slice(0, 160) || null
            : null,
          google_review_link: editGoogleReviewLink.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingCampaignId)

      if (updateError) throw new Error(updateError.message)
      await loadCampaigns()
      closeEditModal()
      showToast('success', 'Campaña actualizada correctamente')
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'No se pudo actualizar la campaña.'
      setCampaignsError(msg)
      showToast('error', msg)
    } finally {
      setSavingEdit(false)
    }
  }

  async function onActivateCampaign(id: string) {
    setCampaignsError(null)
    try {
      await getUserIdOrThrow()
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ status: 'active' })
        .eq('id', id)
      if (updateError) throw new Error(updateError.message)
      await loadCampaigns()
    } catch (e) {
      setCampaignsError(
        e instanceof Error ? e.message : 'Error al activar la campaña.',
      )
    }
  }

  async function onPauseCampaign(id: string) {
    setCampaignsError(null)
    try {
      await getUserIdOrThrow()
      const { error: updateError } = await supabase
        .from('campaigns')
        .update({ status: 'paused' })
        .eq('id', id)
      if (updateError) throw new Error(updateError.message)
      await loadCampaigns()
    } catch (e) {
      setCampaignsError(
        e instanceof Error ? e.message : 'Error al pausar la campaña.',
      )
    }
  }

  async function onDuplicateCampaign(c: CampaignRow) {
    setCampaignsError(null)
    try {
      const userId = await getUserIdOrThrow()
      const payload = {
        user_id: userId,
        agente_tipo: c.agente_tipo,
        nombre: `${c.nombre} (copia)`,
        empresa_nombre: c.empresa_nombre,
        llm_modelo: 'auto',
        voz_proveedor: 'retell',
        idioma: c.idioma,
        max_intentos: c.max_intentos,
        hora_inicio: c.hora_inicio ?? '09:00',
        hora_fin: c.hora_fin ?? '18:00',
        numero_telefono: '',
        nicho: c.nicho,
        status: 'draft',
        sms_enabled: c.sms_enabled ?? false,
        sms_template: null,
      }
      const { error: insertError } = await supabase.from('campaigns').insert(payload)
      if (insertError) throw new Error(insertError.message)
      await loadCampaigns()
    } catch (e) {
      setCampaignsError(
        e instanceof Error ? e.message : 'Error al duplicar la campaña.',
      )
    }
  }

  async function onDeleteCampaign(id: string) {
    setCampaignsError(null)
    try {
      await getUserIdOrThrow()
      const { error: deleteError } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id)
      if (deleteError) throw new Error(deleteError.message)
      await loadCampaigns()
    } catch (e) {
      setCampaignsError(
        e instanceof Error ? e.message : 'Error al eliminar la campaña.',
      )
    }
  }

  function statusBadge(status: CampaignRow['status']) {
    const base =
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1'
    if (status === 'active') {
      return `${base} bg-[#22c55e]/15 text-[#22c55e] ring-[#22c55e]/20`
    }
    if (status === 'paused') {
      return `${base} bg-amber-400/15 text-amber-300 ring-amber-300/20`
    }
    if (status === 'completed') {
      return `${base} bg-sky-400/15 text-sky-300 ring-sky-300/20`
    }
    return `${base} bg-zinc-400/15 theme-text-muted ring-zinc-300/20`
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">
          Campañas Outbound
        </h1>
        <p className="mt-1 text-sm theme-text-muted">
          Llama automáticamente a tus prospectos y agenda visitas sin intervención humana.
        </p>
        <div className="mt-4 flex flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <div className="text-sm font-medium theme-text-primary">Outbound</div>
              <div className="text-xs theme-text-dim">Tu agente llama</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔄</span>
            <div>
              <div className="text-sm font-medium theme-text-primary">Automático</div>
              <div className="text-xs theme-text-dim">Sin intervención</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">📅</span>
            <div>
              <div className="text-sm font-medium theme-text-primary">24/7</div>
              <div className="text-xs theme-text-dim">Según tu horario</div>
            </div>
          </div>
        </div>
      </div>

      {/* Banner informativo */}
      <div className="rounded-2xl border theme-border/80 theme-bg-base p-5">
        <h2 className="text-base font-semibold theme-text-primary">
          ¿Cómo funciona una campaña outbound?
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium theme-text-secondary">
              <span>📋</span>
              <span>Paso 1: Importa contactos</span>
            </div>
            <p className="mt-1 text-xs theme-text-dim">
              Sube tu lista de prospectos en CSV o Excel
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium theme-text-secondary">
              <span>⚙️</span>
              <span>Paso 2: Configura la campaña</span>
            </div>
            <p className="mt-1 text-xs theme-text-dim">
              Define horario, intentos y el tipo de agente
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium theme-text-secondary">
              <span>🚀</span>
              <span>Paso 3: Activa y listo</span>
            </div>
            <p className="mt-1 text-xs theme-text-dim">
              Tu agente empieza a llamar automáticamente
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="mt-4 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
        >
          + Nueva Campaña Outbound
        </button>
      </div>

      {campaignsError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {campaignsError}
        </div>
      ) : null}

      {toast ? (
        <div
          className={[
            'fixed right-4 top-4 z-[60] rounded-lg border px-4 py-2 text-sm shadow-xl',
            toast.type === 'success'
              ? 'border-[#22c55e]/30 bg-[#22c55e]/15 text-[#86efac]'
              : 'border-red-500/30 bg-red-500/10 text-red-200',
          ].join(' ')}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      ) : null}

      {loadingCampaigns ? (
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-5 text-sm theme-text-muted">
          Cargando campañas...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
          <div className="text-sm theme-text-muted">
            No hay campañas todavía. Crea tu primera campaña.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {campaigns.map((c) => {
            const progress = campaignProgress[c.id]
            const pct =
              progress && progress.total > 0
                ? Math.round((progress.processed / progress.total) * 100)
                : 0
            return (
              <div
                key={c.id}
                className="rounded-2xl border theme-border/80 theme-bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-semibold theme-text-primary">
                        {c.nombre}
                      </span>
                      <span className="shrink-0 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-300">
                        OUTBOUND
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {c.nicho ? (
                        <span className="inline-flex items-center rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[11px] font-semibold text-[#22c55e] ring-1 ring-[#22c55e]/30">
                          <span className="mr-1">{getNichoEmoji(c.nicho)}</span>
                          {c.nicho}
                        </span>
                      ) : null}
                      {c.sms_enabled ? (
                        <span className="inline-flex items-center rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[11px] font-semibold text-[#22c55e] ring-1 ring-[#22c55e]/30">
                          SMS ✓
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs theme-text-dim">
                      Máx. intentos: {c.max_intentos}
                      {c.hora_inicio && c.hora_fin ? (
                        <span className="ml-2">
                          • Horario: {c.hora_inicio} – {c.hora_fin}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className={statusBadge(c.status)}>{c.status}</span>
                </div>

                {progress && progress.total > 0 ? (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs theme-text-muted">
                      <span>Contactos procesados</span>
                      <span>{progress.processed} / {progress.total} ({pct}%)</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-[#22c55e] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/contacts?campaign=${c.id}`)}
                    className="rounded-lg px-3 py-2 text-sm font-medium theme-text-secondary ring-1 ring-zinc-800/80 hover:bg-zinc-900/40 transition"
                  >
                    Ver Contactos
                  </button>
                  {c.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => void onPauseCampaign(c.id)}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/10 transition"
                    >
                      Pausar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void onActivateCampaign(c.id)}
                      className="rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
                    >
                      Activar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditModal(c)}
                    className="rounded-lg px-3 py-2 text-sm font-medium theme-text-secondary ring-1 ring-zinc-800/80 hover:bg-zinc-900/40 transition"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDuplicateCampaign(c)}
                    className="rounded-lg px-3 py-2 text-sm font-medium theme-text-secondary ring-1 ring-zinc-800/80 hover:bg-zinc-900/40 transition"
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteCampaign(c.id)}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-red-200 ring-1 ring-red-500/30 hover:bg-red-500/10 transition"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={closeModal}
            className="absolute inset-0 bg-black/70"
            aria-label="Cerrar modal"
          />

          <div className="relative w-full max-w-3xl rounded-2xl border theme-border/80 theme-bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b theme-border/80 px-5 py-4">
              <div>
                <div className="text-base font-semibold theme-text-primary">
                  Nueva Campaña
                </div>
                <div className="mt-1 text-sm theme-text-muted">
                  Paso {step} de 3
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 theme-text-muted hover:bg-zinc-900/40 hover:theme-text-primary transition"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5">
              {step === 1 ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold theme-text-primary">
                      PASO 1 — Tipo de Agente
                    </div>
                    <div className="mt-1 text-sm theme-text-muted">
                      Elige el tipo de agente para esta campaña.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {AGENT_TYPES.map((a) => {
                      const selected = a.id === agentType
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setAgentType(a.id)}
                          className={
                            'relative text-left rounded-2xl border p-4 transition ' +
                            (selected
                              ? 'border-[#22c55e] bg-[#22c55e]/5'
                              : 'theme-border/80 theme-bg-base hover:border-zinc-700')
                          }
                        >
                          <span className="absolute right-3 top-3 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-300">
                            OUTBOUND
                          </span>
                          <div className="text-sm font-semibold theme-text-primary">
                            {a.emoji} {a.title}
                          </div>
                          <p className="mt-1 text-xs theme-text-muted">
                            {a.description}
                          </p>
                          <p className="mt-2 text-xs theme-text-dim">
                            Ideal para: {a.idealFor}
                          </p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-5">
                  <div>
                    <div className="text-sm font-semibold theme-text-primary">
                      PASO 2 — Configuración
                    </div>
                    <div className="mt-1 text-sm theme-text-muted">
                      Define los detalles de la campaña.
                    </div>
                  </div>

                  {agentType ? (
                    <div className="rounded-xl border theme-border/80 theme-bg-base p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium theme-text-dim">
                          Agente seleccionado:
                        </span>
                        <span className="text-sm font-semibold theme-text-primary">
                          {agentEmojiById.get(agentType)} {AGENT_TYPES.find((a) => a.id === agentType)?.title}
                        </span>
                        <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-300">
                          OUTBOUND
                        </span>
                      </div>
                      <p className="mt-1 text-xs theme-text-muted">
                        {AGENT_TYPES.find((a) => a.id === agentType)?.description}
                      </p>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel htmlFor="campaignName">
                        Nombre de la campaña
                      </FieldLabel>
                      <input
                        id="campaignName"
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        placeholder="Ej. Campaña de Prospección Q2"
                      />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel htmlFor="companyName">
                        Nombre de empresa que llama
                      </FieldLabel>
                      <input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        placeholder="Ej. Krone"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-sm theme-text-muted">Idioma</div>
                      <div className="flex flex-wrap gap-2">
                        <PillButton
                          active={language === 'ES'}
                          onClick={() => setLanguage('ES')}
                        >
                          ES
                        </PillButton>
                        <PillButton
                          active={language === 'EN'}
                          onClick={() => setLanguage('EN')}
                        >
                          EN
                        </PillButton>
                        <PillButton
                          active={language === 'AUTO'}
                          onClick={() => setLanguage('AUTO')}
                        >
                          Auto
                        </PillButton>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm theme-text-muted">Plan</div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {(['BASIC', 'PRO', 'PREMIUM'] as Plan[]).map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPlan(p)}
                            className={[
                              'rounded-xl border px-3 py-2 text-left text-sm font-medium transition',
                              plan === p
                                ? 'border-[#22c55e] theme-bg-base theme-text-primary'
                                : 'theme-border/80 theme-bg-base theme-text-secondary hover:bg-zinc-900/40',
                            ].join(' ')}
                          >
                            {PLAN_LABEL[p]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <FieldLabel htmlFor="maxAttempts">
                        Máximo de intentos
                      </FieldLabel>
                      <select
                        id="maxAttempts"
                        value={maxAttempts}
                        onChange={(e) => setMaxAttempts(Number(e.target.value))}
                        className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                      >
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm theme-text-muted">
                        Horario de llamadas
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="time"
                          value={callStart}
                          onChange={(e) => setCallStart(e.target.value)}
                          className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        />
                        <input
                          type="time"
                          value={callEnd}
                          onChange={(e) => setCallEnd(e.target.value)}
                          className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        />
                      </div>
                      <div className="text-xs theme-text-dim">
                        Define la ventana diaria en la que se permiten llamadas.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm theme-text-muted">
                        ¿Enviar SMS si no contesta?
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={smsEnabled}
                        onClick={() => setSmsEnabled((v) => !v)}
                        className={[
                          'relative inline-flex h-6 w-11 shrink-0 rounded-full ring-1 transition',
                          smsEnabled
                            ? 'bg-[#22c55e] ring-[#22c55e]/30'
                            : 'bg-zinc-700 ring-zinc-600',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition',
                            smsEnabled ? 'translate-x-5' : 'translate-x-0.5',
                          ].join(' ')}
                          style={{ marginTop: 2 }}
                        />
                      </button>
                    </div>
                    {smsEnabled ? (
                      <div className="space-y-2">
                        <FieldLabel htmlFor="smsTemplate">Mensaje SMS</FieldLabel>
                        <textarea
                          id="smsTemplate"
                          value={smsTemplate}
                          onChange={(e) =>
                            setSmsTemplate(e.target.value.slice(0, 160))
                          }
                          maxLength={160}
                          rows={3}
                          placeholder="Hola {nombre}, le llamé de parte de {empresa}. ¿Le llamo después?"
                          className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                        />
                        <div className="flex items-center justify-between text-xs theme-text-dim">
                          <span>
                            Variables disponibles: {'{nombre}'}, {'{empresa}'}
                          </span>
                          <span>{smsTemplate.length}/160</span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm theme-text-muted">Nicho</div>
                    {nichos.length === 0 ? (
                      <div className="text-xs theme-text-dim">
                        No hay nichos configurados
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {CATEGORIAS_NICHO.map((cat) => {
                          const nichosInCat = nichos.filter(
                            (n) => getNichoCategoriaKey(n.nicho) === cat.key
                          )
                          if (nichosInCat.length === 0) return null
                          return (
                            <div key={cat.key}>
                              <div className="mb-2 flex items-center gap-2 text-xs font-medium theme-text-muted">
                                <span>{cat.emoji}</span>
                                <span>{cat.label}</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {nichosInCat.map((n) => {
                                  const active = selectedNichoId === n.id
                                  const emoji = getNichoEmoji(n.nicho)
                                  return (
                                    <button
                                      key={n.id}
                                      type="button"
                                      onClick={() => setSelectedNichoId(n.id)}
                                      className={[
                                        'rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition',
                                        active
                                          ? 'bg-[#22c55e] text-[#0b0b0b] ring-[#22c55e]'
                                          : 'theme-bg-base theme-text-secondary ring-zinc-800/80 hover:bg-zinc-900/40',
                                      ].join(' ')}
                                    >
                                      <span className="mr-1">{emoji}</span>
                                      {n.nicho}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {error ? (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {error}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-5">
                  <div>
                    <div className="text-sm font-semibold theme-text-primary">
                      PASO 3 — Confirmar
                    </div>
                    <div className="mt-1 text-sm theme-text-muted">
                      Revisa el resumen antes de crear la campaña.
                    </div>
                  </div>

                  <div className="rounded-2xl border theme-border/80 theme-bg-base p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-wide theme-text-dim">
                          Tipo de agente
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium theme-text-primary">
                            {selectedAgentLabel}
                          </span>
                          <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-300">
                            OUTBOUND
                          </span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide theme-text-dim">
                          Plan
                        </div>
                        <div className="mt-1 text-sm font-medium theme-text-primary">
                          {PLAN_LABEL[plan]}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide theme-text-dim">
                          Nombre de campaña
                        </div>
                        <div className="mt-1 text-sm font-medium theme-text-primary">
                          {campaignName || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide theme-text-dim">
                          Empresa que llama
                        </div>
                        <div className="mt-1 text-sm font-medium theme-text-primary">
                          {companyName || '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide theme-text-dim">
                          Idioma
                        </div>
                        <div className="mt-1 text-sm font-medium theme-text-primary">
                          {language}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide theme-text-dim">
                          Nicho
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {(selectedNichoLabel || userDefaultNicho) ? (
                            <span className="inline-flex items-center rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-xs font-medium text-[#22c55e] ring-1 ring-[#22c55e]/30">
                              {getNichoEmoji(selectedNichoLabel || userDefaultNicho)}
                              {' '}
                              {selectedNichoLabel || userDefaultNicho}
                            </span>
                          ) : (
                            <span className="text-sm font-medium theme-text-primary">—</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide theme-text-dim">
                          Máx. intentos
                        </div>
                        <div className="mt-1 text-sm font-medium theme-text-primary">
                          {maxAttempts}
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <div className="text-xs uppercase tracking-wide theme-text-dim">
                          Horario de llamadas
                        </div>
                        <div className="mt-1 text-sm font-medium theme-text-primary">
                          {callStart} — {callEnd}
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-2 text-xs theme-text-muted">
                      ℹ️ Tu campaña quedará en estado BORRADOR. Actívala cuando estés listo para empezar.
                    </p>
                  </div>

                  {error ? (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {error}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t theme-border/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-3 py-2 text-sm font-medium theme-text-secondary ring-1 ring-zinc-800/80 hover:bg-zinc-900/40 transition"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-2 justify-end">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setStep((s) => (s === 3 ? 2 : 1))
                    }}
                    className="rounded-lg px-3 py-2 text-sm font-medium theme-text-secondary ring-1 ring-zinc-800/80 hover:bg-zinc-900/40 transition"
                  >
                    Atrás
                  </button>
                ) : null}

                {step < 3 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      if (step === 1) {
                        if (!canGoStep2()) {
                          setError('Selecciona un tipo de agente para continuar.')
                          return
                        }
                        setStep(2)
                        return
                      }
                      if (step === 2) {
                        if (!canGoStep3()) {
                          setError(
                            'Completa la configuración (nombre de campaña y empresa) para continuar.',
                          )
                          return
                        }
                        setStep(3)
                      }
                    }}
                    className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
                  >
                    Siguiente
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onCreateCampaign}
                    disabled={saving}
                    className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    {saving ? 'Creando...' : 'Crear Campaña'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={closeEditModal}
            className="absolute inset-0 bg-black/70"
            aria-label="Cerrar modal de edición"
          />

          <div className="relative w-full max-w-3xl rounded-2xl border theme-border/80 theme-bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b theme-border/80 px-5 py-4">
              <div className="text-base font-semibold theme-text-primary">
                Editar Campaña
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg p-2 theme-text-muted hover:bg-zinc-900/40 hover:theme-text-primary transition"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-5 py-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel htmlFor="editNombre">Nombre</FieldLabel>
                  <input
                    id="editNombre"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="editEmpresaNombre">Empresa</FieldLabel>
                  <input
                    id="editEmpresaNombre"
                    value={editEmpresaNombre}
                    onChange={(e) => setEditEmpresaNombre(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="editNicho">Nicho</FieldLabel>
                  <select
                    id="editNicho"
                    value={editNicho}
                    onChange={(e) => setEditNicho(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  >
                    <option value="">Sin nicho</option>
                    {nichos.map((n) => (
                      <option key={n.id} value={n.nicho}>
                        {n.nicho}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="editAgenteTipo">Tipo de agente</FieldLabel>
                  <select
                    id="editAgenteTipo"
                    value={editAgenteTipo}
                    onChange={(e) => setEditAgenteTipo(e.target.value as AgentTypeId)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  >
                    {AGENT_TYPES.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.emoji} {a.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="editIdioma">Idioma</FieldLabel>
                  <select
                    id="editIdioma"
                    value={editIdioma}
                    onChange={(e) => setEditIdioma(e.target.value as Language)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  >
                    <option value="ES">ES</option>
                    <option value="EN">EN</option>
                    <option value="AUTO">AUTO</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="editStatus">Status</FieldLabel>
                  <select
                    id="editStatus"
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as 'active' | 'paused' | 'completed')
                    }
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  >
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="completed">completed</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="editMaxIntentos">Max intentos</FieldLabel>
                  <input
                    id="editMaxIntentos"
                    type="number"
                    min={1}
                    max={20}
                    value={editMaxIntentos}
                    onChange={(e) =>
                      setEditMaxIntentos(Math.min(20, Math.max(1, Number(e.target.value) || 1)))
                    }
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="editCadenciaDias">Cadencia (días)</FieldLabel>
                  <input
                    id="editCadenciaDias"
                    type="number"
                    value={editCadenciaDias}
                    onChange={(e) => setEditCadenciaDias(Number(e.target.value) || 0)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="editHoraInicio">Hora inicio</FieldLabel>
                  <input
                    id="editHoraInicio"
                    type="time"
                    value={editHoraInicio}
                    onChange={(e) => setEditHoraInicio(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
                <div className="space-y-2">
                  <FieldLabel htmlFor="editHoraFin">Hora fin</FieldLabel>
                  <input
                    id="editHoraFin"
                    type="time"
                    value={editHoraFin}
                    onChange={(e) => setEditHoraFin(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel htmlFor="editGoogleReviewLink">Google review link</FieldLabel>
                  <input
                    id="editGoogleReviewLink"
                    type="text"
                    value={editGoogleReviewLink}
                    onChange={(e) => setEditGoogleReviewLink(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm theme-text-muted">SMS habilitado</div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editSmsEnabled}
                    onClick={() => setEditSmsEnabled((v) => !v)}
                    className={[
                      'relative inline-flex h-6 w-11 shrink-0 rounded-full ring-1 transition',
                      editSmsEnabled
                        ? 'bg-[#22c55e] ring-[#22c55e]/30'
                        : 'bg-zinc-700 ring-zinc-600',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition',
                        editSmsEnabled ? 'translate-x-5' : 'translate-x-0.5',
                      ].join(' ')}
                      style={{ marginTop: 2 }}
                    />
                  </button>
                </div>
                {editSmsEnabled ? (
                  <div className="space-y-2">
                    <FieldLabel htmlFor="editSmsTemplate">Template SMS</FieldLabel>
                    <textarea
                      id="editSmsTemplate"
                      value={editSmsTemplate}
                      onChange={(e) => setEditSmsTemplate(e.target.value.slice(0, 160))}
                      maxLength={160}
                      rows={3}
                      className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t theme-border/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void onSaveCampaignEdit()}
                disabled={savingEdit}
                className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {savingEdit ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

