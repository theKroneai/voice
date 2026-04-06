import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Upload, UserPlus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'
import { UpgradePlanModal } from '../components/UpgradePlanModal'

type UserPlan = 'prospectador' | 'vendedor' | 'cazador'

function canUseSequence(sequence: { plan_requerido?: string | null }, userPlan: UserPlan): boolean {
  const req = sequence.plan_requerido || 'prospectador'
  if (req === 'prospectador') return true
  if (req === 'vendedor') return ['vendedor', 'cazador'].includes(userPlan)
  if (req === 'cazador') return userPlan === 'cazador'
  return true
}

type CampaignOption = {
  id: string
  nombre: string
}

type ContactStatus =
  | 'draft'
  | 'pending'
  | 'calling'
  | 'completed'
  | 'appointed'
  | 'callback'
  | 'voicemail'
  | 'no_answer'
  | 'do_not_call'
  | 'max_attempts'
  | `rejected_${1 | 2 | 3 | 4 | 5 | 6 | 7}`
  | string

type ContactRow = {
  id: string
  nombre: string | null
  telefono: string | null
  pais: string | null
  direccion?: string | null
  email?: string | null
  disposition?: string | null
  zipcode: string | null
  ciudad: string | null
  status: ContactStatus | null
  intento_actual: number | null
  proxima_llamada: string | null
  callback_hora?: string | null
  notas?: string | null
  created_at?: string | null
  campaign_id: string | null
}

type CountryRate = {
  codigo_pais: string
  nombre_pais: string
  bandera: string | null
  prefijo: string | null
}

type SequenceOption = { id: string; nombre: string; nicho: string; plan_requerido?: string | null }

const SEQUENCE_CATEGORIES: Record<string, { emoji: string; label: string }> = {
  agua: { emoji: '💧', label: 'Agua' },
  citas: { emoji: '📅', label: 'Citas' },
  salud: { emoji: '🏥', label: 'Salud' },
  hogar: { emoji: '🏠', label: 'Hogar' },
  reviews: { emoji: '⭐', label: 'Reviews' },
  general: { emoji: '🌐', label: 'General' },
  todos: { emoji: '🌐', label: 'General' },
}
const CATEGORY_ORDER = ['agua', 'citas', 'salud', 'hogar', 'reviews', 'general']

function sequenceCategoryKey(nicho: string): string {
  if (CATEGORY_ORDER.includes(nicho)) return nicho
  return 'general'
}

type AssignStepPreview = { dia: number; canal: string; mensaje: string }

type ActiveSequenceInfo = {
  contact_sequence_id: string
  sequence_id: string
  sequence_name: string
  paso_actual: number
  fecha_inicio: string
  ewg_contaminantes: Record<string, unknown> | null
  steps: { dia: number; canal: string; mensaje: string; hora_envio: string | null }[]
}

type CsvParseResult = {
  headers: string[]
  rows: Array<Record<string, string>>
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function parseCsv(text: string): CsvParseResult {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string) => {
    const out: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        const next = line[i + 1]
        if (inQuotes && next === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
        continue
      }
      if (ch === ',' && !inQuotes) {
        out.push(cur.trim())
        cur = ''
        continue
      }
      cur += ch
    }
    out.push(cur.trim())
    return out
  }

  const headers = parseLine(lines[0]).map((h, idx) => (h ? h : `col_${idx + 1}`))
  const rows: Array<Record<string, string>> = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = (values[j] ?? '').trim()
    }
    rows.push(row)
  }

  return { headers, rows }
}

function parseExcel(buffer: ArrayBuffer): CsvParseResult {
  const wb = XLSX.read(buffer, { type: 'array' })
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase() === 'contactos') ?? wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  if (!ws) return { headers: [], rows: [] }

  const rows2d = XLSX.utils.sheet_to_json<string[]>(ws, {
    header: 1,
    raw: false,
    defval: '',
  })

  const lines = rows2d.filter((r) => (r ?? []).some((c) => String(c).trim().length > 0))
  if (lines.length === 0) return { headers: [], rows: [] }

  const headers = (lines[0] ?? []).map((h, idx) =>
    String(h || '').trim() || `col_${idx + 1}`,
  )
  const rows: Array<Record<string, string>> = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i] ?? []
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = String(values[j] ?? '').trim()
    }
    rows.push(row)
  }

  return { headers, rows }
}

function isValidPhone(value: string): boolean {
  const cleaned = value.replace(/\s+/g, '')
  return /^\+?\d{10,15}$/.test(cleaned)
}

function isoToDatetimeLocal(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

function datetimeLocalToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function Badge({ status }: { status: ContactStatus }) {
  const base =
    'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1'

  const s = status ?? 'pending'
  if (s === 'draft') {
    return (
      <span className={`${base} bg-zinc-700/30 theme-text-secondary ring-zinc-500/30`}>
        Borrador
      </span>
    )
  }
  if (s === 'pending') {
    return (
      <span className={`${base} bg-sky-500/20 text-sky-300 ring-sky-400/30`}>
        Pendiente
      </span>
    )
  }
  if (s === 'calling') {
    return (
      <span
        className={`${base} bg-amber-400/20 text-amber-200 ring-amber-300/30 animate-pulse`}
      >
        Llamando
      </span>
    )
  }
  if (s === 'completed') {
    return (
      <span className={`${base} bg-emerald-500/20 text-emerald-300 ring-emerald-400/30`}>
        Completado
      </span>
    )
  }
  if (s === 'appointed') {
    return (
      <span className={`${base} bg-violet-500/20 text-violet-300 ring-violet-400/30`}>
        Cita agendada
      </span>
    )
  }
  if (s === 'callback') {
    return (
      <span className={`${base} bg-orange-500/20 text-orange-300 ring-orange-400/30`}>
        Callback
      </span>
    )
  }
  if (s === 'voicemail') {
    return (
      <span className={`${base} bg-zinc-500/20 theme-text-secondary ring-zinc-400/30`}>
        Buzón
      </span>
    )
  }
  if (s === 'no_answer') {
    return (
      <span className={`${base} bg-zinc-500/20 theme-text-secondary ring-zinc-400/30`}>
        Sin respuesta
      </span>
    )
  }
  return (
    <span className={`${base} bg-zinc-400/15 theme-text-muted ring-zinc-300/20`}>
      {String(s)}
    </span>
  )
}

async function getUserIdOrThrow() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error) throw new Error(error.message)
  const userId = session?.user?.id
  if (!userId) throw new Error('No hay sesión activa.')
  return userId
}

