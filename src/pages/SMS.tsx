import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { getPublicWebhookBaseUrl } from '../lib/getPublicWebhookBaseUrl'
import { SMS_USD_POR_MENSAJE } from '../lib/creditUsd'

type SmsRow = {
  id: string
  destinatario: string
  numero: string
  mensaje: string
  estado: 'enviado' | 'fallido' | 'pendiente' | string
  created_at: string
  respuesta?: boolean
}

type SmsCampaignRow = {
  id: string
  nombre: string
  mensaje: string
  variables_usadas: unknown
  total_contactos: number
  total_enviados: number
  total_respondidos: number
  costo_total_usd: number
  status: string
  programado_para: string | null
  created_at: string
}

type VoiceCampaignOption = { id: string; nombre: string }

type SmsCampaignContactRow = {
  id: string
  nombre: string | null
  telefono: string
  mensaje_personalizado: string | null
  status: string
  enviado_at: string | null
}

type ContactSource = 'csv' | 'campaign' | 'all'

type CsvRow = { nombre: string; telefono: string }

const ESTADO_COLOR: Record<string, string> = {
  enviado: 'bg-[#22c55e]/20 text-[#22c55e]',
  fallido: 'bg-red-500/20 text-red-300',
  pendiente: 'bg-amber-500/20 text-amber-300',
}

const ESTADO_LABEL: Record<string, string> = {
  enviado: 'Enviado',
  fallido: 'Fallido',
  pendiente: 'Pendiente',
}

const SMS_CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  running: 'En curso',
  completed: 'Completada',
  paused: 'Pausada',
}

const SMS_CONTACT_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  sent: 'Enviado',
  failed: 'Fallido',
  replied: 'Respondió',
}

/** Badge de estado de campaña SMS (alineado con estilo Campaigns + colores pedidos). */
function smsCampaignStatusBadgeClass(status: string): string {
  const base =
    'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1'
  const s = (status ?? '').toLowerCase()
  if (s === 'draft') return `${base} bg-zinc-600/30 text-zinc-300 ring-zinc-500/45`
  if (s === 'scheduled') return `${base} bg-sky-500/20 text-sky-300 ring-sky-500/40`
  if (s === 'running')
    return `${base} animate-pulse bg-[#22c55e]/20 text-[#86efac] ring-[#22c55e]/50`
  if (s === 'completed') return `${base} bg-[#22c55e]/25 text-[#22c55e] ring-[#22c55e]/45`
  if (s === 'paused') return `${base} bg-amber-500/20 text-amber-200 ring-amber-500/45`
  return `${base} bg-zinc-600/25 text-zinc-400 ring-zinc-600/40`
}

function smsContactRowBadgeClass(status: string): string {
  const s = (status ?? '').toLowerCase()
  if (s === 'sent') return 'bg-[#22c55e]/15 text-[#22c55e] ring-[#22c55e]/25'
  if (s === 'replied') return 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
  if (s === 'failed') return 'bg-red-500/15 text-red-300 ring-red-500/30'
  return 'bg-zinc-600/20 text-zinc-400 ring-zinc-500/30'
}

const MSG_TRUNCATE = 60
const SMS_MSG_MAX = 160

const VAR_CHIPS: { key: string; label: string }[] = [
  { key: '[nombre]', label: '[nombre]' },
  { key: '[ciudad]', label: '[ciudad]' },
  { key: '[empresa]', label: '[empresa]' },
  { key: '[zipcode]', label: '[zipcode]' },
]

function truncate(str: string, max: number): string {
  if (!str || str.length <= max) return str
  return str.slice(0, max) + '…'
}

function extractVariablesUsadas(text: string): string[] {
  const re = /\[(nombre|ciudad|empresa|zipcode)\]/gi
  const found = new Set<string>()
  let m: RegExpExecArray | null
  const copy = text.slice()
  while ((m = re.exec(copy)) !== null) {
    found.add(`[${m[1].toLowerCase()}]`)
  }
  return [...found]
}

function buildPersonalizedMessage(
  template: string,
  row: {
    nombre?: string | null
    ciudad?: string | null
    zipcode?: string | null
    empresa?: string | null
  },
): string {
  return template
    .replace(/\[nombre\]/gi, (row.nombre ?? '').trim())
    .replace(/\[ciudad\]/gi, (row.ciudad ?? '').trim())
    .replace(/\[zipcode\]/gi, (row.zipcode ?? '').trim())
    .replace(/\[empresa\]/gi, (row.empresa ?? '').trim())
}

function parseCsvPhones(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length === 0) return []
  const first = lines[0]
  const hasHeader = /telefono|phone|tel|número|numero/i.test(first)
  const start = hasHeader ? 1 : 0
  const out: CsvRow[] = []
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ''))
    if (parts.length === 0) continue
    const last = parts[parts.length - 1] ?? ''
    const digits = last.replace(/\D/g, '')
    if (digits.length < 10) continue
    const nombre =
      parts.length > 1
        ? parts.slice(0, -1).filter(Boolean).join(' ').trim() || `Contacto ${i + 1}`
        : `Contacto ${i + 1}`
    out.push({ nombre, telefono: digits })
  }
  return out
}

