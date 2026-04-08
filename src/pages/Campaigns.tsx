import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { Link, useLocation, useNavigate } from 'react-router-dom'

type AgentTypeId =
  | 'cold_call'
  | 'collections'
  | 'birthday'
  | 'mothers_day'
  | 'appointment_reminder'
  | 'ask_referrals'
  | 'referral_gift'
  | 'custom'
  | 'appointment_confirmation'
  | 'web_lead'
  | 'facebook_lead'
  | 'reactivation'
  | 'google_review'
  | 'quote_followup'
  | 'inbound_receptionist'

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

const EXTRA_AGENT_TYPES: Array<{
  id: AgentTypeId
  title: string
  emoji: string
  description: string
  idealFor: string
}> = [
  {
    id: 'appointment_confirmation',
    title: 'Confirmación de Cita',
    emoji: '📅',
    description: 'Confirma citas programadas y reduce no-shows.',
    idealFor: 'clínicas, servicios con agenda',
  },
  {
    id: 'web_lead',
    title: 'Leads página web',
    emoji: '🌐',
    description: 'Responde a leads de formularios web al instante.',
    idealFor: 'sitios con formulario de contacto',
  },
  {
    id: 'facebook_lead',
    title: 'Leads Meta Ads',
    emoji: '📘',
    description: 'Llama a leads de Facebook e Instagram Ads.',
    idealFor: 'campañas Lead Ads',
  },
  {
    id: 'reactivation',
    title: 'Reactivación de clientes',
    emoji: '🔄',
    description: 'Vuelve a contactar clientes inactivos con ofertas.',
    idealFor: 'bases históricas',
  },
  {
    id: 'google_review',
    title: 'Reseñas Google',
    emoji: '⭐',
    description: 'Pide reseñas a clientes satisfechos.',
    idealFor: 'reputación local',
  },
  {
    id: 'quote_followup',
    title: 'Seguimiento de cotización',
    emoji: '💰',
    description: 'Da seguimiento tras enviar cotizaciones.',
    idealFor: 'equipos de ventas',
  },
  {
    id: 'inbound_receptionist',
    title: 'Recepcionista virtual',
    emoji: '📞',
    description: 'Atiende llamadas entrantes automáticamente.',
    idealFor: 'línea 24/7',
  },
]

const ALL_AGENT_TYPES = [...AGENT_TYPES, ...EXTRA_AGENT_TYPES]

type CampaignTemplateDef = {
  id: string
  emoji: string
  name: string
  description: string
  badge: string
  badgeClass: string
  requiresIntegration: boolean
  cardClass: string
  bannerVariant: 'yellow' | 'blue' | 'green' | null
  bannerText: string | null
  config: {
    agente_tipo: AgentTypeId
    max_intentos: number
    cadencia_dias: number
    hora_inicio: string
    hora_fin: string
    status: 'draft' | 'active'
  }
}