export default function Contacts() {
  const [searchParams] = useSearchParams()
  const initialCampaignFromQuery = searchParams.get('campaign')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [campaignId, setCampaignId] = useState<string>('all')
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [campaignsError, setCampaignsError] = useState<string | null>(null)

  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [contactsError, setContactsError] = useState<string | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  // CSV import state
  const [csvName, setCsvName] = useState<string | null>(null)
  const [csvParsed, setCsvParsed] = useState<CsvParseResult | null>(null)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvMapping, setCsvMapping] = useState<{
    nombre?: string
    telefono?: string
    pais?: string
    zipcode?: string
    direccion?: string
    ciudad?: string
  }>({})
  const [importCampaignId, setImportCampaignId] = useState<string>('')
  const [importing, setImporting] = useState(false)

  // Manual add state
  const [manualNombre, setManualNombre] = useState('')
  const [manualTelefono, setManualTelefono] = useState('')
  const [manualDireccion, setManualDireccion] = useState('')
  const [manualCiudad, setManualCiudad] = useState('')
  const [manualZipcode, setManualZipcode] = useState('')
  const [manualPais, setManualPais] = useState('US')
  const [manualCampaignId, setManualCampaignId] = useState<string>('')
  const [manualSaving, setManualSaving] = useState(false)
  const [manualError, setManualError] = useState<string | null>(null)
  const [countryRates, setCountryRates] = useState<CountryRate[]>([])

  const [editContact, setEditContact] = useState<ContactRow | null>(null)
  const [editNombre, setEditNombre] = useState('')
  const [editTelefono, setEditTelefono] = useState('')
  const [editDireccion, setEditDireccion] = useState('')
  const [editCiudad, setEditCiudad] = useState('')
  const [editZipcode, setEditZipcode] = useState('')
  const [editPais, setEditPais] = useState('US')
  const [editCampaignId, setEditCampaignId] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editStatus, setEditStatus] = useState<ContactStatus>('draft')
  const [editDisposition, setEditDisposition] = useState('')
  const [editIntentoActual, setEditIntentoActual] = useState<number>(0)
  const [editProximaLlamada, setEditProximaLlamada] = useState('')
  const [editCallbackHora, setEditCallbackHora] = useState('')
  const [editNotas, setEditNotas] = useState('')
  const [editCreatedAt, setEditCreatedAt] = useState('')
  const [prefixSuggestion, setPrefixSuggestion] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [importStatus, setImportStatus] = useState<'draft' | 'pending'>('draft')

  // Secuencias: asignar estrategia + panel detalle
  const [sequenceAssignOpen, setSequenceAssignOpen] = useState(false)
  const [sequenceAssignContact, setSequenceAssignContact] = useState<ContactRow | null>(null)
  const [sequencesList, setSequencesList] = useState<SequenceOption[]>([])
  const [assignSequenceId, setAssignSequenceId] = useState('')
  const [assignStartDate, setAssignStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [assignStepsPreview, setAssignStepsPreview] = useState<AssignStepPreview[]>([])
  const [assignGoogleReviewLink, setAssignGoogleReviewLink] = useState('')
  const [assignHora, setAssignHora] = useState('')
  const [assignReferido, setAssignReferido] = useState('')
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [assignUserPlan, setAssignUserPlan] = useState<UserPlan>('prospectador')
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [activeSequenceByContactId, setActiveSequenceByContactId] = useState<
    Record<string, ActiveSequenceInfo>
  >({})
  const [sequenceDetailContactId, setSequenceDetailContactId] = useState<string | null>(null)

  const previewRows = useMemo(() => {
    if (!csvParsed) return []
    return csvParsed.rows.slice(0, 5)
  }, [csvParsed])

  const canImport = useMemo(() => {
    if (!csvParsed) return false
    if (!importCampaignId) return false
    if (!csvMapping.telefono) return false
    return csvParsed.rows.length > 0
  }, [csvParsed, csvMapping.telefono, importCampaignId])

  async function loadCampaigns() {
    setCampaignsError(null)
    setLoadingCampaigns(true)
    try {
      const userId = await getUserIdOrThrow()
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, nombre')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      const list = (data ?? []) as CampaignOption[]
      setCampaigns(list)

      // Preselect from query if present
      if (initialCampaignFromQuery && list.some((c) => c.id === initialCampaignFromQuery)) {
        setCampaignId(initialCampaignFromQuery)
      }

      // Default campaign for modals
      const firstId = list[0]?.id ?? ''
      setImportCampaignId((prev) => prev || firstId)
      setManualCampaignId((prev) => prev || firstId)
    } catch (e) {
      setCampaigns([])
      setCampaignsError(e instanceof Error ? e.message : 'Error al cargar campañas.')
    } finally {
      setLoadingCampaigns(false)
    }
  }

  async function loadContacts(nextCampaignId: string) {
    setContactsError(null)
    setLoadingContacts(true)
    try {
      const userId = await getUserIdOrThrow()
      let q = supabase
        .from('contacts')
        .select(
          'id, nombre, telefono, pais, email, disposition, zipcode, ciudad, status, intento_actual, proxima_llamada, callback_hora, notas, created_at, campaign_id, direccion',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (nextCampaignId !== 'all') {
        q = q.eq('campaign_id', nextCampaignId)
      }

      const { data, error } = await q
      if (error) throw new Error(error.message)
      setContacts((data ?? []) as ContactRow[])
    } catch (e) {
      setContacts([])
      setContactsError(e instanceof Error ? e.message : 'Error al cargar contactos.')
    } finally {
      setLoadingContacts(false)
    }
  }

  useEffect(() => {
    void loadCampaigns()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase
        .from('country_rates')
        .select('codigo_pais, nombre_pais, bandera, prefijo')
        .eq('activo', true)
        .order('nombre_pais', { ascending: true })
      if (!mounted) return
      const list = (data ?? []) as CountryRate[]
      setCountryRates(list)
      if (list.length > 0 && !list.some((p) => p.codigo_pais === manualPais)) {
        setManualPais(list[0].codigo_pais)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    void loadContacts(campaignId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId])

  async function loadActiveSequencesForContacts() {
    try {
      const userId = await getUserIdOrThrow()
      const { data: csList, error: csErr } = await supabase
        .from('contact_sequences')
        .select('id, contact_id, sequence_id, paso_actual, fecha_inicio, ewg_contaminantes')
        .eq('user_id', userId)
        .eq('status', 'active')
      if (csErr) return
      const list = csList ?? []
      if (list.length === 0) {
        setActiveSequenceByContactId({})
        return
      }
      const seqIds = [...new Set(list.map((r) => r.sequence_id))]
      const { data: stepsData } = await supabase
        .from('sequence_steps')
        .select('sequence_id, orden, dia, canal, mensaje, hora_envio')
        .in('sequence_id', seqIds)
        .order('orden', { ascending: true })
      const stepsBySeq: Record<string, { dia: number; canal: string; mensaje: string; hora_envio: string | null }[]> = {}
      for (const s of stepsData ?? []) {
        if (!stepsBySeq[s.sequence_id]) stepsBySeq[s.sequence_id] = []
        stepsBySeq[s.sequence_id].push({
          dia: s.dia,
          canal: s.canal ?? 'sms',
          mensaje: s.mensaje ?? '',
          hora_envio: s.hora_envio,
        })
      }
      const { data: seqNames } = await supabase
        .from('sequences')
        .select('id, nombre')
        .in('id', seqIds)
      const namesById: Record<string, string> = {}
      for (const row of seqNames ?? []) {
        namesById[row.id] = row.nombre
      }
      const byContact: Record<string, ActiveSequenceInfo> = {}
      for (const cs of list) {
        byContact[cs.contact_id] = {
          contact_sequence_id: cs.id,
          sequence_id: cs.sequence_id,
          sequence_name: namesById[cs.sequence_id] ?? '—',
          paso_actual: cs.paso_actual ?? 0,
          fecha_inicio: cs.fecha_inicio,
          ewg_contaminantes: cs.ewg_contaminantes ?? null,
          steps: stepsBySeq[cs.sequence_id] ?? [],
        }
      }
      setActiveSequenceByContactId(byContact)
    } catch {
      setActiveSequenceByContactId({})
    }
  }

  useEffect(() => {
    void loadActiveSequencesForContacts()
  }, [contacts])

  function openAssignSequence(contact: ContactRow) {
    setSequenceAssignContact(contact)
    setAssignSequenceId('')
    setAssignStartDate(new Date().toISOString().slice(0, 10))
    setAssignStepsPreview([])
    setAssignGoogleReviewLink('')
    setAssignHora('')
    setAssignReferido('')
    setAssignError(null)
    setSequenceAssignOpen(true)
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
        const [seqRes, userRes, creditsRes] = await Promise.all([
          supabase
            .from('sequences')
            .select('id, nombre, nicho, plan_requerido')
            .or(`user_id.eq.${userId},es_publica.eq.true`)
            .order('nombre'),
          supabase.from('users').select('google_review_link').eq('id', userId).maybeSingle(),
          supabase.from('credits').select('plan_voz').eq('user_id', userId).maybeSingle(),
        ])
        // eslint-disable-next-line no-console
        console.log('users data:', userRes.data)
        // eslint-disable-next-line no-console
        console.log('users error:', userRes.error)
        setSequencesList((seqRes.data ?? []) as SequenceOption[])
        const grl = (userRes.data as { google_review_link?: string } | null)?.google_review_link ?? ''
        setAssignGoogleReviewLink(grl)
        const plan = (creditsRes.data as { plan_voz?: string } | null)?.plan_voz
        setAssignUserPlan((plan === 'vendedor' || plan === 'cazador' ? plan : 'prospectador') as UserPlan)
      } catch {
        setSequencesList([])
      }
    })()
  }

  useEffect(() => {
    if (!sequenceAssignOpen || !assignSequenceId) {
      setAssignStepsPreview([])
      return
    }
    let mounted = true
    supabase
      .from('sequence_steps')
      .select('dia, canal, mensaje')
      .eq('sequence_id', assignSequenceId)
      .order('orden', { ascending: true })
      .then(({ data }) => {
        if (mounted && data) {
          setAssignStepsPreview(
            data.map((s) => ({
              dia: s.dia,
              canal: s.canal ?? 'sms',
              mensaje: s.mensaje ?? '',
            }))
          )
        }
      })
    return () => {
      mounted = false
    }
  }, [sequenceAssignOpen, assignSequenceId])

  function closeAssignSequence() {
    setSequenceAssignOpen(false)
    setSequenceAssignContact(null)
    setAssignError(null)
  }

  function sequenceStepsUseVariable(steps: AssignStepPreview[], variable: string): boolean {
    return steps.some((s) => s.mensaje.includes(variable))
  }

  async function onActivateSequence() {
    if (!sequenceAssignContact || !assignSequenceId) return
    const selectedSeq = sequencesList.find((s) => s.id === assignSequenceId)
    if (selectedSeq && !canUseSequence(selectedSeq, assignUserPlan)) {
      setUpgradeModalOpen(true)
      return
    }
    const needsGoogleLink = sequenceStepsUseVariable(assignStepsPreview, '{google_review_link}')
    if (needsGoogleLink && !assignGoogleReviewLink.trim()) {
      setAssignError('Link de Google Review es obligatorio para esta estrategia.')
      return
    }
    setAssignSaving(true)
    setAssignError(null)
    try {
      const userId = await getUserIdOrThrow()
      const variablesExtra: Record<string, string> = {}
      if (assignGoogleReviewLink.trim()) variablesExtra.google_review_link = assignGoogleReviewLink.trim()
      if (assignHora.trim()) variablesExtra.hora = assignHora.trim()
      if (assignReferido.trim()) variablesExtra.referido = assignReferido.trim()
      const { error } = await supabase.from('contact_sequences').insert({
        contact_id: sequenceAssignContact.id,
        sequence_id: assignSequenceId,
        user_id: userId,
        status: 'active',
        fecha_inicio: assignStartDate,
        paso_actual: 0,
        ewg_contaminantes: null,
        ...(Object.keys(variablesExtra).length > 0 && { variables_extra: variablesExtra }),
      })
      if (error) throw new Error(error.message)
      closeAssignSequence()
      await loadActiveSequencesForContacts()
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : 'Error al activar secuencia.')
    } finally {
      setAssignSaving(false)
    }
  }

  function resolveMessagePreview(
    mensaje: string,
    contact: ContactRow,
    ewg: Record<string, unknown> | null
  ): string {
    let out = mensaje
    out = out.replace(/\{nombre\}/g, (contact.nombre ?? '').trim() || '{nombre}')
    out = out.replace(/\{ciudad\}/g, (contact.ciudad ?? '').trim() || '{ciudad}')
    out = out.replace(/\{zipcode\}/g, (contact.zipcode ?? '').trim() || '{zipcode}')
    if (ewg && typeof ewg.contaminante_1 === 'string') {
      out = out.replace(/\{contaminante_1\}/g, ewg.contaminante_1)
    }
    if (ewg && typeof ewg.contaminante_2 === 'string') {
      out = out.replace(/\{contaminante_2\}/g, ewg.contaminante_2)
    }
    if (ewg && typeof ewg.contaminante_3 === 'string') {
      out = out.replace(/\{contaminante_3\}/g, ewg.contaminante_3)
    }
    out = out.replace(/\{hora\}/g, '{hora}')
    return out
  }

  async function pauseContactSequence(csId: string) {
    try {
      const userId = await getUserIdOrThrow()
      await supabase
        .from('contact_sequences')
        .update({ status: 'paused' })
        .eq('id', csId)
        .eq('user_id', userId)
      await loadActiveSequencesForContacts()
    } catch {
      setContactsError('Error al pausar secuencia.')
    }
  }

  async function cancelContactSequence(csId: string) {
    if (!confirm('¿Cancelar esta secuencia para el contacto?')) return
    try {
      const userId = await getUserIdOrThrow()
      await supabase
        .from('contact_sequences')
        .update({ status: 'cancelled' })
        .eq('id', csId)
        .eq('user_id', userId)
      await loadActiveSequencesForContacts()
      setSequenceDetailContactId(null)
    } catch {
      setContactsError('Error al cancelar secuencia.')
    }
  }

  function resetImport() {
    setCsvName(null)
    setCsvParsed(null)
    setCsvError(null)
    setCsvMapping({})
    setImporting(false)
  }

  function openImport() {
    resetImport()
    setImportOpen(true)
  }

  function closeImport() {
    setImportOpen(false)
  }

  function openAdd() {
    setManualError(null)
    setManualNombre('')
    setManualTelefono('')
    setManualDireccion('')
    setManualCiudad('')
    setManualZipcode('')
    setManualPais('US')
    setAddOpen(true)
  }

  function closeAdd() {
    setAddOpen(false)
  }

  function openEdit(contact: ContactRow) {
    setEditContact(contact)
    setEditNombre(contact.nombre ?? '')
    setEditTelefono(contact.telefono ?? '')
    setEditDireccion(contact.direccion ?? '')
    setEditCiudad(contact.ciudad ?? '')
    setEditZipcode(contact.zipcode ?? '')
    setEditPais(contact.pais ?? 'US')
    setEditCampaignId(contact.campaign_id ?? manualCampaignId)
    setEditEmail(contact.email ?? '')
    setEditStatus(contact.status ?? 'draft')
    setEditDisposition(contact.disposition ?? '')
    setEditIntentoActual(contact.intento_actual ?? 0)
    setEditProximaLlamada(isoToDatetimeLocal(contact.proxima_llamada))
    setEditCallbackHora(isoToDatetimeLocal(contact.callback_hora))
    setEditNotas(contact.notas ?? '')
    setEditCreatedAt(contact.created_at ?? '')
    setPrefixSuggestion(null)
    setEditError(null)
    setEditOpen(true)
  }

  function closeEdit() {
    setEditOpen(false)
    setEditContact(null)
    setEditError(null)
    setEditSaving(false)
  }

  async function handleCsvFile(file: File) {
    setCsvError(null)
    setCsvName(file.name)
    const ext = file.name.split('.').pop()?.toLowerCase()
    const parsed =
      ext === 'xlsx' || ext === 'xls'
        ? parseExcel(await file.arrayBuffer())
        : parseCsv(await file.text())
    if (parsed.headers.length === 0) {
      setCsvError('El archivo está vacío o no tiene encabezados.')
      setCsvParsed(null)
      return
    }
    setCsvParsed(parsed)

    // Autoselección simple por nombres comunes
    const headerLc = parsed.headers.map((h) => ({ h, lc: h.toLowerCase() }))
    const pick = (candidates: string[]) =>
      headerLc.find((x) => candidates.some((c) => x.lc.includes(c)))?.h

    setCsvMapping({
      nombre: pick(['name', 'nombre', 'full name', 'contacto']),
      telefono: pick(['phone', 'telefono', 'teléfono', 'mobile', 'celular']),
      pais: pick(['pais', 'país', 'country', 'codigo_pais']),
      zipcode: pick(['zip', 'zipcode', 'postal', 'cp', 'código postal']),
      direccion: pick(['address', 'direccion', 'dirección', 'street']),
      ciudad: pick(['city', 'ciudad', 'town']),
    })
  }

  async function onImportContacts() {
    setCsvError(null)
    if (!csvParsed) {
      setCsvError('Primero carga un archivo (CSV o Excel).')
      return
    }
    if (!importCampaignId) {
      setCsvError('Selecciona la campaña.')
      return
    }
    if (!csvMapping.telefono) {
      setCsvError('Mapea al menos la columna de teléfono.')
      return
    }

    setImporting(true)
    try {
      const userId = await getUserIdOrThrow()
      const rows = csvParsed.rows

      const mapped = rows
        .map((r) => {
          const telefono = (r[csvMapping.telefono!] ?? '').trim()
          const nombre = csvMapping.nombre ? (r[csvMapping.nombre] ?? '').trim() : ''
          const paisRaw = csvMapping.pais ? (r[csvMapping.pais] ?? '').trim() : ''
          const pais = (paisRaw.toUpperCase() || 'US')
          const zipcode = csvMapping.zipcode ? (r[csvMapping.zipcode] ?? '').trim() : ''
          const direccion = csvMapping.direccion
            ? (r[csvMapping.direccion] ?? '').trim()
            : ''
          const ciudad = csvMapping.ciudad ? (r[csvMapping.ciudad] ?? '').trim() : ''

          return {
            user_id: userId,
            campaign_id: importCampaignId,
            nombre: nombre || null,
            telefono: telefono || null,
            pais: pais || 'US',
            zipcode: zipcode || null,
            direccion: direccion || null,
            ciudad: ciudad || null,
            status: importStatus,
            intento_actual: 0,
            proxima_llamada: null,
          }
        })
        .filter((r) => r.telefono)

      if (mapped.length === 0) {
        setCsvError('No se encontraron teléfonos válidos para importar.')
        return
      }

      for (const part of chunk(mapped, 500)) {
        const { error } = await supabase.from('contacts').insert(part)
        if (error) throw new Error(error.message)
      }

      closeImport()
      await loadContacts(campaignId)
    } catch (e) {
      setCsvError(e instanceof Error ? e.message : 'Error al importar contactos.')
    } finally {
      setImporting(false)
    }
  }

  async function onAddContact() {
    setManualError(null)
    if (!manualTelefono.trim()) {
      setManualError('El teléfono es obligatorio.')
      return
    }
    if (!manualCampaignId) {
      setManualError('Selecciona la campaña.')
      return
    }

    setManualSaving(true)
    try {
      const userId = await getUserIdOrThrow()
      const payload = {
        user_id: userId,
        campaign_id: manualCampaignId,
        nombre: manualNombre.trim() || null,
        telefono: manualTelefono.trim(),
        pais: manualPais || 'US',
        direccion: manualDireccion.trim() || null,
        ciudad: manualCiudad.trim() || null,
        zipcode: manualZipcode.trim() || null,
        status: 'draft',
        intento_actual: 0,
        proxima_llamada: null,
      }

      const { error } = await supabase.from('contacts').insert(payload)
      if (error) throw new Error(error.message)

      closeAdd()
      await loadContacts(campaignId)
    } catch (e) {
      setManualError(e instanceof Error ? e.message : 'Error al agregar contacto.')
    } finally {
      setManualSaving(false)
    }
  }

  async function onSaveEditContact() {
    setEditError(null)
    if (!editContact) return
    if (!editTelefono.trim()) {
      setEditError('El teléfono es obligatorio.')
      return
    }
    if (!isValidPhone(editTelefono.trim())) {
      setEditError('Formato de teléfono inválido. Usa 10 a 15 dígitos (opcional +).')
      return
    }
    if (!editCampaignId) {
      setEditError('Selecciona la campaña.')
      return
    }
    setEditSaving(true)
    try {
      const userId = await getUserIdOrThrow()
      const { error } = await supabase
        .from('contacts')
        .update({
          nombre: editNombre.trim() || null,
          telefono: editTelefono.trim(),
          email: editEmail.trim() || null,
          status: editStatus,
          pais: editPais || 'US',
          direccion: editDireccion.trim() || null,
          ciudad: editCiudad.trim() || null,
          zipcode: editZipcode.trim() || null,
          intento_actual: editIntentoActual,
          proxima_llamada: datetimeLocalToIso(editProximaLlamada),
          callback_hora: datetimeLocalToIso(editCallbackHora),
          notas: editNotas.trim() || null,
          campaign_id: editCampaignId,
        })
        .eq('id', editContact.id)
        .eq('user_id', userId)
      if (error) throw new Error(error.message)
      closeEdit()
      await loadContacts(campaignId)
      setToast({ type: 'success', message: 'Contacto actualizado correctamente' })
      window.setTimeout(() => setToast(null), 3000)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al editar contacto.'
      setEditError(msg)
      setToast({ type: 'error', message: msg })
      window.setTimeout(() => setToast(null), 3000)
    } finally {
      setEditSaving(false)
    }
  }

  const totalToImport = csvParsed?.rows.length ?? 0

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      if (statusFilter !== 'all' && (c.status ?? 'draft') !== statusFilter) {
        return false
      }
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const nombre = (c.nombre ?? '').toLowerCase()
      const tel = (c.telefono ?? '').toLowerCase()
      return nombre.includes(q) || tel.includes(q)
    })
  }, [contacts, statusFilter, searchQuery])

  const googleSheetsTemplateUrl =
    (import.meta.env.VITE_GOOGLE_SHEETS_TEMPLATE_URL as string | undefined) ??
    'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/copy'

  function downloadTemplateExcel() {
    const headers = ['nombre', 'telefono', 'pais', 'direccion', 'ciudad', 'zipcode']
    const demo = [
      ['Juan Pérez', '+13055551234', 'US', '123 Main St', 'Miami', '33101'],
      ['María García', '+17865552345', 'US', '456 Oak Ave', 'Orlando', '32801'],
      ['Carlos Rodríguez', '+17865553456', 'MX', '789 Pine Rd', 'Tampa', '33601'],
      ['Ana Martínez', '+13055554567', 'CO', '321 Elm St', 'Hialeah', '33010'],
      ['Luis González', '+17865555678', 'AR', '654 Maple Ave', 'Jacksonville', '32201'],
    ]

    const ws = XLSX.utils.aoa_to_sheet([headers, ...demo])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Contactos')

    // Headers en negrita (nota: el soporte de estilos puede variar según viewer)
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c })
      const cell = ws[addr]
      if (cell) (cell as any).s = { font: { bold: true } }
    }

    // Auto-ancho simple por longitud máxima
    const cols = headers.map((h, idx) => {
      let maxLen = h.length
      for (const row of demo) maxLen = Math.max(maxLen, String(row[idx] ?? '').length)
      return { wch: Math.min(60, Math.max(10, maxLen + 2)) }
    })
    ;(ws as any)['!cols'] = cols

    XLSX.writeFile(wb, 'krone-plantilla-contactos.xlsx')
  }

  return (
    <section className="space-y-6">
      {toast ? (
        <div
          className={[
            'fixed right-4 top-4 z-[70] rounded-lg border px-4 py-2 text-sm shadow-xl',
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

      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">
            Contactos
          </h1>
          <p className="mt-1 text-sm theme-text-muted">
            Importa, filtra por campaña y gestiona tus contactos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button
            type="button"
            onClick={openImport}
            className="inline-flex items-center gap-2 rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
          >
            <Upload className="h-4 w-4" />
            Importar CSV
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-zinc-100 ring-1 ring-[#22c55e]/40 hover:bg-zinc-900/40 transition"
          >
            <UserPlus className="h-4 w-4 text-[#22c55e]" />
            Agregar Contacto
          </button>
        </div>
      </div>

      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold theme-text-primary">
              Filtros de contactos
            </div>
            <p className="text-xs theme-text-dim">
              Filtra por campaña, estado y busca por nombre o teléfono.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              disabled={loadingCampaigns}
              className="w-full sm:w-56 rounded-lg theme-bg-base px-3 py-2 text-xs text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] disabled:opacity-60"
            >
              <option value="all">Todas las campañas</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-40 rounded-lg theme-bg-base px-3 py-2 text-xs text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              <option value="all">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="pending">Pendiente</option>
              <option value="calling">Llamando</option>
              <option value="completed">Completado</option>
              <option value="appointed">Cita agendada</option>
              <option value="callback">Callback</option>
              <option value="voicemail">Buzón</option>
              <option value="no_answer">Sin respuesta</option>
            </select>

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="w-full sm:w-56 rounded-lg theme-bg-base px-3 py-2 text-xs text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
        </div>

        {campaignsError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {campaignsError}
          </div>
        ) : null}

        {contactsError ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {contactsError}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 text-xs theme-text-dim">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-zinc-600 theme-bg-base text-[#22c55e]"
              checked={
                filteredContacts.length > 0 &&
                filteredContacts.every((c) => selectedIds.has(c.id))
              }
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds(new Set(filteredContacts.map((c) => c.id)))
                } else {
                  setSelectedIds(new Set())
                }
              }}
            />
            <span>Seleccionar todos</span>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              disabled={selectedIds.size === 0}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/10 disabled:opacity-40"
              onClick={async () => {
                if (selectedIds.size === 0) return
                try {
                  const userId = await getUserIdOrThrow()
                  const ids = Array.from(selectedIds)
                  const { error } = await supabase
                    .from('contacts')
                    .update({ status: 'pending' })
                    .eq('user_id', userId)
                    .in('id', ids)
                  if (error) throw new Error(error.message)
                  setContacts((prev) =>
                    prev.map((c) =>
                      selectedIds.has(c.id) ? { ...c, status: 'pending' } : c,
                    ),
                  )
                } catch (e) {
                  setContactsError(
                    e instanceof Error
                      ? e.message
                      : 'Error al activar contactos seleccionados.',
                  )
                }
              }}
            >
              Activar seleccionados
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/10 disabled:opacity-40"
              onClick={async () => {
                if (selectedIds.size === 0) return
                try {
                  const userId = await getUserIdOrThrow()
                  const ids = Array.from(selectedIds)
                  const { error } = await supabase
                    .from('contacts')
                    .update({ status: 'draft' })
                    .eq('user_id', userId)
                    .in('id', ids)
                  if (error) throw new Error(error.message)
                  setContacts((prev) =>
                    prev.map((c) =>
                      selectedIds.has(c.id) ? { ...c, status: 'draft' } : c,
                    ),
                  )
                } catch (e) {
                  setContactsError(
                    e instanceof Error
                      ? e.message
                      : 'Error al pausar contactos seleccionados.',
                  )
                }
              }}
            >
              Pausar seleccionados
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-200 ring-1 ring-red-500/40 hover:bg-red-500/10 disabled:opacity-40"
              onClick={async () => {
                if (selectedIds.size === 0) return
                try {
                  const userId = await getUserIdOrThrow()
                  const ids = Array.from(selectedIds)
                  const { error } = await supabase
                    .from('contacts')
                    .delete()
                    .eq('user_id', userId)
                    .in('id', ids)
                  if (error) throw new Error(error.message)
                  setContacts((prev) => prev.filter((c) => !selectedIds.has(c.id)))
                  setSelectedIds(new Set())
                } catch (e) {
                  setContactsError(
                    e instanceof Error
                      ? e.message
                      : 'Error al eliminar contactos seleccionados.',
                  )
                }
              }}
            >
              Eliminar seleccionados
            </button>
          </div>
        </div>

        <div className="w-full overflow-x-auto mt-3">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide theme-text-muted">
              <tr className="border-b theme-border/80">
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">Seleccionar</span>
                </th>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">País</th>
                <th className="px-4 py-3 font-medium">ZIP Code</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Intentos</th>
                <th className="px-4 py-3 font-medium">Próxima Llamada</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loadingContacts ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center theme-text-muted">
                    Cargando contactos...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center theme-text-muted">
                    No hay contactos para mostrar.
                  </td>
                </tr>
              ) : (
                filteredContacts.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b theme-border/80 last:border-b-0 hover:bg-zinc-900/30 transition"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-zinc-600 theme-bg-base text-[#22c55e]"
                        checked={selectedIds.has(c.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(c.id)
                            else next.delete(c.id)
                            return next
                          })
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-100">{c.nombre ?? '—'}</span>
                        {activeSequenceByContactId[c.id] ? (
                          <button
                            type="button"
                            onClick={() => setSequenceDetailContactId(c.id)}
                            className="inline-flex items-center rounded-full bg-[#22c55e]/20 px-2 py-0.5 text-xs font-medium text-[#22c55e] ring-1 ring-[#22c55e]/40 hover:bg-[#22c55e]/30"
                            title="Ver secuencia activa"
                          >
                            🔁
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 theme-text-secondary">
                      {c.telefono ?? '—'}
                    </td>
                    <td className="px-4 py-3 theme-text-secondary">
                      {c.pais ?? 'US'}
                    </td>
                    <td className="px-4 py-3 theme-text-secondary">
                      {c.zipcode ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={c.status ?? 'pending'} />
                    </td>
                    <td className="px-4 py-3 theme-text-secondary">
                      {c.intento_actual ?? 0}
                    </td>
                    <td className="px-4 py-3 theme-text-secondary">
                      {c.proxima_llamada ? c.proxima_llamada : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {c.status === 'draft' && (
                          <button
                            type="button"
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/40 hover:bg-emerald-500/10 transition"
                            onClick={async () => {
                              try {
                                const userId = await getUserIdOrThrow()
                                const { error } = await supabase
                                  .from('contacts')
                                  .update({ status: 'pending' })
                                  .eq('user_id', userId)
                                  .eq('id', c.id)
                                if (error) throw new Error(error.message)
                                setContacts((prev) =>
                                  prev.map((row) =>
                                    row.id === c.id ? { ...row, status: 'pending' } : row,
                                  ),
                                )
                              } catch (e) {
                                setContactsError(
                                  e instanceof Error
                                    ? e.message
                                    : 'Error al activar el contacto.',
                                )
                              }
                            }}
                          >
                            Activar
                          </button>
                        )}
                        {c.status === 'pending' && (
                          <button
                            type="button"
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/10 transition"
                            onClick={async () => {
                              try {
                                const userId = await getUserIdOrThrow()
                                const { error } = await supabase
                                  .from('contacts')
                                  .update({ status: 'draft' })
                                  .eq('user_id', userId)
                                  .eq('id', c.id)
                                if (error) throw new Error(error.message)
                                setContacts((prev) =>
                                  prev.map((row) =>
                                    row.id === c.id ? { ...row, status: 'draft' } : row,
                                  ),
                                )
                              } catch (e) {
                                setContactsError(
                                  e instanceof Error
                                    ? e.message
                                    : 'Error al pausar el contacto.',
                                )
                              }
                            }}
                          >
                            Pausar
                          </button>
                        )}
                        <button
                          type="button"
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold theme-text-secondary ring-1 ring-[#22c55e]/40 hover:bg-[#22c55e]/10 transition"
                          onClick={() => openAssignSequence(c)}
                        >
                          Asignar Estrategia
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold theme-text-secondary ring-1 ring-zinc-700/80 hover:bg-zinc-800/30 transition"
                          onClick={() => openEdit(c)}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-200 ring-1 ring-red-500/30 hover:bg-red-500/10 transition"
                          onClick={async () => {
                            try {
                              await getUserIdOrThrow()
                              const { error } = await supabase
                                .from('contacts')
                                .delete()
                                .eq('id', c.id)
                              if (error) throw new Error(error.message)
                              await loadContacts(campaignId)
                            } catch (e) {
                              setContactsError(
                                e instanceof Error
                                  ? e.message
                                  : 'Error al eliminar el contacto.',
                              )
                            }
                          }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Importar CSV */}
      {importOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <button
            type="button"
            onClick={closeImport}
            className="absolute inset-0 bg-black/70"
            aria-label="Cerrar modal"
          />

          <div className="relative w-full max-w-4xl rounded-2xl border theme-border/80 theme-bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b theme-border/80 px-5 py-4">
              <div>
                <div className="text-base font-semibold theme-text-primary">
                  Importar CSV
                </div>
                <div className="mt-1 text-sm theme-text-muted">
                  Sube un archivo, revisa el preview y mapea columnas.
                </div>
              </div>
              <button
                type="button"
                onClick={closeImport}
                className="rounded-lg p-2 theme-text-muted hover:bg-zinc-900/40 hover:theme-text-primary transition"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="text-sm font-semibold theme-text-primary">Archivo</div>

                  <div className="rounded-2xl border border-[#22c55e]/25 theme-bg-base p-4">
                    <div className="text-sm font-semibold theme-text-primary">
                      💡 ¿Primera vez importando?
                    </div>
                    <div className="mt-1 text-sm theme-text-muted">
                      Descarga nuestro archivo de ejemplo para ver el formato
                      correcto.
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={downloadTemplateExcel}
                        className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-zinc-100 ring-1 ring-[#22c55e]/50 hover:bg-zinc-900/40 transition"
                      >
                        ⬇ Descargar plantilla Excel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            googleSheetsTemplateUrl,
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                        className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-zinc-100 ring-1 ring-zinc-800/80 hover:bg-zinc-900/40 transition"
                      >
                        📋 Abrir plantilla Google Sheets
                      </button>
                    </div>
                  </div>

                  <div
                    className="rounded-2xl border border-dashed border-zinc-700/80 theme-bg-base p-5 text-sm theme-text-muted"
                    onDragOver={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const file = e.dataTransfer.files?.[0]
                      if (file) void handleCsvFile(file)
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="theme-text-primary font-medium">
                          Drag & drop tu archivo aquí
                        </div>
                        <div className="mt-1 text-xs theme-text-dim">
                          Acepta CSV y Excel (.xlsx/.xls). Si usas Google Sheets,
                          exporta/descarga como CSV o Excel y súbelo aquí.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
                      >
                        Seleccionar
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,text/csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void handleCsvFile(file)
                        }}
                      />
                    </div>

                    {csvName ? (
                      <div className="mt-3 text-xs theme-text-muted">
                        Archivo: <span className="theme-text-secondary">{csvName}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-semibold theme-text-primary">
                      Asignar a campaña
                    </div>
                    <select
                      value={importCampaignId}
                      onChange={(e) => setImportCampaignId(e.target.value)}
                      className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    >
                      <option value="" disabled>
                        Selecciona una campaña...
                      </option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-semibold theme-text-primary">
                    Mapeo de columnas
                  </div>

                  {csvParsed ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(
                        [
                          ['nombre', 'nombre'],
                          ['telefono', 'telefono'],
                          ['pais', 'pais'],
                          ['zipcode', 'zipcode'],
                          ['direccion', 'direccion'],
                          ['ciudad', 'ciudad'],
                        ] as const
                      ).map(([key, label]) => (
                        <div key={key} className="space-y-2">
                          <div className="text-sm theme-text-muted">
                            {label}
                            {key === 'telefono' ? (
                              <span className="text-red-300"> *</span>
                            ) : null}
                          </div>
                          <select
                            value={csvMapping[key] ?? ''}
                            onChange={(e) =>
                              setCsvMapping((m) => ({
                                ...m,
                                [key]: e.target.value || undefined,
                              }))
                            }
                            className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                          >
                            <option value="">(sin mapear)</option>
                            {csvParsed.headers.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border theme-border/80 theme-bg-base px-4 py-4 text-sm theme-text-muted">
                      Sube un CSV para habilitar el mapeo.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold theme-text-primary">Preview</div>
                  <div className="text-xs theme-text-dim">
                    Mostrando primeras 5 filas
                  </div>
                </div>

                <div className="rounded-2xl border theme-border/80 theme-bg-base overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide theme-text-muted">
                      <tr className="border-b theme-border/80">
                        {(csvParsed?.headers ?? []).slice(0, 8).map((h) => (
                          <th key={h} className="px-4 py-3 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={Math.max(1, (csvParsed?.headers ?? []).length)}
                            className="px-4 py-6 text-center theme-text-dim"
                          >
                            No hay datos para mostrar.
                          </td>
                        </tr>
                      ) : (
                        previewRows.map((r, idx) => (
                          <tr
                            key={idx}
                            className="border-b theme-border/80 last:border-b-0"
                          >
                            {(csvParsed?.headers ?? []).slice(0, 8).map((h) => (
                              <td key={h} className="px-4 py-3 theme-text-secondary">
                                {r[h] || '—'}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {csvError ? (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {csvError}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t theme-border/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={closeImport}
                className="rounded-lg px-3 py-2 text-sm font-medium theme-text-secondary ring-1 ring-zinc-800/80 hover:bg-zinc-900/40 transition"
              >
                Cancelar
              </button>

              <div className="flex flex-col items-start gap-2 sm:items-end">
                <div className="text-xs theme-text-muted">
                  Vas a importar {totalToImport} contactos a la campaña seleccionada.
                  ¿En qué estado deseas importarlos?
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setImportStatus('draft')}
                    className={
                      'rounded-full px-3 py-1 font-medium ' +
                      (importStatus === 'draft'
                        ? 'bg-zinc-200 text-[#0b0b0b]'
                        : 'theme-bg-base theme-text-muted ring-1 ring-zinc-700/80')
                    }
                  >
                    Borrador (recomendado)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportStatus('pending')}
                    className={
                      'rounded-full px-3 py-1 font-medium ' +
                      (importStatus === 'pending'
                        ? 'bg-zinc-200 text-[#0b0b0b]'
                        : 'theme-bg-base theme-text-muted ring-1 ring-zinc-700/80')
                    }
                  >
                    Activar inmediatamente
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onImportContacts}
                disabled={!canImport || importing}
                className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {importing
                  ? 'Importando...'
                  : `Importar ${canImport ? totalToImport : 0} contactos`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Agregar Contacto */}
      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <button
            type="button"
            onClick={closeAdd}
            className="absolute inset-0 bg-black/70"
            aria-label="Cerrar modal"
          />

          <div className="relative w-full max-w-4xl rounded-2xl border theme-border/80 theme-bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b theme-border/80 px-5 py-4">
              <div>
                <div className="text-base font-semibold theme-text-primary">
                  Agregar Contacto
                </div>
                <div className="mt-1 text-sm theme-text-muted">
                  Crea un contacto manualmente.
                </div>
              </div>
              <button
                type="button"
                onClick={closeAdd}
                className="rounded-lg p-2 theme-text-muted hover:bg-zinc-900/40 hover:theme-text-primary transition"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="mNombre">
                    nombre
                  </label>
                  <input
                    id="mNombre"
                    value={manualNombre}
                    onChange={(e) => setManualNombre(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    placeholder="Juan Pérez"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="mTelefono">
                    telefono <span className="text-red-300">*</span>
                  </label>
                  <input
                    id="mTelefono"
                    value={manualTelefono}
                    onChange={(e) => setManualTelefono(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    placeholder="+1 555 123 4567"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="mDireccion">
                    direccion
                  </label>
                  <input
                    id="mDireccion"
                    value={manualDireccion}
                    onChange={(e) => setManualDireccion(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    placeholder="Calle 123 #45"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="mCiudad">
                    ciudad
                  </label>
                  <input
                    id="mCiudad"
                    value={manualCiudad}
                    onChange={(e) => setManualCiudad(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    placeholder="Monterrey"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="mZip">
                    zipcode
                  </label>
                  <input
                    id="mZip"
                    value={manualZipcode}
                    onChange={(e) => setManualZipcode(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    placeholder="64000"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="mPais">
                    país
                  </label>
                  <select
                    id="mPais"
                    value={manualPais}
                    onChange={(e) => setManualPais(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  >
                    {countryRates.length === 0 ? <option value="US">🇺🇸 Estados Unidos (+1)</option> : null}
                    {countryRates.map((p) => (
                      <option key={p.codigo_pais} value={p.codigo_pais}>
                        {p.bandera ?? '🌐'} {p.nombre_pais} ({p.prefijo ?? ''})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="text-sm theme-text-muted">campaña</div>
                  <select
                    value={manualCampaignId}
                    onChange={(e) => setManualCampaignId(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  >
                    <option value="" disabled>
                      Selecciona una campaña...
                    </option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {manualError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {manualError}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t theme-border/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={closeAdd}
                className="rounded-lg px-3 py-2 text-sm font-medium theme-text-secondary ring-1 ring-zinc-800/80 hover:bg-zinc-900/40 transition"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={onAddContact}
                disabled={manualSaving}
                className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {manualSaving ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Editar Contacto */}
      {editOpen && editContact ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <button
            type="button"
            onClick={closeEdit}
            className="absolute inset-0 bg-black/70"
            aria-label="Cerrar modal"
          />
          <div className="relative w-full max-w-2xl rounded-2xl border theme-border/80 theme-bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b theme-border/80 px-5 py-4">
              <div>
                <div className="text-base font-semibold theme-text-primary">Editar Contacto</div>
              </div>
              <button type="button" onClick={closeEdit} className="rounded-lg p-2 theme-text-muted hover:bg-zinc-900/40 hover:theme-text-primary transition" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto px-5 py-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eNombre">nombre</label>
                  <input id="eNombre" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eTelefono">telefono <span className="text-red-300">*</span></label>
                  <input id="eTelefono" value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eEmail">email (opcional)</label>
                  <input id="eEmail" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eStatus">status</label>
                  <select id="eStatus" value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]">
                    <option value="draft">draft</option>
                    <option value="pending">pending</option>
                    <option value="calling">calling</option>
                    <option value="completed">completed</option>
                    <option value="no_answer">no_answer</option>
                    <option value="voicemail">voicemail</option>
                    <option value="callback">callback</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="ePais">país</label>
                  <select id="ePais" value={editPais} onChange={(e) => {
                    const nextPais = e.target.value
                    setEditPais(nextPais)
                    const selected = countryRates.find((p) => p.codigo_pais === nextPais)
                    const prefix = selected?.prefijo ?? ''
                    const phone = editTelefono.trim()
                    if (prefix && phone && !phone.startsWith(prefix)) {
                      setPrefixSuggestion(`Sugerencia: actualizar teléfono con prefijo ${prefix}`)
                    } else {
                      setPrefixSuggestion(null)
                    }
                  }} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]">
                    {countryRates.length === 0 ? <option value="US">🇺🇸 Estados Unidos (+1)</option> : null}
                    {countryRates.map((p) => (
                      <option key={p.codigo_pais} value={p.codigo_pais}>
                        {p.bandera ?? '🌐'} {p.nombre_pais} ({p.prefijo ?? ''})
                      </option>
                    ))}
                  </select>
                  {prefixSuggestion ? (
                    <p className="text-xs text-amber-300">{prefixSuggestion}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eCamp">campaña</label>
                  <select id="eCamp" value={editCampaignId} onChange={(e) => setEditCampaignId(e.target.value)} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]">
                    <option value="" disabled>Selecciona una campaña...</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eDireccion">direccion</label>
                  <input id="eDireccion" value={editDireccion} onChange={(e) => setEditDireccion(e.target.value)} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eCiudad">ciudad</label>
                  <input id="eCiudad" value={editCiudad} onChange={(e) => setEditCiudad(e.target.value)} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eIntentoActual">intento_actual</label>
                  <input id="eIntentoActual" type="number" min={0} value={editIntentoActual} onChange={(e) => setEditIntentoActual(Math.max(0, Number(e.target.value) || 0))} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eZip">zipcode</label>
                  <input id="eZip" value={editZipcode} onChange={(e) => setEditZipcode(e.target.value)} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eProximaLlamada">proxima_llamada</label>
                  <input id="eProximaLlamada" type="datetime-local" value={editProximaLlamada} onChange={(e) => setEditProximaLlamada(e.target.value)} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eCallbackHora">callback_hora (opcional)</label>
                  <input id="eCallbackHora" type="datetime-local" value={editCallbackHora} onChange={(e) => setEditCallbackHora(e.target.value)} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eDisposition">disposition (readonly)</label>
                  <input id="eDisposition" value={editDisposition} readOnly className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-muted ring-1 ring-zinc-800/80" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eCreatedAt">created_at (readonly)</label>
                  <input
                    id="eCreatedAt"
                    value={editCreatedAt ? new Date(editCreatedAt).toLocaleString('es') : ''}
                    readOnly
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-muted ring-1 ring-zinc-800/80"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm theme-text-muted" htmlFor="eNotas">notas (opcional)</label>
                  <textarea id="eNotas" rows={3} value={editNotas} onChange={(e) => setEditNotas(e.target.value)} className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none" />
                </div>
              </div>
              {editError ? (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{editError}</div>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t theme-border/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={closeEdit} className="rounded-lg px-3 py-2 text-sm font-medium theme-text-secondary ring-1 ring-zinc-800/80 hover:bg-zinc-900/40 transition">Cancelar</button>
              <button type="button" onClick={onSaveEditContact} disabled={editSaving} className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 disabled:cursor-not-allowed transition">
                {editSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Modal Asignar Estrategia */}
      {sequenceAssignOpen && sequenceAssignContact ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <button type="button" onClick={closeAssignSequence} className="absolute inset-0 bg-black/70" aria-label="Cerrar" />
          <div className="relative w-full max-w-md rounded-2xl border theme-border/80 theme-bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b theme-border/80 px-5 py-4">
              <div>
                <div className="text-base font-semibold theme-text-primary">Asignar Estrategia</div>
                <div className="mt-1 text-sm theme-text-muted">Contacto: {sequenceAssignContact.nombre ?? '—'}</div>
              </div>
              <button type="button" onClick={closeAssignSequence} className="rounded-lg p-2 theme-text-muted hover:bg-zinc-900/40" aria-label="Cerrar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium theme-text-primary">Estrategia</label>
                <select
                  value={assignSequenceId}
                  onChange={(e) => setAssignSequenceId(e.target.value)}
                  className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-primary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                >
                  <option value="">Selecciona una estrategia...</option>
                  {CATEGORY_ORDER.map((catKey) => {
                    const cat = SEQUENCE_CATEGORIES[catKey] ?? SEQUENCE_CATEGORIES.general
                    const inCat = sequencesList.filter((s) => sequenceCategoryKey(s.nicho) === catKey)
                    if (inCat.length === 0) return null
                    return (
                      <optgroup key={catKey} label={`${cat.emoji} ${cat.label} (${inCat.length})`}>
                        {inCat.map((s) => {
                          const canUse = canUseSequence(s, assignUserPlan)
                          return (
                            <option key={s.id} value={s.id} disabled={!canUse}>
                              {canUse ? s.nombre : `🔒 ${s.nombre}`}
                            </option>
                          )
                        })}
                      </optgroup>
                    )
                  })}
                </select>
              </div>
              {assignSequenceId && assignStepsPreview.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium theme-text-primary">Preview de pasos</label>
                  <div className="rounded-xl border theme-border/80 theme-bg-base p-3 space-y-2 max-h-40 overflow-y-auto">
                    {assignStepsPreview.map((s, i) => (
                      <div key={i} className="flex gap-2 text-xs">
                        <span className="theme-text-muted shrink-0">Día {s.dia}</span>
                        <span>{s.canal === 'call' ? '📞' : '💬'}</span>
                        <span className="theme-text-secondary truncate">{s.mensaje ? `${s.mensaje.slice(0, 60)}${s.mensaje.length > 60 ? '…' : ''}` : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {assignSequenceId && sequenceStepsUseVariable(assignStepsPreview, '{google_review_link}') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium theme-text-primary">Link de Google Review *</label>
                  <input
                    type="url"
                    value={assignGoogleReviewLink}
                    onChange={(e) => setAssignGoogleReviewLink(e.target.value)}
                    placeholder="https://g.page/r/tu-negocio/review"
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-primary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
              )}
              {assignSequenceId && sequenceStepsUseVariable(assignStepsPreview, '{hora}') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium theme-text-primary">Hora de cita</label>
                  <input
                    type="time"
                    value={assignHora}
                    onChange={(e) => setAssignHora(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-primary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
              )}
              {assignSequenceId && sequenceStepsUseVariable(assignStepsPreview, '{referido}') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium theme-text-primary">Referido</label>
                  <input
                    type="text"
                    value={assignReferido}
                    onChange={(e) => setAssignReferido(e.target.value)}
                    placeholder="Nombre del referido"
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-primary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium theme-text-primary">Fecha de inicio</label>
                <input
                  type="date"
                  value={assignStartDate}
                  onChange={(e) => setAssignStartDate(e.target.value)}
                  className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-primary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                />
              </div>
              {sequenceAssignContact.zipcode && assignSequenceId && sequencesList.find((s) => s.id === assignSequenceId)?.nicho === 'agua' ? (
                <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-2 text-sm text-[#22c55e]">
                  ⚡ EWG activo: los contaminantes se cargarán automáticamente vía n8n.
                </div>
              ) : null}
              {assignError ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{assignError}</div>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t theme-border/80 px-5 py-4">
              <button type="button" onClick={closeAssignSequence} className="rounded-lg px-4 py-2 text-sm font-medium theme-text-muted hover:theme-text-primary transition">Cancelar</button>
              <button
                type="button"
                onClick={onActivateSequence}
                disabled={assignSaving || !assignSequenceId}
                className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition"
              >
                {assignSaving ? 'Activando...' : 'Activar Secuencia'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Panel lateral: detalle de secuencia activa */}
      {sequenceDetailContactId && (() => {
        const contact = filteredContacts.find((c) => c.id === sequenceDetailContactId)
        const info = sequenceDetailContactId ? activeSequenceByContactId[sequenceDetailContactId] : null
        if (!contact || !info) return null
        const totalSteps = info.steps.length
        return (
          <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
            <button
              type="button"
              onClick={() => setSequenceDetailContactId(null)}
              className="absolute inset-0 bg-black/50"
              aria-label="Cerrar"
            />
            <div className="relative w-full max-w-md theme-bg-card border-l theme-border shadow-xl overflow-y-auto flex flex-col">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b theme-border px-4 py-4 theme-bg-card">
                <div>
                  <div className="font-semibold theme-text-primary">Secuencia activa</div>
                  <div className="text-sm theme-text-muted">{contact.nombre ?? '—'} · {info.sequence_name}</div>
                </div>
                <button type="button" onClick={() => setSequenceDetailContactId(null)} className="rounded-lg p-2 theme-text-muted hover:bg-zinc-900/40" aria-label="Cerrar">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-4 py-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => pauseContactSequence(info.contact_sequence_id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/10"
                  >
                    Pausar
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelContactSequence(info.contact_sequence_id)}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-200 ring-1 ring-red-500/40 hover:bg-red-500/10"
                  >
                    Cancelar
                  </button>
                </div>
                <div className="text-xs theme-text-muted">
                  Paso actual: {info.paso_actual + 1} / {totalSteps} · Inicio: {new Date(info.fecha_inicio).toLocaleDateString('es')}
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold theme-text-primary">Timeline</div>
                  <div className="relative border-l-2 border-[#22c55e]/40 pl-4 space-y-4">
                    {info.steps.map((step, idx) => {
                      const isCompleted = idx < info.paso_actual
                      const isCurrent = idx === info.paso_actual
                      const stepDate = new Date(info.fecha_inicio)
                      stepDate.setDate(stepDate.getDate() + step.dia)
                      const [h, m] = (step.hora_envio ?? '09:00').toString().split(':').map(Number)
                      stepDate.setHours(h, m, 0, 0)
                      const preview = resolveMessagePreview(step.mensaje, contact, info.ewg_contaminantes)
                      return (
                        <div key={idx} className="relative">
                          <div className={`absolute -left-[21px] w-3 h-3 rounded-full border-2 ${
                            isCompleted ? 'bg-[#22c55e] border-[#22c55e]' :
                            isCurrent ? 'bg-[#22c55e] border-[#22c55e] animate-pulse' :
                            'bg-transparent border-zinc-600'
                          }`} />
                          <div className="text-xs theme-text-muted">
                            {stepDate.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}
                            {' · '}
                            {step.canal === 'call' ? '📞 Llamada' : '💬 SMS'}
                          </div>
                          <div className="mt-0.5 text-sm theme-text-secondary">
                            {isCompleted ? '✅ Completado' : isCurrent ? '🔄 Actual' : '⏳ Pendiente'}
                          </div>
                          {step.mensaje ? (
                            <div className="mt-1 rounded-lg theme-bg-base px-2 py-1.5 text-xs theme-text-muted border theme-border/80">
                              {preview.slice(0, 200)}{preview.length > 200 ? '…' : ''}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      <UpgradePlanModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        userPlan={assignUserPlan}
      />
    </section>
  )
}