function parseMatrixToCsvRows(matrix: unknown[][]): CsvRow[] {
  const strRows: string[][] = matrix
    .map((r) =>
      (r ?? []).map((c) => {
        if (c == null || c === '') return ''
        return String(c).trim()
      }),
    )
    .filter((r) => r.some((c) => c !== ''))

  if (strRows.length === 0) return []
  const firstJoined = strRows[0].join(' ')
  const hasHeader = /telefono|teléfono|phone|tel|número|numero|celular|mobile/i.test(firstJoined)
  const start = hasHeader ? 1 : 0
  let phoneCol: number | 'last' = 'last'
  let nombreCol: number | null = null
  if (hasHeader) {
    const header = strRows[0].map((h) => h.toLowerCase())
    const phoneRe = /telefono|teléfono|phone|tel|número|numero|celular|mobile|whatsapp/
    const pIdx = header.findIndex((h) => phoneRe.test(h))
    phoneCol = pIdx >= 0 ? pIdx : Math.max(0, header.length - 1)
    const nIdx = header.findIndex((h) => /^(nombre|name|contacto)$/.test(h))
    nombreCol = nIdx >= 0 ? nIdx : null
  }

  const out: CsvRow[] = []
  for (let i = start; i < strRows.length; i++) {
    const parts = strRows[i]
    if (parts.length === 0) continue
    const phoneRaw =
      phoneCol === 'last' ? (parts[parts.length - 1] ?? '') : (parts[phoneCol] ?? '')
    const digits = phoneRaw.replace(/\D/g, '')
    if (digits.length < 10) continue

    let nombre: string
    if (hasHeader && nombreCol != null && parts[nombreCol]?.trim()) {
      nombre = parts[nombreCol].trim()
    } else if (phoneCol === 'last') {
      nombre =
        parts.length > 1
          ? parts.slice(0, -1).filter(Boolean).join(' ').trim() || `Contacto ${i + 1}`
          : `Contacto ${i + 1}`
    } else {
      const other = parts.filter((_, idx) => idx !== phoneCol && parts[idx])
      nombre = other.join(' ').trim() || `Contacto ${i + 1}`
    }
    out.push({ nombre, telefono: digits })
  }
  return out
}

function parseXlsxPhones(buf: ArrayBuffer): CsvRow[] {
  const wb = XLSX.read(buf, { type: 'array' })
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return []
  const sheet = wb.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][]
  return parseMatrixToCsvRows(matrix)
}

function normalizePhoneDigits(t: string | null | undefined): string {
  return (t ?? '').replace(/\D/g, '')
}