const CAMPAIGN_TEMPLATES: CampaignTemplateDef[] = [
  {
    id: 'prospeccion-frio',
    emoji: '🎯',
    name: 'Prospección en Frío',
    description: 'Llama a leads nuevos y presenta tu servicio. Ideal para cualquier nicho.',
    badge: 'Más popular',
    badgeClass: 'bg-[#22c55e]/20 text-[#86efac] ring-[#22c55e]/30',
    requiresIntegration: false,
    cardClass: 'hover:border-[#22c55e]/60',
    bannerVariant: null,
    bannerText: null,
    config: {
      agente_tipo: 'cold_call',
      max_intentos: 5,
      cadencia_dias: 2,
      hora_inicio: '09:00',
      hora_fin: '20:00',
      status: 'active',
    },
  },
  {
    id: 'confirmacion-cita',
    emoji: '📅',
    name: 'Confirmación de Cita',
    description: 'Confirma citas programadas y reduce los no-shows hasta un 80%.',
    badge: 'Alta conversión',
    badgeClass: 'bg-sky-500/20 text-sky-300 ring-sky-500/30',
    requiresIntegration: false,
    cardClass: 'hover:border-sky-500/50',
    bannerVariant: null,
    bannerText: null,
    config: {
      agente_tipo: 'appointment_confirmation',
      max_intentos: 3,
      cadencia_dias: 1,
      hora_inicio: '08:00',
      hora_fin: '18:00',
      status: 'draft',
    },
  },
  {
    id: 'leads-web',
    emoji: '🌐',
    name: 'Leads Página Web',
    description: 'Responde automáticamente a leads de tu sitio web en menos de 60 segundos.',
    badge: 'Respuesta rápida',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/30',
    requiresIntegration: true,
    cardClass: 'border-dashed border-cyan-500/40 hover:border-cyan-400/70',
    bannerVariant: 'yellow',
    bannerText:
      '⚡ Requiere conectar tu formulario web en Integraciones → CRM Personalizado',
    config: {
      agente_tipo: 'web_lead',
      max_intentos: 4,
      cadencia_dias: 1,
      hora_inicio: '08:00',
      hora_fin: '21:00',
      status: 'draft',
    },
  },
  {
    id: 'leads-meta',
    emoji: '📘',
    name: 'Leads Facebook/Instagram Ads',
    description: 'Llama a tus leads de Facebook e Instagram en segundos de que llenen el form.',
    badge: 'Meta Ads',
    badgeClass: 'bg-[#1877F2]/25 text-[#8bb3ff] ring-[#1877F2]/40',
    requiresIntegration: true,
    cardClass: 'border-dashed border-[#1877F2]/50 hover:border-[#1877F2]/80',
    bannerVariant: 'blue',
    bannerText: `📘 Requiere conectar Meta Lead Ads en Lead Response → Nueva fuente de leads

Pasos:
1. Ve a Lead Response en el menú
2. Clic en "+ Nueva Fuente de Leads"
3. Selecciona "Facebook/Instagram Ads"
4. Sigue las instrucciones de conexión`,
    config: {
      agente_tipo: 'facebook_lead',
      max_intentos: 5,
      cadencia_dias: 1,
      hora_inicio: '08:00',
      hora_fin: '21:00',
      status: 'draft',
    },
  },
  {
    id: 'reactivacion',
    emoji: '🔄',
    name: 'Reactivación de Clientes',
    description: 'Reactiva clientes inactivos con una oferta especial personalizada.',
    badge: 'Alto ROI',
    badgeClass: 'bg-amber-500/20 text-amber-200 ring-amber-500/35',
    requiresIntegration: false,
    cardClass: 'hover:border-amber-500/50',
    bannerVariant: null,
    bannerText: null,
    config: {
      agente_tipo: 'reactivation',
      max_intentos: 3,
      cadencia_dias: 3,
      hora_inicio: '10:00',
      hora_fin: '19:00',
      status: 'draft',
    },
  },
  {
    id: 'google-review',
    emoji: '⭐',
    name: 'Solicitar Reseñas Google',
    description: 'Llama a clientes satisfechos y pídeles que dejen una reseña en Google.',
    badge: 'Reputación',
    badgeClass: 'bg-yellow-500/20 text-yellow-200 ring-yellow-500/35',
    requiresIntegration: false,
    cardClass: 'hover:border-yellow-500/45',
    bannerVariant: null,
    bannerText: null,
    config: {
      agente_tipo: 'google_review',
      max_intentos: 2,
      cadencia_dias: 1,
      hora_inicio: '10:00',
      hora_fin: '18:00',
      status: 'draft',
    },
  },
  {
    id: 'cotizacion',
    emoji: '💰',
    name: 'Seguimiento de Cotización',
    description: 'Haz seguimiento a clientes que recibieron una cotización pero no compraron.',
    badge: 'Ventas',
    badgeClass: 'bg-orange-500/20 text-orange-200 ring-orange-500/35',
    requiresIntegration: false,
    cardClass: 'hover:border-orange-500/50',
    bannerVariant: null,
    bannerText: null,
    config: {
      agente_tipo: 'quote_followup',
      max_intentos: 4,
      cadencia_dias: 2,
      hora_inicio: '09:00',
      hora_fin: '19:00',
      status: 'draft',
    },
  },
  {
    id: 'recepcionista',
    emoji: '📞',
    name: 'Recepcionista Virtual 24/7',
    description: 'Atiende llamadas entrantes automáticamente las 24 horas del día.',
    badge: 'Inbound',
    badgeClass: 'bg-violet-500/20 text-violet-200 ring-violet-500/35',
    requiresIntegration: true,
    cardClass: 'border-dashed border-violet-500/45 hover:border-violet-400/70',
    bannerVariant: 'green',
    bannerText:
      '📞 Para activar llamadas entrantes ve a Recepcionista Virtual en el menú lateral',
    config: {
      agente_tipo: 'inbound_receptionist',
      max_intentos: 1,
      cadencia_dias: 0,
      hora_inicio: '00:00',
      hora_fin: '23:59',
      status: 'draft',
    },
  },
]

