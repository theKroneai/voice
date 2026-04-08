import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  X,
  ChevronDown,
  ChevronUp,
  Home,
  Heart,
  Users,
  Building2,
  Scale,
  Dumbbell,
  Car,
  GraduationCap,
  Folder,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { parseEsAdmin } from '../lib/esAdmin'

type PhoneNumber = {
  id: string
  numero: string
  descripcion: string | null
  estado: string | null
  asignado_a: string | null
  rotacion: string | null
}

type AdminUser = {
  id: string
  email: string | null
  company_name: string | null
  nicho: string | null
  plan: string | null
  minutos_disponibles: number | null
  last_sign_in_at: string | null
}

type CreditsNestedRow = {
  plan_voz: string | null
  minutos_voz: number | null
  sms_disponibles: number | null
  saldo_referidos_usd: number | null
}

type UserCreditsAdminRow = {
  id: string
  email: string | null
  nombre: string | null
  created_at: string
  credits: CreditsNestedRow | null
}

const PLAN_VOZ_OPTIONS = ['prospectador', 'vendedor', 'cazador'] as const
type PlanVozAdmin = (typeof PLAN_VOZ_OPTIONS)[number]

function normalizeCreditsRelation(raw: unknown): CreditsNestedRow | null {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const first = raw[0] as CreditsNestedRow | undefined
    return first ?? null
  }
  return raw as CreditsNestedRow
}

function planVozBadgeClass(plan: string | null | undefined): string {
  const p = (plan ?? '').toLowerCase()
  if (p === 'cazador') return 'bg-emerald-500/20 text-emerald-300'
  if (p === 'vendedor') return 'bg-sky-500/20 text-sky-300'
  return 'bg-zinc-600/40 text-zinc-300'
}

function planVozLabel(plan: string | null | undefined): string {
  const p = (plan ?? '').toLowerCase()
  if (p === 'vendedor') return 'Vendedor'
  if (p === 'cazador') return 'Cazador'
  if (p === 'prospectador') return 'Prospectador'
  return plan?.trim() || '—'
}

type CallLog = {
  id: string
  user_id: string
  resumen: string | null
  duracion_minutos: number | null
  disposition: string | null
  costo_usd: number | null
  created_at: string
  user_email?: string
}

type SupportTicketRow = {
  id: string
  user_id: string | null
  descripcion: string
  pagina: string | null
  status: string | null
  respuesta_admin: string | null
  created_at: string
  user_email?: string | null
}

function supportTicketStatusClass(status: string | null | undefined): string {
  const s = (status ?? 'pendiente').toLowerCase()
  if (s === 'resuelto') return 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
  if (s === 'en_revision') return 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30'
  return 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/35'
}

type ComplianceAgreementAdminRow = {
  id: string
  user_id: string
  created_at: string
  company_name: string
  business_type: string
  country: string
  website: string | null
  contact_source: string
  contact_source_other: string | null
  consent_description: string
  privacy_policy_url: string | null
  opt_in_form_url: string | null
  decl_consent_contacts: boolean
  decl_laws: boolean
  decl_opt_out: boolean
  decl_responsibility: boolean
  ip_address: string | null
  user_agent: string | null
  terms_version: string | null
}

type ActivityLogRow = {
  id: string
  user_id: string | null
  accion: string
  categoria: string
  pagina: string | null
  detalle: Record<string, unknown> | null
  error_mensaje: string | null
  error_stack: string | null
  user_agent: string | null
  created_at: string
  users?: { email: string | null; nombre: string | null } | null
}

function formatActivityRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'hace un momento'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

function activityCategoriaBadgeClass(cat: string): string {
  const c = cat.toLowerCase()
  const ring = 'ring-1 '
  if (c === 'auth') return `bg-sky-500/20 text-sky-300 ${ring}ring-sky-500/30`
  if (c === 'navegacion') return `bg-zinc-600/30 text-zinc-300 ${ring}ring-zinc-500/30`
  if (c === 'campana') return `bg-emerald-500/20 text-emerald-300 ${ring}ring-emerald-500/30`
  if (c === 'contacto') return `bg-cyan-500/20 text-cyan-300 ${ring}ring-cyan-500/30`
  if (c === 'pago') return `bg-amber-500/25 text-amber-200 ${ring}ring-amber-500/35`
  if (c === 'llamada') return `bg-violet-500/20 text-violet-300 ${ring}ring-violet-500/30`
  if (c === 'error') return `bg-red-500/20 text-red-300 ${ring}ring-red-500/35`
  if (c === 'chatbot') return `bg-orange-500/20 text-orange-300 ${ring}ring-orange-500/35`
  if (c === 'creditos') return `bg-lime-500/15 text-lime-200 ${ring}ring-lime-500/25`
  if (c === 'secuencia') return `bg-teal-500/20 text-teal-300 ${ring}ring-teal-500/30`
  if (c === 'integracion') return `bg-indigo-500/20 text-indigo-300 ${ring}ring-indigo-500/30`
  return `bg-zinc-600/30 text-zinc-300 ${ring}ring-zinc-600/40`
}

type NichoTemplate = {
  id: string
  nicho: string
  categoria?: string | null
  nicho_problema: string | null
  nicho_contexto: string | null
  nicho_objetivo: string | null
  nicho_apertura: string | null
  nicho_pregunta_gancho: string | null
  nicho_oferta: string | null
  nicho_objecion_1: string | null
  nicho_objecion_ya_tiene: string | null
  nicho_urgencia: string | null
  nicho_urgencia_alta: string | null
  nicho_ultimo_intento: string | null
  nicho_descripcion_empresa: string | null
  nicho_contexto_corto: string | null
  objeciones_nicho_extra: string | null
}

type PlanConfigAdmin = {
  id: string
  plan_id: string
  nombre: string
  emoji: string | null
  precio_por_minuto: number
  descripcion: string | null
  features: string[]
  activo: boolean
}

type CrmCatalogRow = {
  id: string
  crm_type: string
  name: string
  description: string | null
  emoji: string | null
  logo_url: string | null
  badge: string | null
  badge_color: string | null
  sort_order: number | null
  is_visible: boolean | null
  plan_required: string | null
}

const DEFAULT_CRM_CATALOG: Record<string, Partial<CrmCatalogRow>> = {
  bitrix24: {
    name: 'Bitrix24',
    description: 'El CRM más popular en LATAM. Sincroniza leads, deals y actividades.',
    emoji: '🏢',
    badge: 'Popular en LATAM',
    badge_color: 'bg-emerald-500/15 text-emerald-300',
  },
  hubspot: {
    name: 'HubSpot',
    description: 'CRM líder mundial. Sincroniza contactos, deals y actividades.',
    emoji: '🟠',
  },
  gohighlevel: {
    name: 'GoHighLevel',
    description: 'El favorito de las agencias en EE.UU. Sincroniza contactos y oportunidades.',
    emoji: '⚡',
    badge: 'Favorito Agencias',
    badge_color: 'bg-fuchsia-500/15 text-fuchsia-300',
  },
  zoho: {
    name: 'Zoho CRM',
    description: 'CRM flexible para negocios en LATAM. Sincroniza leads y contactos.',
    emoji: '🔵',
    badge: 'Popular en LATAM',
    badge_color: 'bg-sky-500/15 text-sky-300',
  },
  salesforce: {
    name: 'Salesforce',
    description: 'CRM enterprise. Para equipos grandes.',
    emoji: '☁️',
    badge: 'Enterprise',
    badge_color: 'bg-indigo-500/15 text-indigo-300',
  },
  pipedrive: {
    name: 'Pipedrive',
    description: 'CRM para equipos de ventas. Simple y efectivo.',
    emoji: '🟢',
  },
  monday: {
    name: 'Monday.com',
    description: 'Gestión de proyectos y CRM. Sincroniza tareas y contactos.',
    emoji: '🎯',
  },
  custom: {
    name: 'CRM Personalizado',
    description:
      'Conecta cualquier CRM o sistema propio via webhook. Compatible con cualquier plataforma.',
    emoji: '🔧',
    badge: 'Flexible',
    badge_color: 'bg-amber-500/15 text-amber-300',
  },
}

const CATEGORIAS_NICHO_OPTIONS = [
  { value: 'Servicios del Hogar', label: 'Servicios del Hogar' },
  { value: 'Salud', label: 'Salud' },
  { value: 'Inmigrantes', label: 'Inmigrantes' },
  { value: 'Real Estate', label: 'Real Estate' },
  { value: 'Legal', label: 'Legal' },
  { value: 'Fitness', label: 'Fitness' },
  { value: 'Automotriz', label: 'Automotriz' },
  { value: 'Educación', label: 'Educación' },
  { value: 'Otro', label: 'Otro' },
] as const

const CATEGORIA_ICON: Record<string, LucideIcon> = {
  'Servicios del Hogar': Home,
  Salud: Heart,
  Inmigrantes: Users,
  'Real Estate': Building2,
  Legal: Scale,
  Fitness: Dumbbell,
  Automotriz: Car,
  Educación: GraduationCap,
  Otro: FolderOpen,
}

const NICHO_TO_CATEGORIA: Record<string, string> = {
  agua: 'Servicios del Hogar',
  roofing: 'Servicios del Hogar',
  siding: 'Servicios del Hogar',
  solar: 'Servicios del Hogar',
  pest_control: 'Servicios del Hogar',
  hvac: 'Servicios del Hogar',
  windows: 'Servicios del Hogar',
  insulation: 'Servicios del Hogar',
  remodeling: 'Servicios del Hogar',
  dental: 'Salud',
  optometria: 'Salud',
  medico_primario: 'Salud',
  quiropráctico: 'Salud',
  itin_taxes: 'Inmigrantes',
  seguros_inmigrantes: 'Inmigrantes',
  remesas: 'Inmigrantes',
  inmigracion: 'Inmigrantes',
  real_estate_compra: 'Real Estate',
  real_estate_venta: 'Real Estate',
  credito: 'Legal',
  gym: 'Fitness',
  nutricion: 'Fitness',
  auto_insurance: 'Automotriz',
  autos: 'Automotriz',
  ingles: 'Educación',
  internet: 'Educación',
  otro: 'Otro',
}

function getCategoriaFromNicho(nicho: string): string {
  const k = (nicho || '').toLowerCase().trim().replace(/\s+/g, '_')
  return NICHO_TO_CATEGORIA[k] ?? 'Otro'
}

function groupNichosByCategoria(nichos: NichoTemplate[]): { categoria: string; items: NichoTemplate[] }[] {
  const order = CATEGORIAS_NICHO_OPTIONS.map((c) => c.value)
  const map = new Map<string, NichoTemplate[]>()
  for (const n of nichos) {
    const cat = n.categoria?.trim() || getCategoriaFromNicho(n.nicho)
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(n)
  }
  const result: { categoria: string; items: NichoTemplate[] }[] = []
  for (const cat of order) {
    const items = map.get(cat)
    if (items?.length) result.push({ categoria: cat, items })
  }
  const remaining = [...map.keys()].filter((c) => !order.includes(c))
  for (const cat of remaining) result.push({ categoria: cat, items: map.get(cat)! })
  return result
}

const EMPTY_NICHO: Omit<NichoTemplate, 'id'> = {
  nicho: '',
  categoria: '',
  nicho_problema: '',
  nicho_contexto: '',
  nicho_objetivo: '',
  nicho_apertura: '',
  nicho_pregunta_gancho: '',
  nicho_oferta: '',
  nicho_objecion_1: '',
  nicho_objecion_ya_tiene: '',
  nicho_urgencia: '',
  nicho_urgencia_alta: '',
  nicho_ultimo_intento: '',
  nicho_descripcion_empresa: '',
  nicho_contexto_corto: '',
  objeciones_nicho_extra: '',
}

const DEFAULT_COST_PER_MIN_BASICO = 0.45
const DEFAULT_COST_PER_MIN_PRO = 0.75
const DEFAULT_COST_PER_MIN_PREMIUM = 0.9

const DEFAULT_RECARGA_MIN_PROSPECTADOR = 5
const DEFAULT_RECARGA_MIN_VENDEDOR = 5
const DEFAULT_RECARGA_MIN_CAZADOR = 5