export default function SMS() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'historial' | 'campanas'>('historial')

  const [logs, setLogs] = useState<SmsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalEnviados, setTotalEnviados] = useState(0)
  const [semanaEnviados, setSemanaEnviados] = useState(0)
  const [tasaRespuesta, setTasaRespuesta] = useState<number | null>(null)

  const [smsCampaigns, setSmsCampaigns] = useState<SmsCampaignRow[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(false)
  const [campaignsError, setCampaignsError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [nombreCampana, setNombreCampana] = useState('')
  const [mensajeSms, setMensajeSms] = useState('')
  const mensajeRef = useRef<HTMLTextAreaElement>(null)

  const [contactSource, setContactSource] = useState<ContactSource>('all')
  const [voiceCampaignId, setVoiceCampaignId] = useState('')
  const [voiceCampaigns, setVoiceCampaigns] = useState<VoiceCampaignOption[]>([])

  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvFileName, setCsvFileName] = useState<string | null>(null)

  const [sendMode, setSendMode] = useState<'now' | 'schedule'>('now')
  const [programadoPara, setProgramadoPara] = useState('')

  const [esSeguimiento, setEsSeguimiento] = useState(false)
  const [segDia1, setSegDia1] = useState(1)
  const [segDia2, setSegDia2] = useState(3)
  const [segDia3, setSegDia3] = useState(7)
  const [mensajesDistintos, setMensajesDistintos] = useState(false)
  const [mensajeSeg2, setMensajeSeg2] = useState('')
  const [mensajeSeg3, setMensajeSeg3] = useState('')

  const [saldoUsd, setSaldoUsd] = useState(0)
  const [contactCountEstimate, setContactCountEstimate] = useState(0)
  const [loadingCount, setLoadingCount] = useState(false)

  const [detailCampaign, setDetailCampaign] = useState<SmsCampaignRow | null>(null)
  const [detailContacts, setDetailContacts] = useState<SmsCampaignContactRow[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailFilter, setDetailFilter] = useState<'all' | 'replied'>('all')
  const [detailPauseLoading, setDetailPauseLoading] = useState(false)

  const estimatedCost = useMemo(
    () => Math.round(contactCountEstimate * SMS_USD_POR_MENSAJE * 100) / 100,
    [contactCountEstimate],
  )
  const saldoSuficiente = saldoUsd >= estimatedCost && contactCountEstimate > 0

  const detailStats = useMemo(() => {
    let enviados = 0
    let respondidos = 0
    let fallidos = 0
    for (const r of detailContacts) {
      const st = (r.status ?? '').toLowerCase()
      if (st === 'replied') {
        respondidos += 1
        enviados += 1
      } else if (st === 'sent') {
        enviados += 1
      } else if (st === 'failed') {
        fallidos += 1
      }
    }
    return { enviados, respondidos, fallidos }
  }, [detailContacts])

  const displayedDetailContacts = useMemo(() => {
    if (detailFilter === 'replied') {
      return detailContacts.filter((r) => (r.status ?? '').toLowerCase() === 'replied')
    }
    return detailContacts
  }, [detailContacts, detailFilter])

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

  const loadSms = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError || !session?.user?.id) {
        setLogs([])
        setTotalEnviados(0)
        setSemanaEnviados(0)
        setTasaRespuesta(null)
        return
      }
      const userId = session.user.id

      const { data: rows, error: fetchError } = await supabase
        .from('sms_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (fetchError) {
        setError(fetchError.message)
        setLogs([])
        setTotalEnviados(0)
        setSemanaEnviados(0)
        setTasaRespuesta(null)
        return
      }

      const list = (rows ?? []) as Record<string, unknown>[]
      const now = new Date()
      const inicioSemana = new Date(now)
      inicioSemana.setDate(now.getDate() - 6)
      inicioSemana.setHours(0, 0, 0, 0)

      const mapped: SmsRow[] = list.map((r) => ({
        id: String(r.id),
        destinatario:
          (r.destinatario as string) ??
          (r.contact_name as string) ??
          (r.nombre as string) ??
          (r.to_name as string) ??
          (r.numero as string) ??
          '-',
        numero:
          (r.numero as string) ??
          (r.to_number as string) ??
          (r.telefono as string) ??
          (r.phone as string) ??
          '-',
        mensaje: (r.mensaje as string) ?? (r.message as string) ?? (r.body as string) ?? '',
        estado: String(r.estado ?? r.status ?? 'pendiente').toLowerCase(),
        created_at: String(r.created_at),
        respuesta: Boolean(
          r.es_respuesta ?? r.respuesta ?? r.response_received ?? r.responded,
        ),
      }))

      setLogs(mapped)

      const { count: total } = await supabase
        .from('sms_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
      setTotalEnviados(total ?? 0)

      const { count: semana } = await supabase
        .from('sms_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', inicioSemana.toISOString())
      setSemanaEnviados(semana ?? 0)

      const totalForRate = total ?? 0
      if (totalForRate > 0) {
        const { count: conRespuesta, error: rateErr } = await supabase
          .from('sms_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('es_respuesta', true)
        if (!rateErr && conRespuesta != null) {
          setTasaRespuesta(Math.round((conRespuesta / totalForRate) * 100))
        } else {
          setTasaRespuesta(null)
        }
      } else {
        setTasaRespuesta(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar SMS.')
      setLogs([])
      setTotalEnviados(0)
      setSemanaEnviados(0)
      setTasaRespuesta(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadSmsCampaigns = useCallback(async () => {
    setCampaignsError(null)
    setLoadingCampaigns(true)
    try {
      const userId = await getUserIdOrThrow()
      const { data, error: err } = await supabase
        .from('sms_campaigns')
        .select(
          'id, nombre, mensaje, variables_usadas, total_contactos, total_enviados, total_respondidos, costo_total_usd, status, programado_para, created_at',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (err) throw new Error(err.message)
      setSmsCampaigns((data ?? []) as SmsCampaignRow[])
    } catch (e) {
      setSmsCampaigns([])
      setCampaignsError(e instanceof Error ? e.message : 'Error al cargar campañas SMS.')
    } finally {
      setLoadingCampaigns(false)
    }
  }, [])

  useEffect(() => {
    void loadSms()
  }, [loadSms])

  useEffect(() => {
    if (tab === 'campanas') void loadSmsCampaigns()
  }, [tab, loadSmsCampaigns])

  async function refreshContactEstimate() {
    setLoadingCount(true)
    try {
      const userId = await getUserIdOrThrow()
      if (contactSource === 'csv') {
        setContactCountEstimate(csvRows.length)
        return
      }
      if (contactSource === 'all') {
        const { count, error: cErr } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
        if (cErr) throw cErr
        setContactCountEstimate(count ?? 0)
        return
      }
      if (contactSource === 'campaign') {
        if (!voiceCampaignId) {
          setContactCountEstimate(0)
          return
        }
        const { count, error: cErr } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('campaign_id', voiceCampaignId)
        if (cErr) throw cErr
        setContactCountEstimate(count ?? 0)
      }
    } catch {
      setContactCountEstimate(0)
    } finally {
      setLoadingCount(false)
    }
  }

  useEffect(() => {
    if (!modalOpen) return
    void refreshContactEstimate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, contactSource, voiceCampaignId, csvRows.length])

  async function openCreateModal() {
    setFormError(null)
    setNombreCampana('')
    setMensajeSms('')
    setContactSource('all')
    setVoiceCampaignId('')
    setCsvRows([])
    setCsvFileName(null)
    setSendMode('now')
    setProgramadoPara('')
    setEsSeguimiento(false)
    setSegDia1(1)
    setSegDia2(3)
    setSegDia3(7)
    setMensajesDistintos(false)
    setMensajeSeg2('')
    setMensajeSeg3('')
    try {
      const userId = await getUserIdOrThrow()
      const [{ data: camps }, { data: cred }] = await Promise.all([
        supabase.from('campaigns').select('id, nombre').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('credits').select('saldo_usd').eq('user_id', userId).maybeSingle(),
      ])
      setVoiceCampaigns((camps ?? []) as VoiceCampaignOption[])
      const raw = cred?.saldo_usd
      setSaldoUsd(raw != null && Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0)
    } catch {
      setVoiceCampaigns([])
      setSaldoUsd(0)
    }
    setModalOpen(true)
  }

  function closeModal() {
    if (savingCampaign) return
    setModalOpen(false)
  }

  function insertVariableAtCursor(fragment: string) {
    const el = mensajeRef.current
    if (!el) {
      setMensajeSms((prev) => (prev + fragment).slice(0, SMS_MSG_MAX))
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? start
    const next = (el.value.slice(0, start) + fragment + el.value.slice(end)).slice(0, SMS_MSG_MAX)
    setMensajeSms(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + fragment.length
      el.setSelectionRange(pos, pos)
    })
  }

  function onImportContactsFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) {
      setCsvRows([])
      setCsvFileName(null)
      return
    }
    setCsvFileName(file.name)
    setFormError(null)
    const lower = file.name.toLowerCase()
    const isExcel = lower.endsWith('.xlsx') || lower.endsWith('.xls')
    if (isExcel) {
      const reader = new FileReader()
      reader.onload = () => {
        const buf = reader.result
        if (!(buf instanceof ArrayBuffer)) {
          setCsvRows([])
          setFormError('No se pudo leer el archivo Excel.')
          return
        }
        try {
          setCsvRows(parseXlsxPhones(buf))
        } catch {
          setCsvRows([])
          setFormError('No se pudo leer el Excel. Comprueba el formato.')
        }
      }
      reader.readAsArrayBuffer(file)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      setCsvRows(parseCsvPhones(text))
    }
    reader.readAsText(file, 'UTF-8')
  }

  async function submitSmsCampaign() {
    setFormError(null)
    if (!nombreCampana.trim()) {
      setFormError('Indica el nombre de la campaña.')
      return
    }
    if (!mensajeSms.trim()) {
      setFormError('Escribe el mensaje SMS.')
      return
    }
    if (contactSource === 'campaign' && !voiceCampaignId) {
      setFormError('Selecciona una campaña de llamadas.')
      return
    }
    if (contactSource === 'csv' && csvRows.length === 0) {
      setFormError('Importa un CSV o Excel con al menos un teléfono válido.')
      return
    }
    if (sendMode === 'schedule' && !programadoPara.trim()) {
      setFormError('Elige fecha y hora de envío programado.')
      return
    }
    if (!saldoSuficiente) {
      setFormError('Saldo insuficiente para esta campaña.')
      return
    }

    setSavingCampaign(true)
    let createdCampaignId: string | null = null
    try {
      const userId = await getUserIdOrThrow()

      let contactsPayload: {
        contact_id: string | null
        nombre: string | null
        telefono: string
        mensaje_personalizado: string
      }[] = []

      if (contactSource === 'csv') {
        contactsPayload = csvRows.map((r) => ({
          contact_id: null,
          nombre: r.nombre,
          telefono: r.telefono,
          mensaje_personalizado: buildPersonalizedMessage(mensajeSms, {
            nombre: r.nombre,
            ciudad: null,
            zipcode: null,
            empresa: null,
          }),
        }))
      } else {
        let q = supabase
          .from('contacts')
          .select('id, nombre, telefono, ciudad, zipcode, email')
          .eq('user_id', userId)
        if (contactSource === 'campaign') {
          q = q.eq('campaign_id', voiceCampaignId)
        }
        const { data: contactRows, error: cqErr } = await q
        if (cqErr) throw cqErr
        const list = (contactRows ?? []) as {
          id: string
          nombre: string | null
          telefono: string | null
          ciudad: string | null
          zipcode: string | null
          email: string | null
        }[]
        contactsPayload = list
          .map((c) => {
            const digits = normalizePhoneDigits(c.telefono)
            if (digits.length < 10) return null
            return {
              contact_id: c.id,
              nombre: c.nombre,
              telefono: digits,
              mensaje_personalizado: buildPersonalizedMessage(mensajeSms, {
                nombre: c.nombre,
                ciudad: c.ciudad,
                zipcode: c.zipcode,
                empresa: c.email,
              }),
            }
          })
          .filter(Boolean) as typeof contactsPayload
      }

      if (contactsPayload.length === 0) {
        setFormError('No hay contactos válidos con teléfono para enviar.')
        setSavingCampaign(false)
        return
      }

      const vars = extractVariablesUsadas(mensajeSms)
      const programadoIso =
        sendMode === 'schedule' && programadoPara
          ? new Date(programadoPara).toISOString()
          : null
      const status =
        sendMode === 'schedule' ? 'scheduled' : 'running'

      const seguimiento_config =
        esSeguimiento
          ? {
              dias: [segDia1, segDia2, segDia3],
              mensajesOpcionales:
                mensajesDistintos && (mensajeSeg2.trim() || mensajeSeg3.trim())
                  ? { 2: mensajeSeg2.trim() || undefined, 3: mensajeSeg3.trim() || undefined }
                  : undefined,
            }
          : null

      const { data: insCamp, error: insErr } = await supabase
        .from('sms_campaigns')
        .insert({
          user_id: userId,
          nombre: nombreCampana.trim(),
          mensaje: mensajeSms.trim(),
          variables_usadas: vars,
          total_contactos: contactsPayload.length,
          total_enviados: 0,
          total_respondidos: 0,
          costo_total_usd: 0,
          status,
          programado_para: programadoIso,
          contact_source: contactSource,
          voice_campaign_id: contactSource === 'campaign' ? voiceCampaignId : null,
          enviar_ahora: sendMode === 'now',
          es_seguimiento: esSeguimiento,
          seguimiento_config,
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insErr) throw insErr
      createdCampaignId = insCamp?.id ?? null
      if (!createdCampaignId) throw new Error('No se obtuvo id de campaña.')

      const rows = contactsPayload.map((c) => ({
        campaign_id: createdCampaignId,
        user_id: userId,
        contact_id: c.contact_id,
        nombre: c.nombre,
        telefono: c.telefono,
        mensaje_personalizado: c.mensaje_personalizado,
        status: 'pending',
      }))

      const chunk = 150
      for (let i = 0; i < rows.length; i += chunk) {
        const { error: batchErr } = await supabase.from('sms_campaign_contacts').insert(rows.slice(i, i + chunk))
        if (batchErr) throw batchErr
      }

      const base = getPublicWebhookBaseUrl()
      if (base) {
        try {
          await fetch(`${base}/webhook/sms-campaign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaign_id: createdCampaignId,
              user_id: userId,
              programado_para: programadoIso,
            }),
          })
        } catch {
          setFormError(
            'Campaña creada, pero no se pudo notificar al automatizador. Revisa la configuración del webhook o inténtalo de nuevo.',
          )
        }
      }

      setModalOpen(false)
      void loadSmsCampaigns()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al crear la campaña.'
      setFormError(msg)
      if (createdCampaignId) {
        await supabase.from('sms_campaigns').delete().eq('id', createdCampaignId)
      }
    } finally {
      setSavingCampaign(false)
    }
  }

  async function fetchAllSmsCampaignContacts(
    campaignId: string,
    userId: string,
  ): Promise<SmsCampaignContactRow[]> {
    const pageSize = 1000
    let from = 0
    const all: SmsCampaignContactRow[] = []
    for (;;) {
      const { data, error: dErr } = await supabase
        .from('sms_campaign_contacts')
        .select('id, nombre, telefono, mensaje_personalizado, status, enviado_at')
        .eq('campaign_id', campaignId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .range(from, from + pageSize - 1)
      if (dErr) throw dErr
      const batch = (data ?? []) as SmsCampaignContactRow[]
      all.push(...batch)
      if (batch.length < pageSize) break
      from += pageSize
      if (from > 100_000) break
    }
    return all
  }

  async function openDetail(c: SmsCampaignRow) {
    setDetailCampaign(c)
    setDetailContacts([])
    setDetailFilter('all')
    setLoadingDetail(true)
    try {
      const userId = await getUserIdOrThrow()
      const { data: fresh, error: fErr } = await supabase
        .from('sms_campaigns')
        .select(
          'id, nombre, mensaje, variables_usadas, total_contactos, total_enviados, total_respondidos, costo_total_usd, status, programado_para, created_at',
        )
        .eq('id', c.id)
        .eq('user_id', userId)
        .single()
      if (!fErr && fresh) {
        setDetailCampaign(fresh as SmsCampaignRow)
      }
      const all = await fetchAllSmsCampaignContacts(c.id, userId)
      setDetailContacts(all)
    } catch {
      setDetailContacts([])
    } finally {
      setLoadingDetail(false)
    }
  }

  function closeDetailModal() {
    setDetailCampaign(null)
    setDetailFilter('all')
    setDetailContacts([])
  }

  function exportSmsCampaignCsv() {
    if (!detailCampaign) return
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`
    const header = ['nombre', 'telefono', 'status', 'mensaje', 'enviado_at']
    const lines = [
      header.join(','),
      ...detailContacts.map((r) =>
        [
          escape(r.nombre ?? ''),
          escape(r.telefono),
          escape(r.status),
          escape(r.mensaje_personalizado ?? ''),
          escape(r.enviado_at ?? ''),
        ].join(','),
      ),
    ]
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeName =
      (detailCampaign.nombre || 'campana').replace(/[^\w\-]+/g, '_').slice(0, 40)
    a.download = `sms-campaign-${safeName}-${detailCampaign.id.slice(0, 8)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function toggleSmsCampaignPause() {
    if (!detailCampaign) return
    const s = detailCampaign.status.toLowerCase()
    if (s === 'completed' || s === 'draft') return
    setDetailPauseLoading(true)
    try {
      const userId = await getUserIdOrThrow()
      const next =
        s === 'paused'
          ? detailCampaign.programado_para &&
            new Date(detailCampaign.programado_para) > new Date()
            ? 'scheduled'
            : 'running'
          : 'paused'
      const { error } = await supabase
        .from('sms_campaigns')
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq('id', detailCampaign.id)
        .eq('user_id', userId)
      if (error) throw error
      setDetailCampaign((prev) => (prev ? { ...prev, status: next } : null))
      void loadSmsCampaigns()
    } catch {
      /* noop — podría mostrarse toast */
    } finally {
      setDetailPauseLoading(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">SMS</h1>
          <p className="mt-1 text-sm theme-text-muted">
            {tab === 'historial'
              ? 'Historial de mensajes enviados.'
              : 'Envía mensajes masivos a tus contactos de forma automática.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border theme-border p-0.5">
            <button
              type="button"
              onClick={() => setTab('historial')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === 'historial'
                  ? 'bg-[#22c55e] text-[#0b0b0b]'
                  : 'theme-text-muted hover:theme-text-primary'
              }`}
            >
              📊 Historial
            </button>
            <button
              type="button"
              onClick={() => setTab('campanas')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === 'campanas'
                  ? 'bg-[#22c55e] text-[#0b0b0b]'
                  : 'theme-text-muted hover:theme-text-primary'
              }`}
            >
              📢 Campañas SMS
            </button>
          </div>
          {tab === 'historial' ? (
            <button
              type="button"
              onClick={() => void loadSms()}
              disabled={loading}
              className="rounded-lg px-3 py-2 text-sm font-medium theme-text-muted ring-1 theme-border hover:theme-bg-hover hover:theme-text-primary transition disabled:opacity-50"
            >
              Actualizar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void openCreateModal()}
              className="rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
            >
              + Nueva Campaña SMS
            </button>
          )}
        </div>
      </div>

      {tab === 'historial' ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border theme-border/80 theme-bg-card p-4">
              <div className="text-sm theme-text-muted">Total SMS enviados</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight theme-text-primary">
                {loading ? '—' : totalEnviados}
              </div>
            </div>
            <div className="rounded-2xl border theme-border/80 theme-bg-card p-4">
              <div className="text-sm theme-text-muted">SMS esta semana</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight theme-text-primary">
                {loading ? '—' : semanaEnviados}
              </div>
            </div>
            <div className="rounded-2xl border theme-border/80 theme-bg-card p-4">
              <div className="text-sm theme-text-muted">Tasa de respuesta</div>
              <div className="mt-2 text-2xl font-semibold tracking-tight theme-text-primary">
                {loading ? '—' : tasaRespuesta != null ? `${tasaRespuesta}%` : '—'}
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {!loading && logs.length === 0 ? (
            <div className="rounded-2xl border theme-border/80 theme-bg-card p-12 text-center">
              <p className="text-sm theme-text-muted">
                Aún no has enviado SMS.
                <br />
                Activa SMS en tus campañas o crea una campaña SMS.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/campaigns')}
                  className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
                >
                  Ir a Campañas
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('campanas')
                    void openCreateModal()
                  }}
                  className="rounded-lg border theme-border px-4 py-2 text-sm font-medium theme-text-secondary hover:theme-bg-hover transition"
                >
                  Nueva campaña SMS
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border theme-border/80 theme-bg-card overflow-hidden">
              <div className="w-full overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide theme-text-muted theme-bg-base/80">
                    <tr className="border-b theme-border/80">
                      <th className="px-5 py-3 font-medium">Destinatario</th>
                      <th className="px-5 py-3 font-medium">Número</th>
                      <th className="px-5 py-3 font-medium">Mensaje</th>
                      <th className="px-5 py-3 font-medium">Estado</th>
                      <th className="px-5 py-3 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-zinc-500">
                          Cargando...
                        </td>
                      </tr>
                    ) : (
                      logs.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b theme-border/80 last:border-b-0 hover:bg-zinc-900/30 transition"
                        >
                          <td className="px-5 py-3 text-zinc-100">{row.destinatario}</td>
                          <td className="px-5 py-3 theme-text-muted">{row.numero}</td>
                          <td className="px-5 py-3 theme-text-muted max-w-[240px]" title={row.mensaje}>
                            {truncate(row.mensaje, MSG_TRUNCATE)}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                ESTADO_COLOR[row.estado] ?? 'bg-zinc-700/30 theme-text-muted'
                              }`}
                            >
                              {ESTADO_LABEL[row.estado] ?? row.estado}
                            </span>
                          </td>
                          <td className="px-5 py-3 theme-text-muted">
                            {new Date(row.created_at).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-semibold theme-text-primary">Campañas SMS</h2>
            <p className="mt-1 text-sm theme-text-muted">
              Envía mensajes masivos a tus contactos de forma automática.
            </p>
          </div>

          {campaignsError ? (
            <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {campaignsError}
              <p className="mt-2 text-xs text-amber-200/90">
                Si acabas de crear las tablas, ejecuta el SQL de migración y recarga el esquema de PostgREST.
              </p>
            </div>
          ) : null}

          {loadingCampaigns ? (
            <div className="flex items-center gap-2 text-sm theme-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando campañas...
            </div>
          ) : smsCampaigns.length === 0 ? (
            <div className="rounded-2xl border theme-border/80 theme-bg-card p-10 text-center text-sm theme-text-muted">
              No hay campañas SMS todavía. Crea la primera con el botón superior.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {smsCampaigns.map((c) => {
                const total = Math.max(0, c.total_contactos)
                const pendientes = Math.max(0, total - c.total_enviados)
                const pct =
                  total > 0 ? Math.min(100, Math.round((c.total_enviados / total) * 100)) : 0
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-zinc-800/90 bg-[#0b0b0b] p-5 shadow-sm ring-1 ring-zinc-800/60"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold theme-text-primary">
                          {c.nombre}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[10px] font-semibold text-[#22c55e] ring-1 ring-[#22c55e]/30">
                            SMS
                          </span>
                          <span className="text-xs theme-text-dim">
                            {c.total_contactos} contactos
                          </span>
                        </div>
                      </div>
                      <span className={smsCampaignStatusBadgeClass(c.status)}>
                        {SMS_CAMPAIGN_STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-2 py-2">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                          Enviados
                        </div>
                        <div className="mt-0.5 text-lg font-semibold text-zinc-100">
                          {c.total_enviados}
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-2 py-2">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                          Resp.
                        </div>
                        <div className="mt-0.5 text-lg font-semibold text-[#86efac]">
                          {c.total_respondidos}
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 px-2 py-2">
                        <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                          Pendientes
                        </div>
                        <div className="mt-0.5 text-lg font-semibold text-amber-200/90">
                          {pendientes}
                        </div>
                      </div>
                    </div>

                    {total > 0 ? (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span>Progreso de envíos</span>
                          <span>
                            {c.total_enviados} / {total} ({pct}%)
                          </span>
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
                        onClick={() => void openDetail(c)}
                        className="rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
                      >
                        Ver detalle
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border theme-border theme-bg-card p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sms-campaign-modal-title"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 id="sms-campaign-modal-title" className="text-lg font-semibold theme-text-primary">
                Nueva Campaña SMS
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm theme-text-muted" htmlFor="sms-nombre">
                  Nombre de la campaña
                </label>
                <input
                  id="sms-nombre"
                  value={nombreCampana}
                  onChange={(e) => setNombreCampana(e.target.value)}
                  placeholder="Ej: Seguimiento Agua Miami"
                  className="mt-1 w-full rounded-lg border theme-border theme-bg-base px-3 py-2 text-sm theme-text-primary"
                />
              </div>

              <div>
                <label className="text-sm theme-text-muted" htmlFor="sms-mensaje">
                  Mensaje SMS
                </label>
                <p className="mt-1 text-[11px] theme-text-dim">Máximo {SMS_MSG_MAX} caracteres.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {VAR_CHIPS.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariableAtCursor(v.key)}
                      className="rounded-full border border-zinc-700 bg-zinc-900/60 px-2 py-0.5 text-[11px] font-medium text-[#86efac] hover:border-[#22c55e]/60"
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={mensajeRef}
                  id="sms-mensaje"
                  rows={4}
                  maxLength={SMS_MSG_MAX}
                  value={mensajeSms}
                  onChange={(e) => setMensajeSms(e.target.value.slice(0, SMS_MSG_MAX))}
                  className="mt-2 w-full rounded-lg border theme-border theme-bg-base px-3 py-2 text-sm theme-text-primary resize-none"
                  placeholder="Hola [nombre], ..."
                />
                <div className="mt-1 text-right text-[11px] theme-text-dim">
                  {mensajeSms.length}/{SMS_MSG_MAX}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium theme-text-primary">Seleccionar contactos</div>
                <div className="mt-2 space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm theme-text-secondary">
                    <input
                      type="radio"
                      name="src"
                      checked={contactSource === 'csv'}
                      onChange={() => setContactSource('csv')}
                    />
                    Importar CSV o Excel
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm theme-text-secondary">
                    <input
                      type="radio"
                      name="src"
                      checked={contactSource === 'campaign'}
                      onChange={() => setContactSource('campaign')}
                    />
                    Usar contactos de campaña existente
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm theme-text-secondary">
                    <input
                      type="radio"
                      name="src"
                      checked={contactSource === 'all'}
                      onChange={() => setContactSource('all')}
                    />
                    Todos mis contactos
                  </label>
                </div>
                {contactSource === 'csv' && (
                  <div className="mt-2">
                    <input
                      type="file"
                      accept=".csv,.txt,.xlsx,.xls"
                      onChange={onImportContactsFile}
                      className="text-xs theme-text-muted file:mr-2 file:rounded file:border-0 file:bg-zinc-800 file:px-2 file:py-1"
                    />
                    {csvFileName ? (
                      <p className="mt-1 text-xs theme-text-dim">
                        {csvFileName} — {csvRows.length} filas válidas
                      </p>
                    ) : null}
                  </div>
                )}
                {contactSource === 'campaign' && (
                  <select
                    value={voiceCampaignId}
                    onChange={(e) => setVoiceCampaignId(e.target.value)}
                    className="mt-2 w-full rounded-lg border theme-border theme-bg-base px-3 py-2 text-sm theme-text-primary"
                  >
                    <option value="">Seleccionar campaña…</option>
                    {voiceCampaigns.map((vc) => (
                      <option key={vc.id} value={vc.id}>
                        {vc.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <div className="text-sm font-medium theme-text-primary">Horario de envío</div>
                <div className="mt-2 space-y-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm theme-text-secondary">
                    <input
                      type="radio"
                      name="send"
                      checked={sendMode === 'now'}
                      onChange={() => setSendMode('now')}
                    />
                    Enviar ahora
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm theme-text-secondary">
                    <input
                      type="radio"
                      name="send"
                      checked={sendMode === 'schedule'}
                      onChange={() => setSendMode('schedule')}
                    />
                    Programar para:
                  </label>
                  {sendMode === 'schedule' && (
                    <input
                      type="datetime-local"
                      value={programadoPara}
                      onChange={(e) => setProgramadoPara(e.target.value)}
                      className="ml-6 w-full max-w-xs rounded-lg border theme-border theme-bg-base px-3 py-2 text-sm theme-text-primary"
                    />
                  )}
                </div>
              </div>

              <div className="rounded-xl border theme-border/80 bg-zinc-900/40 px-3 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium theme-text-primary">
                  <input
                    type="checkbox"
                    checked={esSeguimiento}
                    onChange={(e) => setEsSeguimiento(e.target.checked)}
                  />
                  ¿Es campaña de seguimiento?
                </label>
                {esSeguimiento && (
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs theme-text-dim">Día 1er mensaje</label>
                        <input
                          type="number"
                          min={0}
                          value={segDia1}
                          onChange={(e) => setSegDia1(Number(e.target.value) || 0)}
                          className="mt-0.5 w-full rounded border theme-border theme-bg-base px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs theme-text-dim">Día 2.º</label>
                        <input
                          type="number"
                          min={0}
                          value={segDia2}
                          onChange={(e) => setSegDia2(Number(e.target.value) || 0)}
                          className="mt-0.5 w-full rounded border theme-border theme-bg-base px-2 py-1 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs theme-text-dim">Día 3.er</label>
                        <input
                          type="number"
                          min={0}
                          value={segDia3}
                          onChange={(e) => setSegDia3(Number(e.target.value) || 0)}
                          className="mt-0.5 w-full rounded border theme-border theme-bg-base px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                    <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs theme-text-muted">
                      <input
                        type="checkbox"
                        checked={mensajesDistintos}
                        onChange={(e) => setMensajesDistintos(e.target.checked)}
                      />
                      Mensaje diferente por día (opcional)
                    </label>
                    {mensajesDistintos && (
                      <div className="mt-2 space-y-2">
                        <textarea
                          rows={2}
                          maxLength={SMS_MSG_MAX}
                          value={mensajeSeg2}
                          onChange={(e) => setMensajeSeg2(e.target.value.slice(0, SMS_MSG_MAX))}
                          placeholder="Mensaje día 2 (opcional)"
                          className="w-full rounded-lg border theme-border theme-bg-base px-2 py-1.5 text-xs resize-none"
                        />
                        <textarea
                          rows={2}
                          maxLength={SMS_MSG_MAX}
                          value={mensajeSeg3}
                          onChange={(e) => setMensajeSeg3(e.target.value.slice(0, SMS_MSG_MAX))}
                          placeholder="Mensaje día 3 (opcional)"
                          className="w-full rounded-lg border theme-border theme-bg-base px-2 py-1.5 text-xs resize-none"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-3 text-sm">
                <p className="theme-text-secondary">
                  {loadingCount ? (
                    <>Calculando contactos…</>
                  ) : (
                    <>
                      {contactCountEstimate} contactos × ${SMS_USD_POR_MENSAJE.toFixed(2)} ≈{' '}
                      <span className="font-semibold text-[#22c55e]">${estimatedCost.toFixed(2)}</span> estimado
                    </>
                  )}
                </p>
                <p className="mt-2 theme-text-muted">
                  Tu saldo: <span className="font-medium theme-text-primary">${saldoUsd.toFixed(2)}</span> —{' '}
                  {contactCountEstimate === 0
                    ? 'elige contactos'
                    : saldoSuficiente
                      ? 'suficiente'
                      : 'insuficiente'}
                </p>
                <p className="mt-2 text-xs theme-text-dim">
                  Tus créditos son universales: una recarga sirve para llamadas y SMS.
                </p>
              </div>

              {formError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {formError}
                </div>
              )}

              <button
                type="button"
                disabled={
                  savingCampaign ||
                  !saldoSuficiente ||
                  !nombreCampana.trim() ||
                  !mensajeSms.trim() ||
                  loadingCount
                }
                onClick={() => void submitSmsCampaign()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#22c55e] px-3 py-2.5 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingCampaign ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                📱 Crear campaña SMS
              </button>
              {!saldoSuficiente && contactCountEstimate > 0 && (
                <p className="text-center text-xs text-amber-200">
                  Recarga créditos para continuar —{' '}
                  <Link to="/credits" className="font-medium text-[#22c55e] hover:underline">
                    Ir a Créditos
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {detailCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-800 bg-[#0b0b0b] p-5 shadow-xl ring-1 ring-zinc-800/80">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-zinc-100">{detailCampaign.nombre}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={smsCampaignStatusBadgeClass(detailCampaign.status)}>
                    {SMS_CAMPAIGN_STATUS_LABEL[detailCampaign.status] ?? detailCampaign.status}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {detailCampaign.total_contactos} contactos · creada{' '}
                    {new Date(detailCampaign.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDetailModal}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-400">
              {detailCampaign.mensaje}
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Enviados
                </div>
                <div className="mt-1 text-2xl font-semibold text-[#22c55e]">
                  {loadingDetail ? '—' : detailStats.enviados}
                </div>
                <p className="mt-1 text-[11px] text-zinc-600">Incluye respondidos</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Respondidos
                </div>
                <div className="mt-1 text-2xl font-semibold text-emerald-300">
                  {loadingDetail ? '—' : detailStats.respondidos}
                </div>
                <p className="mt-1 text-[11px] text-zinc-600">Estado &quot;replied&quot;</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Fallidos
                </div>
                <div className="mt-1 text-2xl font-semibold text-red-300">
                  {loadingDetail ? '—' : detailStats.fallidos}
                </div>
                <p className="mt-1 text-[11px] text-zinc-600">Estado &quot;failed&quot;</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {detailFilter === 'all' ? (
                <button
                  type="button"
                  disabled={detailStats.respondidos === 0}
                  onClick={() => setDetailFilter('replied')}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-900/80 disabled:cursor-not-allowed disabled:opacity-40 transition"
                >
                  Ver respuestas
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDetailFilter('all')}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-900/80 transition"
                >
                  Ver todos los contactos
                </button>
              )}
              {!['draft', 'completed'].includes(detailCampaign.status.toLowerCase()) ? (
                <button
                  type="button"
                  disabled={detailPauseLoading}
                  onClick={() => void toggleSmsCampaignPause()}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-amber-200 ring-1 ring-amber-500/45 hover:bg-amber-500/10 disabled:opacity-50 transition"
                >
                  {detailPauseLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> …
                    </span>
                  ) : detailCampaign.status.toLowerCase() === 'paused' ? (
                    'Reanudar'
                  ) : (
                    'Pausar'
                  )}
                </button>
              ) : null}
              <button
                type="button"
                disabled={loadingDetail || detailContacts.length === 0}
                onClick={exportSmsCampaignCsv}
                className="rounded-lg px-3 py-2 text-sm font-medium text-[#0b0b0b] bg-[#22c55e] hover:bg-[#1fb455] disabled:cursor-not-allowed disabled:opacity-40 transition"
              >
                Exportar resultados CSV
              </button>
            </div>

            <h4 className="mt-6 text-sm font-semibold text-zinc-200">
              Contactos
              {detailFilter === 'replied' ? ' (solo respuestas)' : ''}
              <span className="ml-2 font-normal text-zinc-500">
                ({displayedDetailContacts.length}
                {detailContacts.length !== displayedDetailContacts.length
                  ? ` de ${detailContacts.length}`
                  : ''}
                )
              </span>
            </h4>
            {loadingDetail ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando contactos…
              </p>
            ) : displayedDetailContacts.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">
                {detailFilter === 'replied'
                  ? 'Nadie ha respondido aún.'
                  : 'Sin contactos en esta campaña.'}
              </p>
            ) : (
              <div className="mt-2 max-h-[min(50vh,420px)] overflow-auto rounded-xl border border-zinc-800">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-zinc-900/95 text-xs uppercase tracking-wide text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="px-3 py-2.5 font-medium">Nombre</th>
                      <th className="px-3 py-2.5 font-medium">Teléfono</th>
                      <th className="px-3 py-2.5 font-medium">Mensaje</th>
                      <th className="px-3 py-2.5 font-medium">Estado</th>
                      <th className="px-3 py-2.5 font-medium">Enviado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedDetailContacts.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-800/80 last:border-b-0 hover:bg-zinc-900/40">
                        <td className="px-3 py-2 text-zinc-200">{r.nombre ?? '—'}</td>
                        <td className="px-3 py-2 text-zinc-400">{r.telefono}</td>
                        <td
                          className="max-w-[200px] truncate px-3 py-2 text-zinc-500"
                          title={r.mensaje_personalizado ?? ''}
                        >
                          {truncate(r.mensaje_personalizado ?? '—', 48)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${smsContactRowBadgeClass(r.status)}`}
                          >
                            {SMS_CONTACT_STATUS_LABEL[r.status] ?? r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-zinc-500">
                          {r.enviado_at
                            ? new Date(r.enviado_at).toLocaleString('es-ES', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