function getAgentTypeMeta(id: AgentTypeId | null) {
  if (!id) return null
  return ALL_AGENT_TYPES.find((a) => a.id === id) ?? null
}

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
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [modalPhase, setModalPhase] = useState<'choice' | 'templates' | 'wizard'>('choice')
  const [wizardFromTemplate, setWizardFromTemplate] = useState(false)
  const [templateBannerText, setTemplateBannerText] = useState<string | null>(null)
  const [templateBannerVariant, setTemplateBannerVariant] = useState<
    'yellow' | 'blue' | 'green' | null
  >(null)
  const [newCampaignStatus, setNewCampaignStatus] = useState<'draft' | 'active'>('draft')
  const [step, setStep] = useState<1 | 2 | 3>(1)

  const [agentType, setAgentType] = useState<AgentTypeId | null>(null)
  const [campaignName, setCampaignName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [language, setLanguage] = useState<Language>('ES')
  const [plan, setPlan] = useState<Plan>('BASIC')
  const [maxAttempts, setMaxAttempts] = useState<number>(3)
  const [cadenciaDias, setCadenciaDias] = useState(1)
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

  const [creditsPlanVoz, setCreditsPlanVoz] = useState<string | null>(null)
  const [smsDisponibles, setSmsDisponibles] = useState(0)
  const [smsUpsellOpen, setSmsUpsellOpen] = useState(false)
  const [complianceSigned, setComplianceSigned] = useState<boolean | null>(null)
  const [complianceGateOpen, setComplianceGateOpen] = useState(false)

  const anyModalOpen = open || editOpen || smsUpsellOpen || complianceGateOpen
  useEffect(() => {
    if (anyModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [anyModalOpen])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const uid = session?.user?.id
        if (!uid) {
          if (mounted) setComplianceSigned(false)
          return
        }
        const { data, error } = await supabase
          .from('compliance_agreements')
          .select('id')
          .eq('user_id', uid)
          .limit(1)
          .maybeSingle()
        if (!mounted) return
        if (error) {
          setComplianceSigned(true)
          return
        }
        setComplianceSigned(!!data?.id)
      } catch {
        if (mounted) setComplianceSigned(true)
      }
    })()
    return () => {
      mounted = false
    }
  }, [location.pathname])

  const nicheSelectClassName =
    'w-full rounded-lg bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]'

  const selectedAgentLabel = useMemo(() => {
    const found = getAgentTypeMeta(agentType)
    return found ? `${found.emoji} ${found.title}` : 'No seleccionado'
  }, [agentType])

  const agentEmojiById = useMemo(() => {
    const map = new Map<AgentTypeId, string>()
    for (const a of ALL_AGENT_TYPES) map.set(a.id, a.emoji)
    return map
  }, [])

  const selectedNichoLabel = useMemo(() => {
    const found = nichos.find((n) => n.id === selectedNichoId)
    return found?.nicho ?? ''
  }, [nichos, selectedNichoId])

  function handleSmsToggleClick() {
    if (smsEnabled) {
      setSmsEnabled(false)
      return
    }
    const plan = (creditsPlanVoz ?? '').toLowerCase()
    if (plan === 'cazador') {
      setSmsEnabled(true)
      return
    }
    if (plan === 'prospectador' || plan === 'vendedor') {
      if (smsDisponibles > 0) {
        setSmsEnabled(true)
        return
      }
      setSmsUpsellOpen(true)
      return
    }
    if (smsDisponibles > 0) {
      setSmsEnabled(true)
      return
    }
    setSmsUpsellOpen(true)
  }

  function resetForm() {
    setModalPhase('choice')
    setWizardFromTemplate(false)
    setTemplateBannerText(null)
    setTemplateBannerVariant(null)
    setNewCampaignStatus('draft')
    setStep(1)
    setAgentType(null)
    setCampaignName('')
    setCompanyName('')
    setLanguage('ES')
    setPlan('BASIC')
    setMaxAttempts(3)
    setCadenciaDias(1)
    setCallStart('09:00')
    setCallEnd('18:00')
    setSmsEnabled(false)
    setSmsTemplate('')
    setSaving(false)
    setError(null)
  }

  function openModal() {
    if (complianceSigned === false) {
      setComplianceGateOpen(true)
      return
    }
    if (complianceSigned === null) return
    resetForm()
    setOpen(true)
  }

  function openModalToTemplates() {
    if (complianceSigned === false) {
      setComplianceGateOpen(true)
      return
    }
    if (complianceSigned === null) return
    resetForm()
    setModalPhase('templates')
    setOpen(true)
  }

  function applyTemplate(t: CampaignTemplateDef) {
    if (complianceSigned === false) {
      setComplianceGateOpen(true)
      return
    }
    if (complianceSigned === null) return
    const cfg = t.config
    setAgentType(cfg.agente_tipo)
    setCampaignName(`Plantilla - ${t.name}`)
    setCompanyName('')
    setMaxAttempts(Math.min(10, Math.max(1, cfg.max_intentos)))
    setCadenciaDias(Math.max(0, cfg.cadencia_dias))
    setCallStart(cfg.hora_inicio)
    setCallEnd(cfg.hora_fin)
    setNewCampaignStatus(cfg.status)
    setTemplateBannerText(t.bannerText)
    setTemplateBannerVariant(t.bannerVariant)
    setSmsEnabled(false)
    setSmsTemplate('')
    setWizardFromTemplate(true)
    setModalPhase('wizard')
    setStep(2)
    setError(null)
    setOpen(true)
  }

  function closeModal() {
    setOpen(false)
    resetForm()
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
        const [userRes, nichosRes, creditsRes] = await Promise.all([
          supabase.from('users').select('nicho').eq('id', userId).maybeSingle(),
          supabase
            .from('nicho_templates')
            .select('id, nicho')
            .order('nicho', { ascending: true }),
          supabase
            .from('credits')
            .select('plan_voz, sms_disponibles')
            .eq('user_id', userId)
            .maybeSingle(),
        ])

        if (!mounted) return
        // eslint-disable-next-line no-console
        console.log('users data:', userRes.data)
        // eslint-disable-next-line no-console
        console.log('users error:', userRes.error)

        const nichosData = nichosRes.data
        const list = (nichosData ?? []) as NichoTemplate[]
        setNichos(list)
        const cr = creditsRes.data as
          | { plan_voz?: string | null; sms_disponibles?: number | null }
          | null
        setCreditsPlanVoz(cr?.plan_voz != null ? String(cr.plan_voz) : null)
        setSmsDisponibles(
          Math.max(0, Math.floor(Number(cr?.sms_disponibles) || 0)),
        )
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
          setCreditsPlanVoz(null)
          setSmsDisponibles(0)
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
      cadenciaDias >= 0 &&
      cadenciaDias <= 30 &&
      callStart.length > 0 &&
      callEnd.length > 0
    )
  }

  async function onCreateCampaign() {
    setError(null)
    if (complianceSigned === false) {
      setComplianceGateOpen(true)
      setError('Debes firmar tu declaración de cumplimiento antes de crear campañas.')
      return
    }
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
        cadencia_dias: cadenciaDias,
        numero_telefono: '',
        nicho: selectedNichoLabel || userDefaultNicho || null,
        status: newCampaignStatus,
        sms_enabled: smsEnabled,
        sms_template: smsEnabled ? (smsTemplate.trim().slice(0, 160) || null) : null,
      }

      const { data: created, error: insertError } = await supabase
        .from('campaigns')
        .insert(payload)
        .select('id')
        .maybeSingle()

      if (insertError) {
        setError(insertError.message)
        return
      }

      void logActivity({
        accion: 'campana_creada',
        categoria: 'campana',
        detalle: {
          id: created?.id,
          nombre: payload.nombre,
          nicho: payload.nicho,
        },
      })

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
      void logActivity({
        accion: 'campana_editada',
        categoria: 'campana',
        detalle: { id: editingCampaignId, nombre: editNombre.trim() },
      })
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
      void logActivity({
        accion: 'campana_active',
        categoria: 'campana',
        detalle: { id },
      })
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
      void logActivity({
        accion: 'campana_paused',
        categoria: 'campana',
        detalle: { id },
      })
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
        cadencia_dias: c.cadencia_dias ?? 1,
        numero_telefono: '',
        nicho: c.nicho,
        status: 'draft',
        sms_enabled: c.sms_enabled ?? false,
        sms_template: null,
      }
      const { data: dup, error: insertError } = await supabase
        .from('campaigns')
        .insert(payload)
        .select('id')
        .maybeSingle()
      if (insertError) throw new Error(insertError.message)
      void logActivity({
        accion: 'campana_creada',
        categoria: 'campana',
        detalle: {
          id: dup?.id,
          nombre: payload.nombre,
          nicho: payload.nicho,
          duplicada_desde: c.id,
        },
      })
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
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={openModal}
            className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
          >
            + Nueva Campaña Outbound
          </button>
          <button
            type="button"
            onClick={openModalToTemplates}
            className="rounded-lg border border-zinc-700/80 bg-zinc-900/40 px-4 py-2 text-sm font-medium theme-text-muted hover:bg-zinc-800/60 transition"
          >
            Ver plantillas
          </button>
        </div>
      </div>

      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">
          Plantillas de campaña
        </h2>
        <p className="mt-1 text-sm theme-text-muted max-w-3xl">
          Crea campañas al instante con horarios, intentos y cadencia ya definidos. Solo elige nicho y
          nombre, o abre el asistente con &quot;Nueva campaña&quot; para elegir entre plantilla o
          configuración manual.
        </p>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CAMPAIGN_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTemplate(t)}
              className={[
                'relative text-left rounded-2xl border theme-border/80 theme-bg-base p-4 transition cursor-pointer',
                t.cardClass,
              ].join(' ')}
            >
              {t.requiresIntegration ? (
                <span className="absolute right-3 top-3 text-xs" title="Requiere configuración">
                  🔗
                </span>
              ) : null}
              <div className="flex items-start gap-2 pr-8">
                <span className="text-2xl">{t.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold theme-text-primary">{t.name}</div>
                  <p className="mt-1 text-xs theme-text-muted line-clamp-3">{t.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={[
                        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                        t.badgeClass,
                      ].join(' ')}
                    >
                      {t.badge}
                    </span>
                    {t.requiresIntegration ? (
                      <span className="inline-flex rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] font-medium theme-text-muted ring-1 ring-zinc-600/60">
                        Requiere config
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-3 inline-block text-xs font-semibold text-[#22c55e]">
                    Usar plantilla →
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
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
                  {modalPhase === 'choice'
                    ? 'Nueva campaña'
                    : modalPhase === 'templates'
                      ? 'Plantillas de campaña'
                      : 'Nueva Campaña'}
                </div>
                <div className="mt-1 text-sm theme-text-muted">
                  {modalPhase === 'wizard'
                    ? `Paso ${step} de 3`
                    : modalPhase === 'choice'
                      ? '¿Cómo quieres crear tu campaña?'
                      : 'Elige una plantilla o vuelve atrás'}
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
              {modalPhase === 'choice' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        setModalPhase('templates')
                      }}
                      className="rounded-2xl border border-[#22c55e]/50 bg-[#22c55e]/10 px-5 py-8 text-left transition hover:bg-[#22c55e]/15 hover:border-[#22c55e] cursor-pointer"
                    >
                      <div className="text-lg font-semibold theme-text-primary">
                        Desde plantilla
                      </div>
                      <p className="mt-2 text-sm theme-text-muted">
                        Configuración predefinida para empezar en segundos.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null)
                        setWizardFromTemplate(false)
                        setModalPhase('wizard')
                        setStep(1)
                        setTemplateBannerText(null)
                        setTemplateBannerVariant(null)
                        setNewCampaignStatus('draft')
                      }}
                      className="rounded-2xl border theme-border/80 theme-bg-base px-5 py-8 text-left transition hover:border-zinc-600 hover:bg-zinc-900/30 cursor-pointer"
                    >
                      <div className="text-lg font-semibold theme-text-primary">
                        Crear desde cero
                      </div>
                      <p className="mt-2 text-sm theme-text-muted">
                        Elige el tipo de agente y configura todo manualmente.
                      </p>
                    </button>
                  </div>
                </div>
              ) : null}

              {modalPhase === 'templates' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {CAMPAIGN_TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className={[
                          'relative text-left rounded-2xl border theme-border/80 theme-bg-base p-4 transition cursor-pointer',
                          t.cardClass,
                        ].join(' ')}
                      >
                        {t.requiresIntegration ? (
                          <span className="absolute right-3 top-3 text-xs" title="Requiere configuración">
                            🔗
                          </span>
                        ) : null}
                        <div className="flex items-start gap-2 pr-8">
                          <span className="text-2xl">{t.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold theme-text-primary">
                              {t.name}
                            </div>
                            <p className="mt-1 text-xs theme-text-muted line-clamp-3">
                              {t.description}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span
                                className={[
                                  'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                                  t.badgeClass,
                                ].join(' ')}
                              >
                                {t.badge}
                              </span>
                              {t.requiresIntegration ? (
                                <span className="inline-flex rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] font-medium theme-text-muted ring-1 ring-zinc-600/60">
                                  Requiere config
                                </span>
                              ) : null}
                            </div>
                            <span className="mt-3 inline-block text-xs font-semibold text-[#22c55e]">
                              Usar plantilla →
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWizardFromTemplate(false)
                      setModalPhase('wizard')
                      setStep(1)
                      setTemplateBannerText(null)
                      setTemplateBannerVariant(null)
                      setNewCampaignStatus('draft')
                    }}
                    className="w-full rounded-xl border border-zinc-700/80 bg-zinc-900/40 px-4 py-3 text-sm font-medium theme-text-muted hover:bg-zinc-800/60 transition"
                  >
                    Crear desde cero
                  </button>
                </div>
              ) : null}

              {modalPhase === 'wizard' && step === 1 ? (
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

              {modalPhase === 'wizard' && step === 2 ? (
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
                          {agentEmojiById.get(agentType)}{' '}
                          {getAgentTypeMeta(agentType)?.title}
                        </span>
                        <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-medium text-orange-300">
                          OUTBOUND
                        </span>
                      </div>
                      <p className="mt-1 text-xs theme-text-muted">
                        {getAgentTypeMeta(agentType)?.description}
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

                  <div className="space-y-2 max-w-xs">
                    <FieldLabel htmlFor="cadenciaDias">
                      Cadencia (días entre intentos)
                    </FieldLabel>
                    <select
                      id="cadenciaDias"
                      value={cadenciaDias}
                      onChange={(e) => setCadenciaDias(Number(e.target.value))}
                      className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    >
                      {Array.from({ length: 31 }, (_, i) => i).map((n) => (
                        <option key={n} value={n}>
                          {n === 0 ? 'Sin espera (0)' : `${n} día${n === 1 ? '' : 's'}`}
                        </option>
                      ))}
                    </select>
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
                        onClick={handleSmsToggleClick}
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
                    {(creditsPlanVoz ?? '').toLowerCase() === 'cazador' ? (
                      <p className="text-xs text-emerald-300/95">
                        ✅ Tu plan Cazador incluye SMS automático
                      </p>
                    ) : null}
                    {(creditsPlanVoz ?? '').toLowerCase() !== 'cazador' &&
                    smsDisponibles > 0 ? (
                      <p className="text-xs text-zinc-400">
                        💬 Tienes {smsDisponibles} SMS disponibles ($0.08 por
                        mensaje — descontado de tus créditos)
                      </p>
                    ) : null}
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
                    <FieldLabel htmlFor="campaignNicho">Nicho</FieldLabel>
                    {nichos.length === 0 ? (
                      <div className="text-xs theme-text-dim">
                        No hay nichos configurados
                      </div>
                    ) : (
                      <select
                        id="campaignNicho"
                        value={selectedNichoId ?? ''}
                        onChange={(e) =>
                          setSelectedNichoId(e.target.value ? e.target.value : null)
                        }
                        className={nicheSelectClassName}
                      >
                        <option value="">Selecciona un nicho</option>
                        {CATEGORIAS_NICHO.map((cat) => {
                          const nichosInCat = nichos.filter(
                            (n) => getNichoCategoriaKey(n.nicho) === cat.key,
                          )
                          if (nichosInCat.length === 0) return null
                          return (
                            <optgroup
                              key={cat.key}
                              label={`${cat.emoji} ${cat.label}`}
                            >
                              {nichosInCat.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {getNichoEmoji(n.nicho)} {n.nicho}
                                </option>
                              ))}
                            </optgroup>
                          )
                        })}
                      </select>
                    )}
                  </div>

                  {templateBannerText ? (
                    <div
                      className={[
                        'rounded-xl border px-3 py-3 text-xs theme-text-secondary whitespace-pre-wrap',
                        templateBannerVariant === 'yellow'
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                          : templateBannerVariant === 'blue'
                            ? 'border-sky-500/40 bg-sky-500/10 text-sky-100'
                            : templateBannerVariant === 'green'
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                              : 'border-zinc-600 bg-zinc-900/40',
                      ].join(' ')}
                    >
                      {templateBannerText}
                    </div>
                  ) : null}

                  {error ? (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {error}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {modalPhase === 'wizard' && step === 3 ? (
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
                      <div>
                        <div className="text-xs uppercase tracking-wide theme-text-dim">
                          Cadencia
                        </div>
                        <div className="mt-1 text-sm font-medium theme-text-primary">
                          {cadenciaDias === 0
                            ? 'Sin espera entre intentos'
                            : `${cadenciaDias} día${cadenciaDias === 1 ? '' : 's'}`}
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
                      <div>
                        <div className="text-xs uppercase tracking-wide theme-text-dim">
                          Estado al crear
                        </div>
                        <div className="mt-1 text-sm font-medium theme-text-primary">
                          {newCampaignStatus === 'active' ? 'Activa' : 'Borrador'}
                        </div>
                      </div>
                    </div>
                    {templateBannerText ? (
                      <div
                        className={[
                          'mt-4 rounded-xl border px-3 py-3 text-xs whitespace-pre-wrap',
                          templateBannerVariant === 'yellow'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                            : templateBannerVariant === 'blue'
                              ? 'border-sky-500/40 bg-sky-500/10 text-sky-100'
                              : templateBannerVariant === 'green'
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                                : 'border-zinc-600 bg-zinc-900/40 theme-text-secondary',
                        ].join(' ')}
                      >
                        {templateBannerText}
                      </div>
                    ) : null}
                    <p className="mt-4 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-3 py-2 text-xs theme-text-muted">
                      {newCampaignStatus === 'active' ? (
                        <>
                          ℹ️ La campaña se creará en estado{' '}
                          <span className="font-semibold text-[#86efac]">ACTIVA</span>. Puedes pausarla
                          desde el listado cuando quieras.
                        </>
                      ) : (
                        <>
                          ℹ️ Tu campaña quedará en estado{' '}
                          <span className="font-semibold">BORRADOR</span>. Actívala cuando estés listo
                          para empezar.
                        </>
                      )}
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
                {modalPhase === 'choice' ? null : modalPhase === 'templates' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setModalPhase('choice')
                    }}
                    className="rounded-lg px-3 py-2 text-sm font-medium theme-text-secondary ring-1 ring-zinc-800/80 hover:bg-zinc-900/40 transition"
                  >
                    Volver
                  </button>
                ) : modalPhase === 'wizard' && step > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      if (step === 3) {
                        setStep(2)
                        return
                      }
                      if (step === 2) {
                        if (wizardFromTemplate) {
                          setModalPhase('templates')
                          setStep(1)
                          setWizardFromTemplate(false)
                          return
                        }
                        setStep(1)
                      }
                    }}
                    className="rounded-lg px-3 py-2 text-sm font-medium theme-text-secondary ring-1 ring-zinc-800/80 hover:bg-zinc-900/40 transition"
                  >
                    Atrás
                  </button>
                ) : modalPhase === 'wizard' && step === 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setModalPhase('choice')
                      setStep(1)
                    }}
                    className="rounded-lg px-3 py-2 text-sm font-medium theme-text-secondary ring-1 ring-zinc-800/80 hover:bg-zinc-900/40 transition"
                  >
                    Volver
                  </button>
                ) : null}

                {modalPhase === 'choice' || modalPhase === 'templates' ? null : step < 3 ? (
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
                    className={nicheSelectClassName}
                  >
                    <option value="">Selecciona un nicho</option>
                    {CATEGORIAS_NICHO.map((cat) => {
                      const nichosInCat = nichos.filter(
                        (n) => getNichoCategoriaKey(n.nicho) === cat.key,
                      )
                      if (nichosInCat.length === 0) return null
                      return (
                        <optgroup
                          key={cat.key}
                          label={`${cat.emoji} ${cat.label}`}
                        >
                          {nichosInCat.map((n) => (
                            <option key={n.id} value={n.nicho}>
                              {getNichoEmoji(n.nicho)} {n.nicho}
                            </option>
                          ))}
                        </optgroup>
                      )
                    })}
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
                    {ALL_AGENT_TYPES.map((a) => (
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

      {smsUpsellOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sms-upsell-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/75"
            aria-label="Cerrar"
            onClick={() => setSmsUpsellOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5 shadow-2xl ring-1 ring-zinc-800/80">
            <h3
              id="sms-upsell-title"
              className="text-base font-semibold tracking-tight text-zinc-100"
            >
              📱 SMS Automático
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Para enviar SMS necesitas:
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="flex flex-col rounded-xl border border-zinc-700 bg-zinc-950/80 p-4">
                <div className="text-lg">💳</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">
                  Recargar créditos SMS
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  $0.08 por SMS
                  <br />
                  Paga solo lo que uses
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/credits')
                    setSmsUpsellOpen(false)
                  }}
                  className="mt-4 w-full rounded-lg border border-zinc-600 bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition"
                >
                  Recargar →
                </button>
              </div>
              <div className="relative flex flex-col rounded-xl border border-[#22c55e]/55 bg-zinc-950/80 p-4 ring-1 ring-[#22c55e]/25">
                <span className="absolute -top-2.5 right-2 rounded-full bg-[#22c55e] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#0b0b0b]">
                  Recomendado
                </span>
                <div className="text-lg">⬆️</div>
                <div className="mt-1 text-sm font-semibold text-zinc-100">
                  Cambiar al Plan Cazador
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  $0.90/min
                  <br />
                  SMS incluido sin costo extra
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/credits')
                    setSmsUpsellOpen(false)
                  }}
                  className="mt-4 w-full rounded-lg bg-[#22c55e] px-3 py-2 text-xs font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
                >
                  Ver plan →
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSmsUpsellOpen(false)}
              className="mt-4 w-full rounded-lg border border-zinc-700/80 px-3 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200 transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {complianceGateOpen ? (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="compliance-gate-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/75"
            aria-label="Cerrar"
            onClick={() => setComplianceGateOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5 shadow-2xl ring-1 ring-amber-500/20">
            <h3
              id="compliance-gate-title"
              className="text-base font-semibold tracking-tight text-zinc-100"
            >
              Declaración de cumplimiento requerida
            </h3>
            <p className="mt-2 text-sm text-zinc-400">
              Debes firmar tu declaración de cumplimiento antes de lanzar campañas.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setComplianceGateOpen(false)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 hover:bg-zinc-900"
              >
                Cerrar
              </button>
              <Link
                to="/compliance"
                onClick={() => setComplianceGateOpen(false)}
                className="inline-flex items-center justify-center rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455]"
              >
                Ir a Compliance →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

