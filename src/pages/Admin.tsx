import { useEffect, useState } from 'react'
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

type CallLog = {
  id: string
  user_id: string
  contacto: string | null
  duracion: number | null
  estado: string | null
  costo: number | null
  created_at: string
  user_email?: string
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

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError || !session?.user?.id) { setError('No autorizado'); return }
        const { data: me } = await supabase.from('users').select('es_admin').eq('id', session.user.id).maybeSingle()
        if (!me?.es_admin) { setError('Acceso denegado'); return }

        const [usersRes, callsRes, callsTodayRes, config, phones, usersData, logs, nichosData, plansData, catalogData] = await Promise.all([
          supabase.from('users').select('*', { count: 'exact', head: true }),
          supabase.from('call_logs').select('*', { count: 'exact', head: true }),
          supabase.from('call_logs').select('duracion').gte('created_at', new Date().toISOString().slice(0, 10)),
          supabase
            .from('admin_config')
            .select(
              'id, retell_api_key, updated_at, twilio_account_sid, twilio_auth_token, twilio_phone_number, price_per_min_basico, price_per_min_pro, price_per_min_premium',
            )
            .limit(1)
            .maybeSingle(),
          supabase.from('phone_numbers').select('id, numero, descripcion, estado, asignado_a, rotacion').order('numero'),
          supabase.from('users').select('id, email, company_name, nicho').order('email'),
          supabase.from('call_logs').select('id, user_id, contacto, duracion, estado, costo, created_at').order('created_at', { ascending: false }).limit(100),
          supabase.from('nicho_templates').select('*').order('nicho'),
          supabase.from('plan_config').select('*').order('precio_por_minuto', { ascending: true }),
          supabase
            .from('crm_integration_catalog')
            .select('id, crm_type, name, description, emoji, logo_url, is_visible, sort_order, badge, badge_color, plan_required')
            .order('sort_order', { ascending: true }),
        ])

        if (!mounted) return
        const totalUsers = usersRes.count ?? 0
        const totalCalls = callsRes.count ?? 0
        const callsToday = callsTodayRes.data ?? []
        const minutesToday = callsToday.reduce((s, r: { duracion?: number }) => s + (r.duracion ?? 0), 0)

        const configRow = config?.data as {
          id?: string
          retell_api_key?: string
          twilio_account_sid?: string
          twilio_auth_token?: string
          twilio_phone_number?: string
          price_per_min_basico?: number | null
          price_per_min_pro?: number | null
          price_per_min_premium?: number | null
        } | null

        const cfgBasico = configRow?.price_per_min_basico ?? DEFAULT_COST_PER_MIN_BASICO
        const cfgPro = configRow?.price_per_min_pro ?? DEFAULT_COST_PER_MIN_PRO
        const cfgPremium = configRow?.price_per_min_premium ?? DEFAULT_COST_PER_MIN_PREMIUM

        setPriceBasico(cfgBasico)
        setPricePro(cfgPro)
        setPricePremium(cfgPremium)

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
          const { data: emailsData } = await supabase.from('users').select('id, email').in('id', userIds)
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

  if (loading) return <div className="flex items-center justify-center py-12"><span className="text-sm theme-text-muted">Cargando panel admin...</span></div>
  if (error) return <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">{error}. Solo usuarios administradores pueden acceder.</div>

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

      {/* Retell API */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Configuración de Retell API</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input type="password" value={retellKey} onChange={(e) => setRetellKey(e.target.value)} placeholder="API Key de Retell" className="rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] w-64" />
          <button type="button" onClick={saveAndVerifyRetell} disabled={savingRetell} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60">Guardar y verificar</button>
          {retellStatus === 'connected' && <span className="rounded-full bg-[#22c55e]/20 px-2 py-1 text-xs font-semibold text-[#22c55e]">Conectado ✓</span>}
          {retellStatus === 'error' && <span className="rounded-full bg-red-500/20 px-2 py-1 text-xs font-semibold text-red-300">Key inválida</span>}
        </div>
        {retellError && <p className="mt-2 text-sm text-red-300">{retellError}</p>}
      </div>

      {/* Configuración de Twilio */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Configuración de Twilio</h2>
        <div className="mt-4 space-y-4">
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
      </div>

      {/* Configuración de precios */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Configuración de precios por minuto</h2>
        <p className="mt-1 text-sm theme-text-muted">
          Estos valores se usan para calcular los cargos de recarga y las métricas de ingresos estimados.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
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
      </div>

      {/* Planes y Precios */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Planes y Precios</h2>
        <p className="mt-1 text-sm theme-text-muted">
          Edita nombre, emoji, precio por minuto, descripción y features de cada plan. Los cambios se reflejan en Credits y Landing.
        </p>
        {planSaveToast && (
          <div className="mt-3 rounded-lg bg-[#22c55e]/20 px-3 py-2 text-sm font-medium text-[#22c55e]">
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
      </div>

      {/* Nichos */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold theme-text-primary">Templates de Nicho</h2>
            <p className="text-sm theme-text-muted mt-1">Variables dinámicas que el agente usa según el nicho del cliente.</p>
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
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
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
      </div>

      {/* Integraciones CRM (catálogo) */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Integraciones CRM</h2>
        <p className="mt-1 text-sm theme-text-muted">Decide qué integraciones mostrar en la página /integrations. Edita nombre, logo y badge.</p>
        <div className="mt-4 overflow-x-auto">
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
      </div>

      {/* Números A2P */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold theme-text-primary">Números de Teléfono A2P</h2>
          <button type="button" onClick={() => setPhoneModalOpen(true)} className="rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455]">Agregar número</button>
        </div>
        <div className="mt-4 overflow-x-auto">
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
      </div>

      {/* Usuarios */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Usuarios</h2>
        <div className="mt-4 overflow-x-auto">
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
      </div>

      {/* Actividad global */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Actividad Global</h2>
        <div className="mt-4 overflow-x-auto">
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
                    <td className="px-3 py-2 theme-text-muted">{l.contacto ?? '—'}</td>
                    <td className="px-3 py-2 theme-text-muted">{l.duracion ?? 0} min</td>
                    <td className="px-3 py-2 theme-text-muted">{l.estado ?? '—'}</td>
                    <td className="px-3 py-2 theme-text-muted">{l.costo != null ? `$${l.costo.toFixed(2)}` : '—'}</td>
                    <td className="px-3 py-2 theme-text-muted">{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