function AdminCollapsibleSection({
  title,
  emoji,
  open,
  onToggle,
  children,
}: {
  title: string
  emoji?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border theme-border/80 theme-bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-[#0b0b0b]/80 bg-[#0b0b0b]/40"
      >
        <h2 className="text-base font-semibold theme-text-primary">
          {emoji ? `${emoji} ` : ''}
          {title}
        </h2>
        <span className="shrink-0 rounded-lg border border-[#22c55e]/35 bg-[#22c55e]/10 px-2.5 py-1 text-xs font-medium text-[#22c55e]">
          {open ? '▼ Colapsar' : '▶ Expandir'}
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t theme-border/80 px-5 pb-5 pt-4">{children}</div>
        </div>
      </div>
    </div>
  )
}

export default function Admin() {
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    totalCalls: 0,
    minutesToday: 0,
    revenueEst: 0,
  })
  const [priceBasico, setPriceBasico] = useState(DEFAULT_COST_PER_MIN_BASICO)
  const [pricePro, setPricePro] = useState(DEFAULT_COST_PER_MIN_PRO)
  const [pricePremium, setPricePremium] = useState(DEFAULT_COST_PER_MIN_PREMIUM)
  const [retellKey, setRetellKey] = useState('')
  const [retellStatus, setRetellStatus] = useState<'idle' | 'connected' | 'error'>('idle')
  const [savingRetell, setSavingRetell] = useState(false)
  const [retellError, setRetellError] = useState<string | null>(null)
  const [twilioAccountSid, setTwilioAccountSid] = useState('')
  const [twilioAuthToken, setTwilioAuthToken] = useState('')
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('')
  const [savingTwilio, setSavingTwilio] = useState(false)
  const [twilioError, setTwilioError] = useState<string | null>(null)
  const [twilioSuccess, setTwilioSuccess] = useState(false)
  const [supportTickets, setSupportTickets] = useState<SupportTicketRow[]>([])
  const [ticketModal, setTicketModal] = useState<SupportTicketRow | null>(null)
  const [ticketReply, setTicketReply] = useState('')
  const [savingTicketReply, setSavingTicketReply] = useState(false)
  const [activityLogs, setActivityLogs] = useState<ActivityLogRow[]>([])
  const [activityLogDetailModal, setActivityLogDetailModal] = useState<ActivityLogRow | null>(null)
  const [activityFilterDays, setActivityFilterDays] = useState<1 | 7 | 30>(7)
  const [activityFilterCategory, setActivityFilterCategory] = useState<string>('all')
  const [activityFilterEmail, setActivityFilterEmail] = useState('')
  const [activityErrorsOnly, setActivityErrorsOnly] = useState(false)
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Nichos
  const [nichos, setNichos] = useState<NichoTemplate[]>([])
  const [nichoModalOpen, setNichoModalOpen] = useState(false)
  const [editingNicho, setEditingNicho] = useState<NichoTemplate | null>(null)
  const [nichoForm, setNichoForm] = useState<Omit<NichoTemplate, 'id'>>(EMPTY_NICHO)
  const [savingNicho, setSavingNicho] = useState(false)
  const [expandedNicho, setExpandedNicho] = useState<string | null>(null)
  const [expandedCategoria, setExpandedCategoria] = useState<string | null>(null)
  const [prefabNichoMessageOpen, setPrefabNichoMessageOpen] = useState(false)

  const [phoneModalOpen, setPhoneModalOpen] = useState(false)
  const [newNumero, setNewNumero] = useState('')
  const [newDescripcion, setNewDescripcion] = useState('')
  const [newRotacion, setNewRotacion] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)

  const [addMinutesUserId, setAddMinutesUserId] = useState<string | null>(null)
  const [addMinutesAmount, setAddMinutesAmount] = useState('')
  const [addMinutesPlan, setAddMinutesPlan] = useState<'BASICO' | 'PRO' | 'PREMIUM'>('PRO')
  const [savingMinutes, setSavingMinutes] = useState(false)

  const [planConfigs, setPlanConfigs] = useState<PlanConfigAdmin[]>([])
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null)
  const [planSaveToast, setPlanSaveToast] = useState<string | null>(null)

  const [crmCatalog, setCrmCatalog] = useState<CrmCatalogRow[]>([])
  const [crmCatalogEdit, setCrmCatalogEdit] = useState<CrmCatalogRow | null>(null)
  const [savingCrmCatalog, setSavingCrmCatalog] = useState(false)

  const [usersCreditsList, setUsersCreditsList] = useState<UserCreditsAdminRow[]>([])
  const [usersCreditsSearch, setUsersCreditsSearch] = useState('')
  const [creditsModalUser, setCreditsModalUser] = useState<UserCreditsAdminRow | null>(null)
  const [creditPlan, setCreditPlan] = useState<PlanVozAdmin>('prospectador')
  const [creditMinutosTotales, setCreditMinutosTotales] = useState(0)
  const [creditSmsTotales, setCreditSmsTotales] = useState(0)
  const [creditSaldoReferidos, setCreditSaldoReferidos] = useState(0)
  const [creditMinutosAgregar, setCreditMinutosAgregar] = useState('')
  const [creditSmsAgregar, setCreditSmsAgregar] = useState('')
  const [creditNota, setCreditNota] = useState('')
  const [creditInitialMinutos, setCreditInitialMinutos] = useState(0)
  const [creditInitialSms, setCreditInitialSms] = useState(0)
  const [savingCreditsAdjust, setSavingCreditsAdjust] = useState(false)
  const [creditsAdjustToast, setCreditsAdjustToast] = useState<string | null>(null)

  const [secMetricasAbierto, setSecMetricasAbierto] = useState(false)
  const [secTicketsAbierto, setSecTicketsAbierto] = useState(true)
  const [secLogsAbierto, setSecLogsAbierto] = useState(false)
  const [secRetellAbierto, setSecRetellAbierto] = useState(false)
  const [secTwilioAbierto, setSecTwilioAbierto] = useState(false)
  const [secPreciosMinAbierto, setSecPreciosMinAbierto] = useState(false)
  const [secRecargaMinAbierto, setSecRecargaMinAbierto] = useState(false)
  const [secPlanesAbierto, setSecPlanesAbierto] = useState(false)
  const [secNichosAbierto, setSecNichosAbierto] = useState(false)
  const [secCrmAbierto, setSecCrmAbierto] = useState(false)
  const [secNumerosA2PAbierto, setSecNumerosA2PAbierto] = useState(false)
  const [secUsuariosCreditosAbierto, setSecUsuariosCreditosAbierto] = useState(true)
  const [secUsuariosListaAbierto, setSecUsuariosListaAbierto] = useState(true)
  const [secComplianceAbierto, setSecComplianceAbierto] = useState(true)
  const [secActividadGlobalAbierto, setSecActividadGlobalAbierto] = useState(false)

  const [complianceAgreementsAll, setComplianceAgreementsAll] = useState<ComplianceAgreementAdminRow[]>([])
  const [complianceUserFilter, setComplianceUserFilter] = useState<'all' | 'signed' | 'pending'>('all')
  const [complianceDetailModal, setComplianceDetailModal] = useState<ComplianceAgreementAdminRow | null>(null)

  const [recargaMinProspectador, setRecargaMinProspectador] = useState(DEFAULT_RECARGA_MIN_PROSPECTADOR)
  const [recargaMinVendedor, setRecargaMinVendedor] = useState(DEFAULT_RECARGA_MIN_VENDEDOR)
  const [recargaMinCazador, setRecargaMinCazador] = useState(DEFAULT_RECARGA_MIN_CAZADOR)
  const [recargaMinSaving, setRecargaMinSaving] = useState(false)
  const [recargaMinError, setRecargaMinError] = useState<string | null>(null)
  const [recargaMinToast, setRecargaMinToast] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user?.id) { setError('No autorizado'); return }
        const { data, error } = await supabase
          .from('users')
          .select('id, es_admin, onboarding_completado, nombre')
          .eq('id', user.id)
          .maybeSingle()
        // eslint-disable-next-line no-console
        console.log('users data:', data)
        // eslint-disable-next-line no-console
        console.log('users error:', error)
        if (!parseEsAdmin(data?.es_admin)) { setError('Acceso denegado'); return }

        const [usersRes, callsRes, callsTodayRes, config, phones, usersData, usersCreditsRes, logs, nichosData, plansData, catalogData, ticketsRes, activityLogsRes, complianceAllRes] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('call_logs').select('*', { count: 'exact', head: true }),
          supabase.from('call_logs').select('duracion_minutos').gte('created_at', new Date().toISOString().slice(0, 10)),
          supabase
            .from('admin_config')
            .select(
              'id, retell_api_key, updated_at, twilio_account_sid, twilio_auth_token, twilio_phone_number, price_per_min_basico, price_per_min_pro, price_per_min_premium, recarga_minima_prospectador, recarga_minima_vendedor, recarga_minima_cazador',
            )
            .limit(1)
            .maybeSingle(),
          supabase.from('phone_numbers').select('id, numero, descripcion, estado, asignado_a, rotacion').order('numero'),
          supabase.from('users').select('id, email, company_name, nicho').order('email'),
          supabase
            .from('users')
            .select(
              `
            id,
            email,
            nombre,
            created_at,
            credits (
              plan_voz,
              minutos_voz,
              sms_disponibles,
              saldo_referidos_usd
            )
          `,
            )
            .order('created_at', { ascending: false }),
          supabase
            .from('call_logs')
            .select('id, user_id, resumen, duracion_minutos, disposition, costo_usd, created_at')
            .order('created_at', { ascending: false })
            .limit(100),
          supabase.from('nicho_templates').select('*').order('nicho'),
          supabase.from('plan_config').select('*').order('precio_por_minuto', { ascending: true }),
          supabase
            .from('crm_integration_catalog')
            .select('id, crm_type, name, description, emoji, logo_url, is_visible, sort_order, badge, badge_color, plan_required')
            .order('sort_order', { ascending: true }),
          supabase
            .from('support_tickets')
            .select('id, user_id, descripcion, pagina, status, respuesta_admin, created_at')
            .order('created_at', { ascending: false })
            .limit(500),
          supabase
            .from('activity_logs')
            .select(
              `
              id,
              user_id,
              accion,
              categoria,
              pagina,
              detalle,
              error_mensaje,
              error_stack,
              user_agent,
              created_at,
              users (email, nombre)
            `,
            )
            .order('created_at', { ascending: false })
            .limit(200),
          supabase
            .from('compliance_agreements')
            .select(
              `
              id,
              user_id,
              created_at,
              company_name,
              business_type,
              country,
              website,
              contact_source,
              contact_source_other,
              consent_description,
              privacy_policy_url,
              opt_in_form_url,
              decl_consent_contacts,
              decl_laws,
              decl_opt_out,
              decl_responsibility,
              ip_address,
              user_agent,
              terms_version
            `,
            )
            .order('created_at', { ascending: false }),
        ])

        if (!mounted) return
        // eslint-disable-next-line no-console
        console.log('users data:', usersData?.data)
        // eslint-disable-next-line no-console
        console.log('users error:', usersData?.error)
        // eslint-disable-next-line no-console
        console.log('users data:', { count: usersRes.count })
        // eslint-disable-next-line no-console
        console.log('users error:', usersRes.error)
        const totalUsers = usersRes.count ?? 0
        const totalCalls = callsRes.count ?? 0
        const callsToday = callsTodayRes.data ?? []
        const minutesToday = callsToday.reduce(
          (s, r: { duracion_minutos?: number | null }) => s + (Number(r.duracion_minutos) || 0),
          0,
        )

        const configRow = config?.data as {
          id?: string
          retell_api_key?: string
          twilio_account_sid?: string
          twilio_auth_token?: string
          twilio_phone_number?: string
          price_per_min_basico?: number | null
          price_per_min_pro?: number | null
          price_per_min_premium?: number | null
          recarga_minima_prospectador?: number | string | null
          recarga_minima_vendedor?: number | string | null
          recarga_minima_cazador?: number | string | null
        } | null

        const cfgBasico = configRow?.price_per_min_basico ?? DEFAULT_COST_PER_MIN_BASICO
        const cfgPro = configRow?.price_per_min_pro ?? DEFAULT_COST_PER_MIN_PRO
        const cfgPremium = configRow?.price_per_min_premium ?? DEFAULT_COST_PER_MIN_PREMIUM

        setPriceBasico(cfgBasico)
        setPricePro(cfgPro)
        setPricePremium(cfgPremium)

        const rp = configRow?.recarga_minima_prospectador
        const rv = configRow?.recarga_minima_vendedor
        const rc = configRow?.recarga_minima_cazador
        if (rp != null && Number.isFinite(Number(rp))) {
          setRecargaMinProspectador(Number(rp))
        }
        if (rv != null && Number.isFinite(Number(rv))) {
          setRecargaMinVendedor(Number(rv))
        }
        if (rc != null && Number.isFinite(Number(rc))) {
          setRecargaMinCazador(Number(rc))
        }

        setMetrics({
          totalUsers,
          totalCalls,
          minutesToday,
          revenueEst: totalCalls * cfgPro,
        })
        if (configRow?.retell_api_key) { setRetellKey(configRow.retell_api_key); setRetellStatus('idle') }
        if (configRow?.twilio_account_sid != null) setTwilioAccountSid(configRow.twilio_account_sid ?? '')
        if (configRow?.twilio_auth_token != null) setTwilioAuthToken(configRow.twilio_auth_token ?? '')
        if (configRow?.twilio_phone_number != null) setTwilioPhoneNumber(configRow.twilio_phone_number ?? '')
        setPhoneNumbers((phones?.data ?? []) as PhoneNumber[])
        setNichos((nichosData?.data ?? []) as NichoTemplate[])

        const creditsRowsRaw = (usersCreditsRes?.data ?? []) as Record<string, unknown>[]
        setUsersCreditsList(
          creditsRowsRaw.map((row) => ({
            id: String(row.id),
            email: row.email != null ? String(row.email) : null,
            nombre: row.nombre != null ? String(row.nombre) : null,
            created_at: String(row.created_at ?? ''),
            credits: normalizeCreditsRelation(row.credits),
          })),
        )

        const usersList = (usersData?.data ?? []) as AdminUser[]
        const userIdsForCredits = usersList.map((u) => u.id)
        let creditsMap = new Map<string, { minutos: number; plan: string | null }>()
        if (userIdsForCredits.length > 0) {
          const { data: creditsData } = await supabase.from('credits').select('user_id, minutos_voz, plan_voz').in('user_id', userIdsForCredits)
          creditsMap = new Map((creditsData ?? []).map((c: { user_id: string; minutos_voz: number | null; plan_voz: string | null }) => [c.user_id, { minutos: c.minutos_voz ?? 0, plan: c.plan_voz }]))
        }
        setUsers(usersList.map((u) => ({ ...u, minutos_disponibles: creditsMap.get(u.id)?.minutos ?? null, plan: creditsMap.get(u.id)?.plan ?? null })))

        const logsList = logs?.data ?? []
        const userIds = [...new Set(logsList.map((l: CallLog) => l.user_id))]
        let emailMap = new Map<string, string | null>()
        if (userIds.length > 0) {
          const { data: emailsData, error: emailsError } = await supabase.from('users').select('id, email').in('id', userIds)
          // eslint-disable-next-line no-console
          console.log('users data:', emailsData)
          // eslint-disable-next-line no-console
          console.log('users error:', emailsError)
          emailMap = new Map((emailsData ?? []).map((r: { id: string; email: string | null }) => [r.id, r.email]))
        }
        setCallLogs(logsList.map((l: CallLog) => ({ ...l, user_email: emailMap.get(l.user_id) ?? l.user_id })))

        const plansList = (plansData?.data ?? []) as Record<string, unknown>[]
        setPlanConfigs(
          plansList.map((p) => ({
            id: String(p.id),
            plan_id: String(p.plan_id),
            nombre: String(p.nombre),
            emoji: p.emoji != null ? String(p.emoji) : null,
            precio_por_minuto: Number(p.precio_por_minuto),
            descripcion: p.descripcion != null ? String(p.descripcion) : null,
            features: Array.isArray(p.features) ? (p.features as string[]) : [],
            activo: Boolean(p.activo),
          }))
        )
        setCrmCatalog(((catalogData?.data ?? []) as CrmCatalogRow[]).map((row) => {
          const defaults = DEFAULT_CRM_CATALOG[row.crm_type] ?? {}
          return {
            ...defaults,
            ...row,
            name: row.name || (defaults.name as string) || row.crm_type,
            description: row.description ?? (defaults.description as string | null) ?? null,
            emoji: row.emoji ?? (defaults.emoji as string | null) ?? '🔌',
            badge: row.badge ?? (defaults.badge as string | null) ?? null,
            badge_color: row.badge_color ?? (defaults.badge_color as string | null) ?? null,
          } as CrmCatalogRow
        }))

        if (ticketsRes.error) {
          if (import.meta.env.DEV) console.warn('[Admin] support_tickets:', ticketsRes.error.message)
          setSupportTickets([])
        } else {
          const ticketsRaw = (ticketsRes.data ?? []) as SupportTicketRow[]
          const ticketUserIds = [...new Set(ticketsRaw.map((t) => t.user_id).filter(Boolean))] as string[]
          let ticketEmailMap = new Map<string, string | null>()
          if (ticketUserIds.length > 0) {
            const { data: ticketUsers } = await supabase.from('users').select('id, email').in('id', ticketUserIds)
            ticketEmailMap = new Map((ticketUsers ?? []).map((r: { id: string; email: string | null }) => [r.id, r.email]))
          }
          setSupportTickets(
            ticketsRaw.map((t) => ({
              ...t,
              user_email: t.user_id ? ticketEmailMap.get(t.user_id) ?? null : null,
            })),
          )
        }

        if (activityLogsRes.error) {
          if (import.meta.env.DEV) console.warn('[Admin] activity_logs:', activityLogsRes.error.message)
          setActivityLogs([])
        } else {
          setActivityLogs((activityLogsRes.data ?? []) as ActivityLogRow[])
        }

        if (complianceAllRes.error) {
          if (import.meta.env.DEV) {
            console.warn('[Admin] compliance_agreements:', complianceAllRes.error.message)
          }
          setComplianceAgreementsAll([])
        } else {
          setComplianceAgreementsAll((complianceAllRes.data ?? []) as ComplianceAgreementAdminRow[])
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar')
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [])

  async function saveAndVerifyRetell() {
    setRetellError(null); setRetellStatus('idle'); setSavingRetell(true)
    try {
      const { data: existing } = await supabase.from('admin_config').select('id').limit(1).maybeSingle()
      if (existing) {
        await supabase.from('admin_config').update({ retell_api_key: retellKey || null, updated_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        await supabase.from('admin_config').insert({ retell_api_key: retellKey || null })
      }
      if (!retellKey.trim()) { setRetellStatus('idle'); setSavingRetell(false); return }
      const res = await fetch('https://api.retellai.com/list-agents', { headers: { Authorization: `Bearer ${retellKey.trim()}` } })
      if (res.ok) setRetellStatus('connected')
      else setRetellStatus('error')
    } catch {
      setRetellStatus('error'); setRetellError('Key inválida o error de red')
    } finally {
      setSavingRetell(false)
    }
  }

  async function saveTwilio() {
    setTwilioError(null)
    setTwilioSuccess(false)
    setSavingTwilio(true)
    try {
      const { data: existing } = await supabase.from('admin_config').select('id').limit(1).maybeSingle()
      if (existing) {
        const { error: updateErr } = await supabase
          .from('admin_config')
          .update({
            twilio_account_sid: twilioAccountSid.trim() || null,
            twilio_auth_token: twilioAuthToken.trim() || null,
            twilio_phone_number: twilioPhoneNumber.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
        if (updateErr) throw updateErr
      } else {
        await supabase.from('admin_config').insert({
          twilio_account_sid: twilioAccountSid.trim() || null,
          twilio_auth_token: twilioAuthToken.trim() || null,
          twilio_phone_number: twilioPhoneNumber.trim() || null,
        })
      }
      setTwilioSuccess(true)
    } catch (e) {
      setTwilioError(e instanceof Error ? e.message : 'Error al guardar Twilio.')
    } finally {
      setSavingTwilio(false)
    }
  }

  async function savePricing() {
    try {
      const { data: existing } = await supabase.from('admin_config').select('id').limit(1).maybeSingle()
      const payload = {
        price_per_min_basico: priceBasico,
        price_per_min_pro: pricePro,
        price_per_min_premium: pricePremium,
        updated_at: new Date().toISOString(),
      }
      if (existing) {
        await supabase.from('admin_config').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('admin_config').insert(payload)
      }
      // actualizar métricas estimadas con el nuevo precio PRO
      setMetrics((prev) => ({
        ...prev,
        revenueEst: prev.totalCalls * pricePro,
      }))
    } catch (e) {
      // por ahora silencioso; se podría mostrar toast
      console.error(e)
    }
  }

  async function saveRecargaMinimas() {
    const p = Number(recargaMinProspectador)
    const v = Number(recargaMinVendedor)
    const c = Number(recargaMinCazador)
    if (![p, v, c].every((n) => Number.isFinite(n) && n >= 5)) {
      setRecargaMinError('Cada monto mínimo debe ser al menos $5.')
      return
    }
    setRecargaMinError(null)
    setRecargaMinToast(null)
    setRecargaMinSaving(true)
    try {
      const { data: existing } = await supabase.from('admin_config').select('id').limit(1).maybeSingle()
      const payload = {
        recarga_minima_prospectador: p,
        recarga_minima_vendedor: v,
        recarga_minima_cazador: c,
        updated_at: new Date().toISOString(),
      }
      if (existing?.id != null) {
        const { error } = await supabase.from('admin_config').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('admin_config').insert(payload)
        if (error) throw error
      }
      setRecargaMinToast('Cambios guardados.')
      window.setTimeout(() => setRecargaMinToast(null), 3500)
    } catch (e) {
      setRecargaMinError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setRecargaMinSaving(false)
    }
  }

  async function saveTicketResponse() {
    if (!ticketModal || !ticketReply.trim()) return
    setSavingTicketReply(true)
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({
          status: 'resuelto',
          respuesta_admin: ticketReply.trim(),
        })
        .eq('id', ticketModal.id)
      if (error) throw error
      setSupportTickets((prev) =>
        prev.map((t) =>
          t.id === ticketModal.id
            ? { ...t, status: 'resuelto', respuesta_admin: ticketReply.trim() }
            : t,
        ),
      )
      setTicketModal(null)
      setTicketReply('')
    } catch (e) {
      console.error(e)
    } finally {
      setSavingTicketReply(false)
    }
  }

  async function toggleCrmCatalogVisible(row: CrmCatalogRow) {
    try {
      const { error } = await supabase
        .from('crm_integration_catalog')
        .update({ is_visible: !row.is_visible })
        .eq('crm_type', row.crm_type)
      if (error) throw error
      setCrmCatalog((prev) =>
        prev.map((r) =>
          r.crm_type === row.crm_type ? { ...r, is_visible: !row.is_visible } : r,
        ),
      )
    } catch (e) {
      console.error(e)
    }
  }

  async function saveCrmCatalogEdit() {
    if (!crmCatalogEdit) return
    setSavingCrmCatalog(true)
    try {
      const { error } = await supabase
        .from('crm_integration_catalog')
        .update({
          name: crmCatalogEdit.name,
          description: crmCatalogEdit.description || null,
          emoji: crmCatalogEdit.emoji || null,
          logo_url: crmCatalogEdit.logo_url || null,
          badge: crmCatalogEdit.badge || null,
          badge_color: crmCatalogEdit.badge_color || null,
          sort_order: crmCatalogEdit.sort_order ?? 0,
          is_visible: crmCatalogEdit.is_visible ?? true,
          plan_required: crmCatalogEdit.plan_required ?? null,
        })
        .eq('crm_type', crmCatalogEdit.crm_type)
      if (error) throw error
      setCrmCatalog((prev) => prev.map((r) => (r.crm_type === crmCatalogEdit.crm_type ? crmCatalogEdit : r)))
      setCrmCatalogEdit(null)
    } catch (e) {
      console.error(e)
    } finally {
      setSavingCrmCatalog(false)
    }
  }

  async function addPhoneNumber() {
    if (!newNumero.trim()) return
    setSavingPhone(true)
    try {
      await supabase.from('phone_numbers').insert({ numero: newNumero.trim(), descripcion: newDescripcion.trim() || null, estado: 'activo', rotacion: newRotacion.trim() || null })
      const { data } = await supabase.from('phone_numbers').select('id, numero, descripcion, estado, asignado_a, rotacion').order('numero')
      setPhoneNumbers((data ?? []) as PhoneNumber[])
      setPhoneModalOpen(false); setNewNumero(''); setNewDescripcion(''); setNewRotacion('')
    } finally { setSavingPhone(false) }
  }

  async function addMinutesForUser() {
    if (!addMinutesUserId || !addMinutesAmount) return
    const mins = parseInt(addMinutesAmount, 10)
    if (isNaN(mins) || mins <= 0) return
    setSavingMinutes(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const adminId = session?.user?.id
      if (!adminId) return
      const planVoz = addMinutesPlan === 'BASICO' ? 'prospectador' : addMinutesPlan === 'PRO' ? 'vendedor' : 'cazador'
      const { data: cred } = await supabase.from('credits').select('minutos_voz').eq('user_id', addMinutesUserId).maybeSingle()
      const current = (cred?.minutos_voz ?? 0) + mins
      await supabase.from('credits').upsert({ user_id: addMinutesUserId, minutos_voz: current, plan_voz: planVoz }, { onConflict: 'user_id' })
      const pricePerMin =
        addMinutesPlan === 'BASICO'
          ? priceBasico
          : addMinutesPlan === 'PRO'
          ? pricePro
          : pricePremium
      await supabase
        .from('credit_transactions')
        .insert({
          user_id: addMinutesUserId,
          tipo: 'recarga_admin',
          minutos: mins,
          monto_usd: mins * pricePerMin,
          descripcion: `+${mins} min (${addMinutesPlan})`,
        })
      setUsers((prev) => prev.map((u) => u.id === addMinutesUserId ? { ...u, minutos_disponibles: (u.minutos_disponibles ?? 0) + mins, plan: addMinutesPlan } : u))
      setAddMinutesUserId(null); setAddMinutesAmount('')
    } finally { setSavingMinutes(false) }
  }

  function planVozFromDb(p: string | null | undefined): PlanVozAdmin {
    const x = (p ?? '').toLowerCase()
    return (PLAN_VOZ_OPTIONS as readonly string[]).includes(x) ? (x as PlanVozAdmin) : 'prospectador'
  }

  function openCreditsAdjustModal(u: UserCreditsAdminRow) {
    const c = u.credits
    const min = Math.max(0, Math.floor(Number(c?.minutos_voz ?? 0)))
    const sms = Math.max(0, Math.floor(Number(c?.sms_disponibles ?? 0)))
    const saldo = Number(c?.saldo_referidos_usd ?? 0)
    setCreditsModalUser(u)
    setCreditPlan(planVozFromDb(c?.plan_voz))
    setCreditMinutosTotales(min)
    setCreditSmsTotales(sms)
    setCreditSaldoReferidos(saldo)
    setCreditMinutosAgregar('')
    setCreditSmsAgregar('')
    setCreditNota('')
    setCreditInitialMinutos(min)
    setCreditInitialSms(sms)
  }

  function applyCreditMinutosAgregar() {
    const n = parseInt(creditMinutosAgregar, 10)
    if (isNaN(n)) return
    setCreditMinutosTotales((v) => Math.max(0, v + n))
    setCreditMinutosAgregar('')
  }

  function applyCreditSmsAgregar() {
    const n = parseInt(creditSmsAgregar, 10)
    if (isNaN(n)) return
    setCreditSmsTotales((v) => Math.max(0, v + n))
    setCreditSmsAgregar('')
  }

  async function saveCreditsAdjust() {
    if (!creditsModalUser) return
    setSavingCreditsAdjust(true)
    try {
      const plan = creditPlan
      const minutosNuevo = Math.max(0, Math.floor(Number(creditMinutosTotales) || 0))
      const smsNuevo = Math.max(0, Math.floor(Number(creditSmsTotales) || 0))
      const saldoReferidos = Number(creditSaldoReferidos) || 0
      const minutosIniciales = creditInitialMinutos
      const notaTrim = creditNota.trim()

      const { error } = await supabase.from('credits').upsert(
        {
          user_id: creditsModalUser.id,
          plan_voz: plan,
          minutos_voz: minutosNuevo,
          sms_disponibles: smsNuevo,
          saldo_referidos_usd: saldoReferidos,
        },
        { onConflict: 'user_id' },
      )
      if (error) throw error

      await supabase.from('credit_transactions').insert({
        user_id: creditsModalUser.id,
        tipo: 'ajuste_admin',
        monto_usd: 0,
        minutos: minutosNuevo - minutosIniciales,
        descripcion: `Ajuste manual admin: ${notaTrim || 'sin nota'}`,
      })

      setCreditsAdjustToast('Créditos actualizados correctamente')
      setTimeout(() => setCreditsAdjustToast(null), 3500)
      const uid = creditsModalUser.id
      setCreditsModalUser(null)
      setUsersCreditsList((prev) =>
        prev.map((row) =>
          row.id === uid
            ? {
                ...row,
                credits: {
                  plan_voz: plan,
                  minutos_voz: minutosNuevo,
                  sms_disponibles: smsNuevo,
                  saldo_referidos_usd: saldoReferidos,
                },
              }
            : row,
        ),
      )
      setUsers((prev) =>
        prev.map((row) =>
          row.id === uid
            ? {
                ...row,
                minutos_disponibles: minutosNuevo,
                plan,
              }
            : row,
        ),
      )
    } catch (e) {
      console.error(e)
      setCreditsAdjustToast(e instanceof Error ? e.message : 'Error al guardar créditos')
      setTimeout(() => setCreditsAdjustToast(null), 4000)
    } finally {
      setSavingCreditsAdjust(false)
    }
  }

  function openNichoModal(nicho?: NichoTemplate) {
    if (nicho) {
      setEditingNicho(nicho)
      setNichoForm({
        ...nicho,
        categoria: nicho.categoria ?? getCategoriaFromNicho(nicho.nicho),
      })
    } else {
      setEditingNicho(null)
      setNichoForm(EMPTY_NICHO)
    }
    setNichoModalOpen(true)
  }

  async function saveNicho() {
    if (!nichoForm.nicho.trim()) return
    setSavingNicho(true)
    try {
      const payload = { ...nichoForm, categoria: nichoForm.categoria || null }
      if (editingNicho) {
        await supabase.from('nicho_templates').update(payload).eq('id', editingNicho.id)
      } else {
        await supabase.from('nicho_templates').insert(payload)
      }
      const { data } = await supabase.from('nicho_templates').select('*').order('nicho')
      setNichos((data ?? []) as NichoTemplate[])
      setNichoModalOpen(false)
    } finally {
      setSavingNicho(false)
    }
  }

  async function deleteNicho(id: string) {
    if (!confirm('¿Eliminar este nicho?')) return
    await supabase.from('nicho_templates').delete().eq('id', id)
    setNichos((prev) => prev.filter((n) => n.id !== id))
  }

  function updatePlanConfig(planId: string, patch: Partial<PlanConfigAdmin>) {
    setPlanConfigs((prev) =>
      prev.map((p) => (p.plan_id === planId ? { ...p, ...patch } : p))
    )
  }

  async function savePlan(plan: PlanConfigAdmin) {
    setSavingPlanId(plan.plan_id)
    setPlanSaveToast(null)
    try {
      const { error } = await supabase
        .from('plan_config')
        .update({
          nombre: plan.nombre,
          emoji: plan.emoji || null,
          precio_por_minuto: plan.precio_por_minuto,
          descripcion: plan.descripcion || null,
          features: plan.features,
          activo: plan.activo,
          updated_at: new Date().toISOString(),
        })
        .eq('plan_id', plan.plan_id)

      if (error) throw error
      setPlanSaveToast('Plan actualizado correctamente')
      setTimeout(() => setPlanSaveToast(null), 3000)
    } catch (e) {
      console.error(e)
      setPlanSaveToast('Error al guardar')
    } finally {
      setSavingPlanId(null)
    }
  }

  const activityFilteredLogs = useMemo(() => {
    const now = Date.now()
    let cutoff: number
    if (activityFilterDays === 1) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      cutoff = d.getTime()
    } else {
      cutoff = now - activityFilterDays * 24 * 60 * 60 * 1000
    }
    const emailQ = activityFilterEmail.trim().toLowerCase()
    return activityLogs.filter((row) => {
      const t = new Date(row.created_at).getTime()
      if (t < cutoff) return false
      if (activityFilterCategory !== 'all' && row.categoria !== activityFilterCategory) return false
      if (activityErrorsOnly && row.categoria !== 'error' && !row.error_mensaje) return false
      if (emailQ) {
        const em = (row.users?.email ?? '').toLowerCase()
        if (!em.includes(emailQ)) return false
      }
      return true
    })
  }, [
    activityLogs,
    activityFilterDays,
    activityFilterCategory,
    activityFilterEmail,
    activityErrorsOnly,
  ])

  const activityStats = useMemo(() => {
    const startDay = new Date()
    startDay.setHours(0, 0, 0, 0)
    const dayMs = startDay.getTime()
    const today = activityLogs.filter((r) => new Date(r.created_at).getTime() >= dayMs)
    const err = today.filter((r) => r.categoria === 'error' || Boolean(r.error_mensaje)).length
    const logins = today.filter((r) => r.accion === 'login_exitoso').length
    const recargas = today.filter(
      (r) => r.accion === 'recarga_exitosa' || r.accion === 'recarga_iniciada',
    ).length
    const activeUsers = new Set(today.map((r) => r.user_id).filter(Boolean)).size
    return { err, logins, recargas, activeUsers }
  }, [activityLogs])

  const latestComplianceByUser = useMemo(() => {
    const m = new Map<string, ComplianceAgreementAdminRow>()
    for (const row of complianceAgreementsAll) {
      if (!m.has(row.user_id)) m.set(row.user_id, row)
    }
    return m
  }, [complianceAgreementsAll])

  const complianceUserRowsFiltered = useMemo(() => {
    const rows = users.map((u) => ({
      user: u,
      agreement: latestComplianceByUser.get(u.id) ?? null,
    }))
    if (complianceUserFilter === 'signed') return rows.filter((r) => r.agreement != null)
    if (complianceUserFilter === 'pending') return rows.filter((r) => r.agreement == null)
    return rows
  }, [users, latestComplianceByUser, complianceUserFilter])

  if (loading) return <div className="flex items-center justify-center py-12"><span className="text-sm theme-text-muted">Cargando panel admin...</span></div>
  if (error) return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">{error}. Solo usuarios administradores pueden acceder.</div>

  const creditsSearchQ = usersCreditsSearch.trim().toLowerCase()
  const usersCreditsFiltered = creditsSearchQ
    ? usersCreditsList.filter((u) => {
        const em = (u.email ?? '').toLowerCase()
        const nom = (u.nombre ?? '').toLowerCase()
        return em.includes(creditsSearchQ) || nom.includes(creditsSearchQ)
      })
    : usersCreditsList

  const nichoFields: { key: keyof Omit<NichoTemplate, 'id'>; label: string }[] = [
    { key: 'nicho', label: 'ID del Nicho (ej: agua, dental)' },
    { key: 'nicho_problema', label: 'Problema' },
    { key: 'nicho_contexto', label: 'Contexto' },
    { key: 'nicho_objetivo', label: 'Objetivo' },
    { key: 'nicho_apertura', label: 'Apertura' },
    { key: 'nicho_pregunta_gancho', label: 'Pregunta gancho' },
    { key: 'nicho_oferta', label: 'Oferta' },
    { key: 'nicho_objecion_1', label: 'Objeción principal' },
    { key: 'nicho_objecion_ya_tiene', label: 'Objeción "ya tengo"' },
    { key: 'nicho_urgencia', label: 'Urgencia' },
    { key: 'nicho_urgencia_alta', label: 'Urgencia alta' },
    { key: 'nicho_ultimo_intento', label: 'Último intento' },
    { key: 'nicho_descripcion_empresa', label: 'Descripción empresa' },
    { key: 'nicho_contexto_corto', label: 'Contexto corto' },
    { key: 'objeciones_nicho_extra', label: 'Objeciones extra' },
  ]

  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">Panel Admin — Krone Agent AI</h1>
        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold uppercase theme-text-primary">Admin</span>
      </div>

      {/* Métricas */}
      <AdminCollapsibleSection
        title="Resumen / métricas"
        emoji="📊"
        open={secMetricasAbierto}
        onToggle={() => setSecMetricasAbierto((x) => !x)}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Usuarios registrados', value: metrics.totalUsers },
            { label: 'Total llamadas', value: metrics.totalCalls },
            { label: 'Minutos consumidos hoy', value: metrics.minutesToday },
            { label: 'Ingresos estimados', value: `$${metrics.revenueEst.toFixed(2)}` },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border theme-border/80 theme-bg-card p-4">
              <div className="text-xs theme-text-muted">{m.label}</div>
              <div className="text-2xl font-semibold theme-text-primary">{m.value}</div>
            </div>
          ))}
        </div>
      </AdminCollapsibleSection>

      {/* Tickets de soporte */}
      <AdminCollapsibleSection
        title="Tickets de soporte"
        emoji="🎫"
        open={secTicketsAbierto}
        onToggle={() => setSecTicketsAbierto((x) => !x)}
      >
        <p className="mb-4 text-sm theme-text-muted">
          Enviados desde el asistente Krone AI (HelpChat). Ejecuta{' '}
          <code className="rounded bg-zinc-900 px-1 text-xs">supabase-migrations-support-tickets.sql</code> si la tabla no existe.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs theme-text-dim">
                <th className="pb-2 pr-2 font-medium">#</th>
                <th className="pb-2 pr-2 font-medium">Usuario</th>
                <th className="pb-2 pr-2 font-medium">Descripción</th>
                <th className="pb-2 pr-2 font-medium">Página</th>
                <th className="pb-2 pr-2 font-medium">Estado</th>
                <th className="pb-2 pr-2 font-medium">Fecha</th>
                <th className="pb-2 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {supportTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500">
                    No hay tickets todavía.
                  </td>
                </tr>
              ) : (
                supportTickets.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-800/60 theme-text-muted">
                    <td className="py-2 pr-2 align-top font-mono text-xs text-zinc-400" title={t.id}>
                      {t.id.slice(0, 8)}…
                    </td>
                    <td className="py-2 pr-2 align-top text-xs">
                      {t.user_email ?? (t.user_id ? `${t.user_id.slice(0, 8)}…` : 'Invitado')}
                    </td>
                    <td className="py-2 pr-2 align-top text-xs max-w-[200px] truncate" title={t.descripcion}>
                      {t.descripcion}
                    </td>
                    <td className="py-2 pr-2 align-top text-xs font-mono">{t.pagina ?? '—'}</td>
                    <td className="py-2 pr-2 align-top">
                      <span
                        className={
                          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ' +
                          supportTicketStatusClass(t.status)
                        }
                      >
                        {t.status ?? 'pendiente'}
                      </span>
                    </td>
                    <td className="py-2 pr-2 align-top text-xs whitespace-nowrap">
                      {new Date(t.created_at).toLocaleString('es')}
                    </td>
                    <td className="py-2 align-top">
                      <button
                        type="button"
                        onClick={() => {
                          setTicketModal(t)
                          setTicketReply(t.respuesta_admin ?? '')
                        }}
                        className="rounded-lg bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                      >
                        Responder
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCollapsibleSection>

      {/* Logs de actividad */}
      <AdminCollapsibleSection
        title="Logs de actividad"
        emoji="📋"
        open={secLogsAbierto}
        onToggle={() => setSecLogsAbierto((x) => !x)}
      >
        <p className="mb-3 text-sm theme-text-muted">
          Eventos registrados desde la app (auth, campañas, contactos, pagos, chatbot, errores). En producción conviene
          retener como máximo ~90 días (limpieza periódica en base de datos).
        </p>
        <p className="mb-4 text-xs text-zinc-600">
          Ejecuta <code className="rounded bg-zinc-900 px-1">supabase-migrations-activity-logs.sql</code> si la tabla no existe.
        </p>

        <div className="mb-4 flex flex-wrap gap-3">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
            <span className="text-zinc-500">Errores hoy:</span>{' '}
            <span className="font-semibold text-red-300">{activityStats.err}</span>
          </div>
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs">
            <span className="text-zinc-500">Logins hoy:</span>{' '}
            <span className="font-semibold text-sky-300">{activityStats.logins}</span>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
            <span className="text-zinc-500">Recargas hoy:</span>{' '}
            <span className="font-semibold text-amber-200">{activityStats.recargas}</span>
          </div>
          <div className="rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-2 text-xs">
            <span className="text-zinc-500">Usuarios activos (hoy):</span>{' '}
            <span className="font-semibold text-[#86efac]">{activityStats.activeUsers}</span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs theme-text-dim">Rango</label>
            <select
              value={activityFilterDays}
              onChange={(e) => setActivityFilterDays(Number(e.target.value) as 1 | 7 | 30)}
              className="mt-1 block rounded-lg theme-bg-base px-2 py-1.5 text-sm text-zinc-100 ring-1 ring-zinc-800"
            >
              <option value={1}>Hoy</option>
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
            </select>
          </div>
          <div>
            <label className="text-xs theme-text-dim">Categoría</label>
            <select
              value={activityFilterCategory}
              onChange={(e) => setActivityFilterCategory(e.target.value)}
              className="mt-1 block rounded-lg theme-bg-base px-2 py-1.5 text-sm text-zinc-100 ring-1 ring-zinc-800"
            >
              <option value="all">Todas</option>
              <option value="auth">auth</option>
              <option value="navegacion">navegacion</option>
              <option value="campana">campana</option>
              <option value="contacto">contacto</option>
              <option value="pago">pago</option>
              <option value="llamada">llamada</option>
              <option value="error">error</option>
              <option value="chatbot">chatbot</option>
              <option value="creditos">creditos</option>
              <option value="secuencia">secuencia</option>
              <option value="integracion">integracion</option>
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="text-xs theme-text-dim">Usuario (email contiene)</label>
            <input
              type="text"
              value={activityFilterEmail}
              onChange={(e) => setActivityFilterEmail(e.target.value)}
              placeholder="correo…"
              className="mt-1 w-full rounded-lg theme-bg-base px-2 py-1.5 text-sm text-zinc-100 ring-1 ring-zinc-800"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm theme-text-muted">
            <input
              type="checkbox"
              checked={activityErrorsOnly}
              onChange={(e) => setActivityErrorsOnly(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Solo errores
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs theme-text-dim">
                <th className="pb-2 pr-2 font-medium">Fecha</th>
                <th className="pb-2 pr-2 font-medium">Usuario</th>
                <th className="pb-2 pr-2 font-medium">Acción</th>
                <th className="pb-2 pr-2 font-medium">Categoría</th>
                <th className="pb-2 pr-2 font-medium">Página</th>
                <th className="pb-2 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {activityFilteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500">
                    No hay logs con los filtros actuales.
                  </td>
                </tr>
              ) : (
                activityFilteredLogs.map((row) => {
                  const isErr = row.categoria === 'error' || Boolean(row.error_mensaje)
                  return (
                    <tr
                      key={row.id}
                      className={
                        'border-b border-zinc-800/60 ' +
                        (isErr ? 'bg-red-500/5' : '')
                      }
                    >
                      <td className="py-2 pr-2 align-top text-xs text-zinc-400 whitespace-nowrap">
                        {formatActivityRelativeTime(row.created_at)}
                      </td>
                      <td className="py-2 pr-2 align-top text-xs">
                        {row.users?.email ?? (row.user_id ? `${row.user_id.slice(0, 8)}…` : '—')}
                      </td>
                      <td className="py-2 pr-2 align-top">
                        <span
                          className={
                            'inline-flex max-w-[200px] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ' +
                            activityCategoriaBadgeClass(row.categoria)
                          }
                          title={row.accion}
                        >
                          {row.accion}
                        </span>
                      </td>
                      <td className="py-2 pr-2 align-top text-xs text-zinc-400">{row.categoria}</td>
                      <td className="py-2 pr-2 align-top font-mono text-xs text-zinc-500">{row.pagina ?? '—'}</td>
                      <td className="py-2 align-top">
                        <button
                          type="button"
                          onClick={() => setActivityLogDetailModal(row)}
                          className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
                        >
                          Ver
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminCollapsibleSection>

      {/* Retell API */}
      <AdminCollapsibleSection
        title="Configuración de Retell API"
        emoji="🔑"
        open={secRetellAbierto}
        onToggle={() => setSecRetellAbierto((x) => !x)}
      >
        <div className="flex flex-wrap items-center gap-3">
          <input type="password" value={retellKey} onChange={(e) => setRetellKey(e.target.value)} placeholder="API Key de Retell" className="rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] w-64" />
          <button type="button" onClick={saveAndVerifyRetell} disabled={savingRetell} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60">Guardar y verificar</button>
          {retellStatus === 'connected' && <span className="rounded-full bg-[#22c55e]/20 px-2 py-1 text-xs font-semibold text-[#22c55e]">Conectado ✓</span>}
          {retellStatus === 'error' && <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-300">Key inválida</span>}
        </div>
        {retellError && <p className="mt-2 text-sm text-red-300">{retellError}</p>}
      </AdminCollapsibleSection>

      {/* Configuración de Twilio */}
      <AdminCollapsibleSection
        title="Configuración de Twilio"
        emoji="📱"
        open={secTwilioAbierto}
        onToggle={() => setSecTwilioAbierto((x) => !x)}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm theme-text-muted">Twilio Account SID</label>
            <input
              type="text"
              value={twilioAccountSid}
              onChange={(e) => setTwilioAccountSid(e.target.value)}
              className="mt-1 w-full max-w-md rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
          <div>
            <label className="text-sm theme-text-muted">Twilio Auth Token</label>
            <input
              type="password"
              value={twilioAuthToken}
              onChange={(e) => setTwilioAuthToken(e.target.value)}
              className="mt-1 w-full max-w-md rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
          <div>
            <label className="text-sm theme-text-muted">Número de teléfono Twilio</label>
            <input
              type="text"
              value={twilioPhoneNumber}
              onChange={(e) => setTwilioPhoneNumber(e.target.value)}
              placeholder="+12036809767"
              className="mt-1 w-full max-w-md rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveTwilio}
              disabled={savingTwilio}
              className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60"
            >
              {savingTwilio ? 'Guardando...' : 'Guardar Twilio'}
            </button>
            {twilioSuccess && <span className="rounded-full bg-[#22c55e]/20 px-2 py-1 text-xs font-semibold text-[#22c55e]">Guardado correctamente</span>}
          </div>
          {twilioError && <p className="text-sm text-red-300">{twilioError}</p>}
        </div>
      </AdminCollapsibleSection>

      {/* Configuración de precios */}
      <AdminCollapsibleSection
        title="Configuración de precios por minuto"
        emoji="💵"
        open={secPreciosMinAbierto}
        onToggle={() => setSecPreciosMinAbierto((x) => !x)}
      >
        <p className="mb-4 text-sm theme-text-muted">
          Estos valores se usan para calcular los cargos de recarga y las métricas de ingresos estimados.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs theme-text-muted">Básico ($/min)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={priceBasico.toString()}
              onChange={(e) => setPriceBasico(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
          <div>
            <label className="text-xs theme-text-muted">Pro ($/min)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pricePro.toString()}
              onChange={(e) => setPricePro(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
          <div>
            <label className="text-xs theme-text-muted">Premium ($/min)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={pricePremium.toString()}
              onChange={(e) => setPricePremium(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={savePricing}
            className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455]"
          >
            Guardar precios
          </button>
        </div>
      </AdminCollapsibleSection>

      {/* Configuración de recargas mínimas (Credits) */}
      <AdminCollapsibleSection
        title="Configuración de Recargas"
        emoji="⚙️"
        open={secRecargaMinAbierto}
        onToggle={() => setSecRecargaMinAbierto((x) => !x)}
      >
        <p className="mb-4 text-sm theme-text-muted">
          Créditos universales: la recarga mínima recomendada es <strong className="text-zinc-200">$5 USD</strong> para
          todos los planes. Estos campos siguen el esquema por plan en base de datos (validación y UI en Créditos); en
          la práctica conviene dejar <strong className="text-zinc-200">$5</strong> en los tres.
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <div className="text-sm font-medium theme-text-primary">Plan Prospectador</div>
            <label className="mt-2 block text-xs theme-text-dim">Recarga mínima (USD) — universal $5</label>
            <input
              type="number"
              min={5}
              step="0.01"
              value={recargaMinProspectador}
              onChange={(e) => setRecargaMinProspectador(Number(e.target.value))}
              className="mt-1 w-full max-w-[140px] rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
          <div>
            <div className="text-sm font-medium theme-text-primary">Plan Vendedor</div>
            <label className="mt-2 block text-xs theme-text-dim">Recarga mínima (USD) — universal $5</label>
            <input
              type="number"
              min={5}
              step="0.01"
              value={recargaMinVendedor}
              onChange={(e) => setRecargaMinVendedor(Number(e.target.value))}
              className="mt-1 w-full max-w-[140px] rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
          <div>
            <div className="text-sm font-medium theme-text-primary">Plan Cazador</div>
            <label className="mt-2 block text-xs theme-text-dim">Recarga mínima (USD) — universal $5</label>
            <input
              type="number"
              min={5}
              step="0.01"
              value={recargaMinCazador}
              onChange={(e) => setRecargaMinCazador(Number(e.target.value))}
              className="mt-1 w-full max-w-[140px] rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
        </div>
        {recargaMinError && (
          <p className="mt-3 text-sm text-red-300">{recargaMinError}</p>
        )}
        {recargaMinToast && (
          <p className="mt-3 text-sm font-medium text-[#22c55e]">{recargaMinToast}</p>
        )}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => void saveRecargaMinimas()}
            disabled={recargaMinSaving}
            className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60"
          >
            {recargaMinSaving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </AdminCollapsibleSection>

      {/* Planes y Precios */}
      <AdminCollapsibleSection
        title="Planes y Precios"
        emoji="💼"
        open={secPlanesAbierto}
        onToggle={() => setSecPlanesAbierto((x) => !x)}
      >
        <p className="mb-4 text-sm theme-text-muted">
          Edita nombre, emoji, precio por minuto, descripción y features de cada plan. Los cambios se reflejan en Credits y Landing.
        </p>
        {planSaveToast && (
          <div className="mb-3 rounded-lg bg-[#22c55e]/20 px-3 py-2 text-sm font-medium text-[#22c55e]">
            {planSaveToast}
          </div>
        )}
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {planConfigs.map((plan) => (
            <div
              key={plan.plan_id}
              className="rounded-xl border theme-border/80 theme-bg-base p-4"
            >
              <div className="space-y-3">
                <div>
                  <label className="text-xs theme-text-dim">Nombre</label>
                  <input
                    type="text"
                    value={plan.nombre}
                    onChange={(e) => updatePlanConfig(plan.plan_id, { nombre: e.target.value })}
                    className="mt-1 w-full rounded-lg theme-bg-page px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="w-20">
                    <label className="text-xs theme-text-dim">Emoji</label>
                    <input
                      type="text"
                      value={plan.emoji ?? ''}
                      onChange={(e) => updatePlanConfig(plan.plan_id, { emoji: e.target.value || null })}
                      className="mt-1 w-full rounded-lg theme-bg-page px-2 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs theme-text-dim">
                      {plan.plan_id === 'sms' ? 'Precio por mensaje (USD)' : 'Precio/min'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step={plan.plan_id === 'sms' ? '0.001' : '0.01'}
                      value={plan.precio_por_minuto}
                      onChange={(e) => updatePlanConfig(plan.plan_id, { precio_por_minuto: Number(e.target.value) || 0 })}
                      className="mt-1 w-full rounded-lg theme-bg-page px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs theme-text-dim">Descripción</label>
                  <textarea
                    value={plan.descripcion ?? ''}
                    onChange={(e) => updatePlanConfig(plan.plan_id, { descripcion: e.target.value || null })}
                    rows={2}
                    className="mt-1 w-full rounded-lg theme-bg-page px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs theme-text-dim">Features (uno por línea)</label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {plan.features.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-zinc-800/80 px-2 py-0.5 text-xs theme-text-muted"
                      >
                        {f}
                        <button
                          type="button"
                          onClick={() =>
                            updatePlanConfig(plan.plan_id, {
                              features: plan.features.filter((_, j) => j !== i),
                            })
                          }
                          className="theme-text-dim hover:text-red-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      placeholder="Nuevo feature"
                      className="flex-1 rounded-lg theme-bg-page px-3 py-1.5 text-xs text-zinc-100 ring-1 ring-zinc-700/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter') return
                        const v = (e.target as HTMLInputElement).value.trim()
                        if (v) {
                          updatePlanConfig(plan.plan_id, { features: [...plan.features, v] })
                          ;(e.target as HTMLInputElement).value = ''
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = (e.currentTarget.previousElementSibling as HTMLInputElement)
                        const v = input?.value?.trim()
                        if (v) {
                          updatePlanConfig(plan.plan_id, { features: [...plan.features, v] })
                          if (input) input.value = ''
                        }
                      }}
                      className="rounded-lg bg-zinc-800/80 px-2 py-1.5 text-xs font-medium theme-text-muted hover:bg-zinc-700/80"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`activo-${plan.plan_id}`}
                    checked={plan.activo}
                    onChange={(e) => updatePlanConfig(plan.plan_id, { activo: e.target.checked })}
                    className="rounded border-zinc-600 theme-bg-page text-[#22c55e] focus:ring-[#22c55e]"
                  />
                  <label htmlFor={`activo-${plan.plan_id}`} className="text-xs theme-text-muted">
                    Plan activo (visible en web)
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => savePlan(plan)}
                  disabled={savingPlanId === plan.plan_id}
                  className="w-full rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60"
                >
                  {savingPlanId === plan.plan_id ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </AdminCollapsibleSection>

      {/* Nichos */}
      <AdminCollapsibleSection
        title="Templates de Nicho"
        emoji="📁"
        open={secNichosAbierto}
        onToggle={() => setSecNichosAbierto((x) => !x)}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm theme-text-muted">Variables dinámicas que el agente usa según el nicho del cliente.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPrefabNichoMessageOpen(true)} className="rounded-lg px-3 py-2 text-sm font-medium theme-text-muted ring-1 ring-zinc-700/80 hover:bg-zinc-800/60">
              Cargar nichos prefabricados
            </button>
            <button type="button" onClick={() => openNichoModal()} className="rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455]">
              + Nuevo nicho
            </button>
          </div>
        </div>

        {prefabNichoMessageOpen && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Ejecuta el SQL de nichos en Supabase para cargar los templates prefabricados.
            <button type="button" onClick={() => setPrefabNichoMessageOpen(false)} className="ml-2 text-amber-300 underline hover:no-underline">Cerrar</button>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {nichos.length === 0 ? (
            <div className="rounded-xl border theme-border/80 theme-bg-base px-4 py-4 text-sm theme-text-dim text-center">
              No hay nichos configurados.
            </div>
          ) : (
            groupNichosByCategoria(nichos).map(({ categoria, items }) => {
              const isOpen = expandedCategoria === categoria
              return (
                <div
                  key={categoria}
                  className="rounded-xl border theme-border/80 theme-bg-base/80 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedCategoria(isOpen ? null : categoria)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/40 transition"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800/80 theme-text-muted">
                      {isOpen ? (
                        <FolderOpen className="h-4 w-4" />
                      ) : (
                        <Folder className="h-4 w-4" />
                      )}
                    </span>
                    <span className="text-sm font-semibold theme-text-primary">{categoria}</span>
                    <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[11px] theme-text-muted">
                      {items.length} {items.length === 1 ? 'nicho' : 'nichos'}
                    </span>
                    <span className="ml-auto theme-text-dim">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t theme-border/80 divide-y divide-zinc-800/60">
                      {items.map((n) => (
                        <div key={n.id} className="theme-bg-base/40">
                          <div className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-xs font-semibold text-[#22c55e]">
                                {n.nicho}
                              </span>
                              <span className="text-sm theme-text-muted truncate max-w-xs">
                                {n.nicho_problema ?? '—'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openNichoModal(n)}
                                className="rounded px-2 py-1 text-xs theme-text-muted hover:theme-text-primary hover:bg-zinc-800/60"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteNicho(n.id)}
                                className="rounded px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                Eliminar
                              </button>
                              <button
                                type="button"
                                onClick={() => setExpandedNicho(expandedNicho === n.id ? null : n.id)}
                                className="rounded p-1 theme-text-muted hover:theme-text-primary"
                              >
                                {expandedNicho === n.id ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                          </div>
                          {expandedNicho === n.id && (
                            <div className="border-t theme-border/80 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-2 theme-bg-page/60">
                              {nichoFields
                                .filter((f) => f.key !== 'categoria')
                                .slice(1)
                                .map((f) => (
                                  <div key={f.key}>
                                    <div className="text-xs theme-text-dim">{f.label}</div>
                                    <div className="text-xs theme-text-muted mt-0.5">
                                      {n[f.key] || '—'}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </AdminCollapsibleSection>

      {/* Integraciones CRM (catálogo) */}
      <AdminCollapsibleSection
        title="Integraciones CRM"
        emoji="🔌"
        open={secCrmAbierto}
        onToggle={() => setSecCrmAbierto((x) => !x)}
      >
        <p className="mb-4 text-sm theme-text-muted">Decide qué integraciones mostrar en la página /integrations. Edita nombre, logo y badge.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs theme-text-muted border-b theme-border/80">
              <tr>
                <th className="px-3 py-2">Logo</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Visible</th>
                <th className="px-3 py-2">Orden</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {crmCatalog.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-4 text-center theme-text-dim">Sin integraciones. Ejecuta la migración crm_integration_catalog.</td></tr>
              ) : (
                crmCatalog.map((row) => (
                  <tr key={row.id} className="border-b theme-border/80">
                    <td className="px-3 py-2">
                      <div className="relative inline-flex h-8 w-8 items-center justify-center rounded bg-white/10">
                        <span className="text-lg">{row.emoji ?? '🔌'}</span>
                        {row.logo_url && (
                          <img
                            src={row.logo_url}
                            alt=""
                            className="absolute inset-0 h-8 w-8 rounded object-contain"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 theme-text-secondary">{row.name}</td>
                    <td className="px-3 py-2 theme-text-muted">{row.crm_type}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleCrmCatalogVisible(row)}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${row.visible ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-700/40 theme-text-muted'}`}
                      >
                        {row.visible ? 'Sí' : 'No'}
                      </button>
                    </td>
                    <td className="px-3 py-2 theme-text-muted">{row.sort_order ?? 0}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCrmCatalogEdit({
                            ...(DEFAULT_CRM_CATALOG[row.crm_type] as CrmCatalogRow),
                            ...row,
                          })
                        }
                        className="rounded bg-[#22c55e]/20 px-2 py-1 text-xs font-semibold text-[#22c55e] hover:bg-[#22c55e]/30"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCollapsibleSection>

      {/* Números A2P */}
      <AdminCollapsibleSection
        title="Números de Teléfono A2P"
        emoji="☎️"
        open={secNumerosA2PAbierto}
        onToggle={() => setSecNumerosA2PAbierto((x) => !x)}
      >
        <div className="mb-4 flex items-center justify-end">
          <button type="button" onClick={() => setPhoneModalOpen(true)} className="rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455]">Agregar número</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs theme-text-muted border-b theme-border/80">
              <tr>
                <th className="px-3 py-2">Número</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Asignado a</th>
                <th className="px-3 py-2">Rotación</th>
              </tr>
            </thead>
            <tbody>
              {phoneNumbers.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-4 text-center theme-text-dim">Sin números</td></tr>
              ) : (
                phoneNumbers.map((p) => (
                  <tr key={p.id} className="border-b theme-border/80">
                    <td className="px-3 py-2 theme-text-secondary">{p.numero}</td>
                    <td className="px-3 py-2 theme-text-muted">{p.descripcion ?? '—'}</td>
                    <td className="px-3 py-2 theme-text-muted">{p.estado ?? '—'}</td>
                    <td className="px-3 py-2 theme-text-muted">{p.asignado_a ?? '—'}</td>
                    <td className="px-3 py-2 theme-text-muted">{p.rotacion ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCollapsibleSection>

      {/* Créditos — usuarios */}
      <AdminCollapsibleSection
        title="Usuarios y créditos"
        emoji="👥"
        open={secUsuariosCreditosAbierto}
        onToggle={() => setSecUsuariosCreditosAbierto((x) => !x)}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm theme-text-muted">
              Plan, minutos y SMS. Búsqueda por nombre o email.
            </p>
          </div>
          <input
            type="search"
            value={usersCreditsSearch}
            onChange={(e) => setUsersCreditsSearch(e.target.value)}
            placeholder="Buscar por nombre o email…"
            className="w-full max-w-sm rounded-lg border border-zinc-800/80 bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
          />
        </div>
        {creditsAdjustToast && (
          <div
            className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium ${
              creditsAdjustToast === 'Créditos actualizados correctamente'
                ? 'bg-[#22c55e]/20 text-[#22c55e]'
                : 'bg-red-500/15 text-red-300'
            }`}
          >
            {creditsAdjustToast}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b theme-border/80 text-xs theme-text-muted">
              <tr>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Minutos</th>
                <th className="px-3 py-2">SMS</th>
                <th className="px-3 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {usersCreditsFiltered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center theme-text-dim">
                    {usersCreditsList.length === 0 ? 'No hay usuarios.' : 'Ningún resultado para la búsqueda.'}
                  </td>
                </tr>
              ) : (
                usersCreditsFiltered.map((u) => {
                  const c = u.credits
                  const plan = c?.plan_voz ?? null
                  const mins = Math.floor(Number(c?.minutos_voz ?? 0))
                  const sms = Math.floor(Number(c?.sms_disponibles ?? 0))
                  const nombreCol = u.nombre?.trim() || '—'
                  return (
                    <tr key={u.id} className="border-b theme-border/80">
                      <td className="px-3 py-2 font-medium theme-text-primary">{nombreCol}</td>
                      <td className="px-3 py-2 theme-text-muted">{u.email ?? '—'}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${planVozBadgeClass(plan)}`}
                        >
                          {planVozLabel(plan)}
                        </span>
                      </td>
                      <td className="px-3 py-2 theme-text-muted">{mins}</td>
                      <td className="px-3 py-2 theme-text-muted">{sms}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => openCreditsAdjustModal(u)}
                          className="rounded bg-[#22c55e]/20 px-2.5 py-1 text-xs font-semibold text-[#22c55e] hover:bg-[#22c55e]/30"
                        >
                          💳 Créditos
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminCollapsibleSection>

      <AdminCollapsibleSection
        title="Compliance de usuarios"
        emoji="📋"
        open={secComplianceAbierto}
        onToggle={() => setSecComplianceAbierto((x) => !x)}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm theme-text-muted">Filtrar:</span>
          {(
            [
              { id: 'all' as const, label: 'Todos' },
              { id: 'signed' as const, label: 'Firmados' },
              { id: 'pending' as const, label: 'Pendientes' },
            ]
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setComplianceUserFilter(opt.id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                complianceUserFilter === opt.id
                  ? 'bg-[#22c55e]/25 text-[#22c55e] ring-1 ring-[#22c55e]/40'
                  : 'bg-zinc-800/60 theme-text-muted hover:bg-zinc-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b theme-border/80 text-xs theme-text-muted">
              <tr>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">País</th>
                <th className="px-3 py-2">Fuente</th>
                <th className="px-3 py-2">Firmado</th>
                <th className="px-3 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {complianceUserRowsFiltered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center theme-text-dim">
                    Ningún usuario en este filtro.
                  </td>
                </tr>
              ) : (
                complianceUserRowsFiltered.map(({ user: u, agreement: a }) => (
                  <tr key={u.id} className="border-b theme-border/80">
                    <td className="px-3 py-2 theme-text-secondary">{u.email ?? u.id}</td>
                    <td className="px-3 py-2 theme-text-muted">
                      {a?.company_name ?? u.company_name ?? '—'}
                    </td>
                    <td className="px-3 py-2 theme-text-muted">{a?.country ?? '—'}</td>
                    <td className="px-3 py-2 theme-text-muted max-w-[200px] truncate" title={a?.contact_source ?? ''}>
                      {a?.contact_source ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {a ? (
                        <span className="inline-flex rounded-full border border-[#22c55e]/40 bg-[#22c55e]/15 px-2.5 py-0.5 text-xs font-semibold text-[#22c55e]">
                          Firmado
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          disabled={!a}
                          onClick={() => a && setComplianceDetailModal(a)}
                          className="rounded bg-[#22c55e]/20 px-2 py-1 text-xs font-semibold text-[#22c55e] hover:bg-[#22c55e]/30 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Ver declaración
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Próximamente"
                          className="cursor-not-allowed rounded bg-zinc-700/50 px-2 py-1 text-xs font-semibold theme-text-dim opacity-60"
                        >
                          Exportar PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCollapsibleSection>

      {/* Usuarios */}
      <AdminCollapsibleSection
        title="Usuarios"
        emoji="🧑‍💼"
        open={secUsuariosListaAbierto}
        onToggle={() => setSecUsuariosListaAbierto((x) => !x)}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs theme-text-muted border-b theme-border/80">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Nicho</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Minutos</th>
                <th className="px-3 py-2">Último acceso</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b theme-border/80">
                  <td className="px-3 py-2 theme-text-secondary">{u.email ?? '—'}</td>
                  <td className="px-3 py-2 theme-text-muted">{u.company_name ?? '—'}</td>
                  <td className="px-3 py-2 theme-text-muted">{u.nicho ?? '—'}</td>
                  <td className="px-3 py-2 theme-text-muted">{u.plan ?? '—'}</td>
                  <td className="px-3 py-2 theme-text-muted">{u.minutos_disponibles ?? 0}</td>
                  <td className="px-3 py-2 theme-text-muted">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : '—'}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => { setAddMinutesUserId(u.id); setAddMinutesAmount('') }} className="rounded bg-[#22c55e]/20 px-2 py-1 text-xs font-semibold text-[#22c55e] hover:bg-[#22c55e]/30">Agregar minutos</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCollapsibleSection>

      {/* Actividad global */}
      <AdminCollapsibleSection
        title="Actividad Global"
        emoji="🌐"
        open={secActividadGlobalAbierto}
        onToggle={() => setSecActividadGlobalAbierto((x) => !x)}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs theme-text-muted border-b theme-border/80">
              <tr>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Contacto</th>
                <th className="px-3 py-2">Duración</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Costo</th>
                <th className="px-3 py-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {callLogs.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-4 text-center theme-text-dim">Sin registros</td></tr>
              ) : (
                callLogs.map((l) => (
                  <tr key={l.id} className="border-b theme-border/80">
                    <td className="px-3 py-2 theme-text-muted">{l.user_email ?? l.user_id}</td>
                    <td className="px-3 py-2 theme-text-muted">{l.resumen?.trim() || '—'}</td>
                    <td className="px-3 py-2 theme-text-muted">
                      {l.duracion_minutos != null ? `${Number(l.duracion_minutos)} min` : '—'}
                    </td>
                    <td className="px-3 py-2 theme-text-muted">{l.disposition ?? '—'}</td>
                    <td className="px-3 py-2 theme-text-muted">
                      {l.costo_usd != null ? `$${Number(l.costo_usd).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-2 theme-text-muted">{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCollapsibleSection>

      {/* Modal Nicho */}
      {nichoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 py-8 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border theme-border/80 theme-bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold theme-text-primary">{editingNicho ? 'Editar nicho' : 'Nuevo nicho'}</h3>
              <button type="button" onClick={() => setNichoModalOpen(false)} className="rounded p-2 theme-text-muted hover:bg-zinc-800/60"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs theme-text-muted">Categoría</label>
                <select
                  value={nichoForm.categoria ?? ''}
                  onChange={(e) => setNichoForm((prev) => ({ ...prev, categoria: e.target.value }))}
                  className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                >
                  {CATEGORIAS_NICHO_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {nichoFields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs theme-text-muted">{f.label}</label>
                  <textarea
                    value={(nichoForm[f.key] as string) ?? ''}
                    onChange={(e) => setNichoForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    rows={f.key === 'objeciones_nicho_extra' ? 3 : 2}
                    className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setNichoModalOpen(false)} className="rounded-lg px-3 py-2 text-sm theme-text-muted ring-1 ring-zinc-700/80">Cancelar</button>
              <button type="button" onClick={saveNicho} disabled={savingNicho || !nichoForm.nicho.trim()} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] disabled:opacity-60">
                {savingNicho ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar número */}
      {phoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border theme-border/80 theme-bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold theme-text-primary">Agregar número</h3>
              <button type="button" onClick={() => setPhoneModalOpen(false)} className="rounded p-2 theme-text-muted hover:bg-zinc-800/60"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm theme-text-muted">Número</label>
                <input value={newNumero} onChange={(e) => setNewNumero(e.target.value)} className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80" placeholder="+1234567890" />
              </div>
              <div>
                <label className="text-sm theme-text-muted">Descripción</label>
                <input value={newDescripcion} onChange={(e) => setNewDescripcion(e.target.value)} className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80" />
              </div>
              <div>
                <label className="text-sm theme-text-muted">Mes rotación</label>
                <input value={newRotacion} onChange={(e) => setNewRotacion(e.target.value)} className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80" placeholder="Ej. 2025-01" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPhoneModalOpen(false)} className="rounded-lg px-3 py-2 text-sm theme-text-muted ring-1 ring-zinc-700/80">Cancelar</button>
              <button type="button" onClick={addPhoneNumber} disabled={savingPhone} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] disabled:opacity-60">{savingPhone ? 'Guardando...' : 'Agregar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar integración CRM */}
      {crmCatalogEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border theme-border/80 theme-bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold theme-text-primary">Editar integración</h3>
              <button type="button" onClick={() => setCrmCatalogEdit(null)} className="rounded p-2 theme-text-muted hover:bg-zinc-800/60"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs theme-text-muted">Nombre</label>
                <input
                  value={crmCatalogEdit.name}
                  onChange={(e) => setCrmCatalogEdit((p) => p ? { ...p, name: e.target.value } : null)}
                  className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                />
              </div>
              <div>
                <label className="text-xs theme-text-muted">Descripción</label>
                <textarea
                  value={crmCatalogEdit.description ?? ''}
                  onChange={(e) => setCrmCatalogEdit((p) => p ? { ...p, description: e.target.value || null } : null)}
                  rows={2}
                  className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs theme-text-muted">Emoji (fallback)</label>
                  <input
                    value={crmCatalogEdit.emoji ?? ''}
                    onChange={(e) => setCrmCatalogEdit((p) => p ? { ...p, emoji: e.target.value || null } : null)}
                    className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80"
                    placeholder="🏢"
                  />
                </div>
                <div>
                  <label className="text-xs theme-text-muted">Orden</label>
                  <input
                    type="number"
                    min="0"
                    value={crmCatalogEdit.sort_order}
                    onChange={(e) => setCrmCatalogEdit((p) => p ? { ...p, sort_order: parseInt(e.target.value, 10) || 0 } : null)}
                    className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs theme-text-muted">URL del logo (ej: https://img.logo.dev/hubspot.com?token=TOKEN&size=128)</label>
                <input
                  value={crmCatalogEdit.logo_url ?? ''}
                  onChange={(e) => setCrmCatalogEdit((p) => p ? { ...p, logo_url: e.target.value || null } : null)}
                  className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80"
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs theme-text-muted">Badge</label>
                  <input
                    value={crmCatalogEdit.badge ?? ''}
                    onChange={(e) => setCrmCatalogEdit((p) => p ? { ...p, badge: e.target.value || null } : null)}
                    className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80"
                    placeholder="Popular en LATAM"
                  />
                </div>
                <div>
                  <label className="text-xs theme-text-muted">Badge (clases Tailwind)</label>
                  <input
                    value={crmCatalogEdit.badge_color ?? ''}
                    onChange={(e) => setCrmCatalogEdit((p) => p ? { ...p, badge_color: e.target.value || null } : null)}
                    className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80"
                    placeholder="bg-emerald-500/15 text-emerald-300"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={crmCatalogEdit.visible}
                  onChange={(e) => setCrmCatalogEdit((p) => p ? { ...p, visible: e.target.checked } : null)}
                  className="rounded border-zinc-600 theme-bg-base text-[#22c55e]"
                />
                <span className="text-xs theme-text-muted">Visible en página Integraciones</span>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCrmCatalogEdit(null)} className="rounded-lg px-3 py-2 text-sm theme-text-muted ring-1 ring-zinc-700/80">Cancelar</button>
              <button type="button" onClick={saveCrmCatalogEdit} disabled={savingCrmCatalog} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] disabled:opacity-60">
                {savingCrmCatalog ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cargar créditos (admin) */}
      {creditsModalUser && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-8">
          <div className="w-full max-w-lg rounded-2xl border theme-border/80 bg-[#0b0b0b] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="pr-8 text-lg font-semibold theme-text-primary">
                Créditos de{' '}
                {creditsModalUser.nombre?.trim() || creditsModalUser.email || 'usuario'}
              </h3>
              <button
                type="button"
                onClick={() => setCreditsModalUser(null)}
                className="shrink-0 rounded-lg p-2 theme-text-muted hover:bg-zinc-800/60"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label className="text-sm font-medium theme-text-muted">Plan</label>
                <select
                  value={creditPlan}
                  onChange={(e) => setCreditPlan(e.target.value as PlanVozAdmin)}
                  className="mt-2 w-full rounded-lg border border-zinc-800/80 bg-[#111111] px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                >
                  {PLAN_VOZ_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {planVozLabel(p)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium theme-text-muted">Minutos actuales</label>
                <div className="mt-2 rounded-lg border border-zinc-800/80 bg-[#111111] px-3 py-2.5 text-sm text-zinc-300">
                  {creditInitialMinutos}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium theme-text-muted">Minutos a agregar</label>
                <div className="mt-2 flex flex-wrap items-stretch gap-2">
                  <input
                    type="number"
                    min={0}
                    value={creditMinutosAgregar}
                    onChange={(e) => setCreditMinutosAgregar(e.target.value)}
                    placeholder="ej: 100"
                    className="min-w-[120px] flex-1 rounded-lg border border-zinc-800/80 bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                  <button
                    type="button"
                    onClick={applyCreditMinutosAgregar}
                    className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
                  >
                    + Agregar
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium theme-text-muted">Minutos totales</label>
                <input
                  type="number"
                  min={0}
                  value={creditMinutosTotales}
                  onChange={(e) => setCreditMinutosTotales(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="mt-2 w-full rounded-lg border border-zinc-800/80 bg-[#0b0b0b] px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                />
              </div>

              <div>
                <label className="text-sm font-medium theme-text-muted">SMS actuales</label>
                <div className="mt-2 rounded-lg border border-zinc-800/80 bg-[#111111] px-3 py-2.5 text-sm text-zinc-300">
                  {creditInitialSms}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium theme-text-muted">SMS a agregar</label>
                <div className="mt-2 flex flex-wrap items-stretch gap-2">
                  <input
                    type="number"
                    min={0}
                    value={creditSmsAgregar}
                    onChange={(e) => setCreditSmsAgregar(e.target.value)}
                    placeholder="ej: 50"
                    className="min-w-[120px] flex-1 rounded-lg border border-zinc-800/80 bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                  <button
                    type="button"
                    onClick={applyCreditSmsAgregar}
                    className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
                  >
                    + Agregar
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium theme-text-muted">Nota interna</label>
                <textarea
                  value={creditNota}
                  onChange={(e) => setCreditNota(e.target.value)}
                  rows={3}
                  placeholder="Opcional — motivo del ajuste…"
                  className="mt-2 w-full resize-none rounded-lg border border-zinc-800/80 bg-[#0b0b0b] px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-2 border-t border-zinc-800/60 pt-5">
              <button
                type="button"
                onClick={() => setCreditsModalUser(null)}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveCreditsAdjust}
                disabled={savingCreditsAdjust}
                className="rounded-lg bg-[#22c55e] px-5 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60"
              >
                {savingCreditsAdjust ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activityLogDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border theme-border/80 theme-bg-card shadow-xl">
            <div className="flex items-start justify-between gap-2 border-b border-zinc-800 px-5 py-4">
              <h3 className="text-lg font-semibold theme-text-primary">Detalle del log</h3>
              <button
                type="button"
                onClick={() => setActivityLogDetailModal(null)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(85vh-5rem)] overflow-y-auto px-5 py-4">
              <p className="text-xs text-zinc-500">
                {activityLogDetailModal.accion} · {activityLogDetailModal.categoria}
              </p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0b0b0b] p-3 text-left text-xs text-zinc-300">
                {JSON.stringify(
                  {
                    id: activityLogDetailModal.id,
                    user_id: activityLogDetailModal.user_id,
                    accion: activityLogDetailModal.accion,
                    categoria: activityLogDetailModal.categoria,
                    pagina: activityLogDetailModal.pagina,
                    detalle: activityLogDetailModal.detalle,
                    error_mensaje: activityLogDetailModal.error_mensaje,
                    error_stack: activityLogDetailModal.error_stack,
                    user_agent: activityLogDetailModal.user_agent,
                    created_at: activityLogDetailModal.created_at,
                    users: activityLogDetailModal.users,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>
        </div>
      )}

      {complianceDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border theme-border theme-bg-card p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-compliance-detail-title"
          >
            <div className="flex items-start justify-between gap-2">
              <h3
                id="admin-compliance-detail-title"
                className="text-lg font-semibold theme-text-primary"
              >
                Declaración de cumplimiento
              </h3>
              <button
                type="button"
                onClick={() => setComplianceDetailModal(null)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Usuario:{' '}
              {users.find((x) => x.id === complianceDetailModal.user_id)?.email ??
                complianceDetailModal.user_id}
            </p>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-zinc-400">Referencia</dt>
                <dd className="break-all font-mono text-xs theme-text-secondary">
                  {complianceDetailModal.id}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">Fecha</dt>
                <dd className="theme-text-secondary">
                  {new Date(complianceDetailModal.created_at).toLocaleString('es-ES')}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">Empresa</dt>
                <dd className="theme-text-secondary">{complianceDetailModal.company_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">Tipo de negocio</dt>
                <dd className="theme-text-secondary">{complianceDetailModal.business_type}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">País</dt>
                <dd className="theme-text-secondary">{complianceDetailModal.country}</dd>
              </div>
              {complianceDetailModal.website && (
                <div>
                  <dt className="text-xs text-zinc-400">Sitio web</dt>
                  <dd className="break-all theme-text-secondary">{complianceDetailModal.website}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-zinc-400">Origen de contactos</dt>
                <dd className="theme-text-secondary">{complianceDetailModal.contact_source}</dd>
              </div>
              {complianceDetailModal.contact_source_other && (
                <div>
                  <dt className="text-xs text-zinc-400">Otro</dt>
                  <dd className="theme-text-secondary">
                    {complianceDetailModal.contact_source_other}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-zinc-400">Descripción del consentimiento</dt>
                <dd className="whitespace-pre-wrap theme-text-secondary">
                  {complianceDetailModal.consent_description}
                </dd>
              </div>
              {complianceDetailModal.privacy_policy_url && (
                <div>
                  <dt className="text-xs text-zinc-400">URL política de privacidad</dt>
                  <dd className="break-all theme-text-secondary">
                    {complianceDetailModal.privacy_policy_url}
                  </dd>
                </div>
              )}
              {complianceDetailModal.opt_in_form_url && (
                <div>
                  <dt className="text-xs text-zinc-400">URL opt-in</dt>
                  <dd className="break-all theme-text-secondary">
                    {complianceDetailModal.opt_in_form_url}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-zinc-400">Declaraciones</dt>
                <dd className="space-y-1 text-xs theme-text-secondary">
                  <div>Consentimiento contactos: {complianceDetailModal.decl_consent_contacts ? 'Sí' : 'No'}</div>
                  <div>Leyes aplicables: {complianceDetailModal.decl_laws ? 'Sí' : 'No'}</div>
                  <div>Opt-out: {complianceDetailModal.decl_opt_out ? 'Sí' : 'No'}</div>
                  <div>Responsabilidad usuario: {complianceDetailModal.decl_responsibility ? 'Sí' : 'No'}</div>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">IP</dt>
                <dd className="font-mono text-xs theme-text-secondary">
                  {complianceDetailModal.ip_address ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">User-Agent</dt>
                <dd className="break-all text-xs theme-text-secondary">
                  {complianceDetailModal.user_agent ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-400">Versión términos</dt>
                <dd className="theme-text-secondary">
                  {complianceDetailModal.terms_version ?? 'v1.0'}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setComplianceDetailModal(null)}
              className="mt-6 w-full rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {ticketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border theme-border/80 theme-bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold theme-text-primary">Responder ticket</h3>
              <button
                type="button"
                onClick={() => {
                  setTicketModal(null)
                  setTicketReply('')
                }}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-xs theme-text-dim">ID: {ticketModal.id}</p>
            <p className="mt-3 text-sm theme-text-muted">
              <span className="font-medium theme-text-primary">Descripción: </span>
              {ticketModal.descripcion}
            </p>
            <label className="mt-4 block text-sm theme-text-muted" htmlFor="ticket-reply">
              Respuesta (el ticket pasará a resuelto)
            </label>
            <textarea
              id="ticket-reply"
              value={ticketReply}
              onChange={(e) => setTicketReply(e.target.value)}
              rows={5}
              className="mt-2 w-full rounded-lg border border-zinc-800 bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="Escribe la respuesta para el usuario…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setTicketModal(null)
                  setTicketReply('')
                }}
                className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void saveTicketResponse()}
                disabled={savingTicketReply || !ticketReply.trim()}
                className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-50"
              >
                {savingTicketReply ? 'Guardando…' : 'Guardar y resolver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal agregar minutos */}
      {addMinutesUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border theme-border/80 theme-bg-card p-5">
            <h3 className="text-lg font-semibold theme-text-primary">Agregar minutos</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm theme-text-muted">Minutos</label>
                <input type="number" min="1" value={addMinutesAmount} onChange={(e) => setAddMinutesAmount(e.target.value)} className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80" />
              </div>
              <div>
                <label className="text-sm theme-text-muted">Plan</label>
                <select value={addMinutesPlan} onChange={(e) => setAddMinutesPlan(e.target.value as 'BASICO' | 'PRO' | 'PREMIUM')} className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80">
                  <option value="BASICO">Básico</option>
                  <option value="PRO">Pro</option>
                  <option value="PREMIUM">Premium</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAddMinutesUserId(null)} className="rounded-lg px-3 py-2 text-sm theme-text-muted ring-1 ring-zinc-700/80">Cancelar</button>
              <button type="button" onClick={addMinutesForUser} disabled={savingMinutes || !addMinutesAmount} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] disabled:opacity-60">{savingMinutes ? 'Guardando...' : 'Agregar'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
