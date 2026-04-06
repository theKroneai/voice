import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Pencil, Copy, Trash2, Plus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { UpgradePlanModal } from '../components/UpgradePlanModal'

type UserPlan = 'prospectador' | 'vendedor' | 'cazador'

function canUseSequence(sequence: { plan_requerido?: string | null }, userPlan: UserPlan): boolean {
  const req = sequence.plan_requerido || 'prospectador'
  if (req === 'prospectador') return true
  if (req === 'vendedor') return ['vendedor', 'cazador'].includes(userPlan)
  if (req === 'cazador') return userPlan === 'cazador'
  return true
}

const NICHOS = [
  { value: 'agua', label: 'Agua' },
  { value: 'salud', label: 'Salud' },
  { value: 'hogar', label: 'Hogar' },
  { value: 'citas', label: 'Citas' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'general', label: 'General' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'solar', label: 'Solar' },
  { value: 'dental', label: 'Dental' },
  { value: 'todos', label: 'Todos' },
] as const

const NICHO_COLORS: Record<string, string> = {
  agua: 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/40',
  salud: 'bg-blue-500/20 text-blue-300 ring-blue-500/40',
  hogar: 'bg-orange-500/20 text-orange-300 ring-orange-500/40',
  todos: 'bg-zinc-500/20 text-zinc-300 ring-zinc-500/40',
  general: 'bg-zinc-500/20 text-zinc-300 ring-zinc-500/40',
  citas: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40',
  reviews: 'bg-amber-500/20 text-amber-300 ring-amber-500/40',
  solar: 'bg-amber-500/20 text-amber-300 ring-amber-500/40',
  dental: 'bg-blue-500/20 text-blue-300 ring-blue-500/40',
  roofing: 'bg-orange-500/20 text-orange-300 ring-orange-500/40',
}

// Agrupación visual de predefinidas (acordeón)
const PREDEFINIDAS_GROUP_ORDER = ['agua', 'citas', 'salud', 'hogar', 'reviews', 'general'] as const
const PREDEFINIDAS_GROUP_LABELS: Record<string, string> = {
  agua: '💧 AGUA — Seguimiento Completo',
  citas: '📅 CITAS',
  salud: '🏥 SALUD',
  hogar: '🏠 HOGAR',
  reviews: '⭐ REVIEWS',
  general: '🌐 GENERAL',
}

const VARIABLES_HINT_GROUPS = [
  { label: 'Básicas', vars: ['{nombre}', '{telefono}', '{ciudad}', '{zipcode}', '{empresa}', '{agente}'] },
  { label: 'Cita', vars: ['{hora}', '{fecha_cita}'] },
  { label: 'EWG (agua)', vars: ['{contaminante_1}', '{contaminante_2}', '{contaminante_3}'] },
  { label: 'Especiales', vars: ['{google_review_link}', '{referido}'] },
] as const

type Sequence = {
  id: string
  user_id: string
  nombre: string
  nicho: string
  descripcion: string | null
  es_publica: boolean
  created_at: string
  plan_requerido?: string | null
  steps_count?: number
  steps?: SequenceStep[]
}

type SequenceStep = {
  id: string
  sequence_id: string
  orden: number
  dia: number
  canal: 'sms' | 'call'
  mensaje: string
  hora_envio: string | null
  activo: boolean
}

type StepForm = {
  dia: number
  canal: 'sms' | 'call'
  mensaje: string
  hora_envio: string
  activo: boolean
}

type ContactSequenceRow = {
  id: string
  contact_id: string
  sequence_id: string
  user_id: string
  status: string
  fecha_inicio: string
  paso_actual: number
  ewg_contaminantes: Record<string, unknown> | null
  created_at: string
  contact?: { nombre: string | null }
  sequence?: { nombre: string; nicho?: string; sequence_steps?: { id: string }[] }
}

async function getUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('No autenticado')
  return session.user.id
}

export default function Sequences() {
  const [tab, setTab] = useState<'strategies' | 'active'>('strategies')
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [activeContactSequences, setActiveContactSequences] = useState<
    ContactSequenceRow[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewStepsId, setViewStepsId] = useState<string | null>(null)

  // Modal "Usar esta estrategia" (asignar desde predefinida)
  const [assignModalSequenceId, setAssignModalSequenceId] = useState<string | null>(null)
  const [assignContactId, setAssignContactId] = useState('')
  const [assignStartDate, setAssignStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [assignGoogleReviewLink, setAssignGoogleReviewLink] = useState('')
  const [assignHora, setAssignHora] = useState('')
  const [assignReferido, setAssignReferido] = useState('')
  const [assignContacts, setAssignContacts] = useState<{ id: string; nombre: string | null }[]>([])
  const [assignSteps, setAssignSteps] = useState<SequenceStep[]>([])
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [variablesHintOpen, setVariablesHintOpen] = useState(false)
  const [focusedStepIndex, setFocusedStepIndex] = useState<number | null>(null)

  // Tab Contactos Activos — filtros
  const [activeFilter, setActiveFilter] = useState<'todos' | 'sms' | 'llamadas' | 'nicho'>('todos')
  const [activeNichoFilter, setActiveNichoFilter] = useState('')
  const [activeSearchQuery, setActiveSearchQuery] = useState('')

  // Acordeón predefinidas: por defecto todos expandidos
  const [predefinidasExpanded, setPredefinidasExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PREDEFINIDAS_GROUP_ORDER.map((k) => [k, true]))
  )
  const togglePredefinidasGroup = (key: string) => {
    setPredefinidasExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Plan del usuario (control de acceso por plan)
  const [userPlan, setUserPlan] = useState<UserPlan>('prospectador')
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)

  const [formNombre, setFormNombre] = useState('')
  const [formNicho, setFormNicho] = useState('agua')
  const [formDescripcion, setFormDescripcion] = useState('')
  const [formSteps, setFormSteps] = useState<StepForm[]>([
    { dia: 0, canal: 'sms', mensaje: '', hora_envio: '09:00', activo: true },
  ])
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadSequences = useCallback(async () => {
    try {
      const userId = await getUserId()
      // Cargar plan del usuario (control de acceso)
      const { data: creditsData } = await supabase
        .from('credits')
        .select('plan_voz')
        .eq('user_id', userId)
        .maybeSingle()
      const plan = (creditsData as { plan_voz?: string } | null)?.plan_voz
      setUserPlan((plan === 'vendedor' || plan === 'cazador' ? plan : 'prospectador') as UserPlan)

      // 1. Cargar secuencias
      const { data: sequencesData, error: seqError } = await supabase
        .from('sequences')
        .select('*')
        .or(`es_publica.eq.true,user_id.eq.${userId}`)
        .order('created_at', { ascending: false })

      if (seqError) throw new Error(seqError.message)
      const sequencesList = sequencesData ?? []
      if (sequencesList.length === 0) {
        setSequences([])
        setLoading(false)
        return
      }

      // 2. Cargar TODOS los pasos de esas secuencias
      const sequenceIds = sequencesList.map((s: { id: string }) => s.id)
      const { data: stepsData, error: stepsError } = await supabase
        .from('sequence_steps')
        .select('*')
        .in('sequence_id', sequenceIds)
        .order('dia', { ascending: true })

      if (stepsError) throw new Error(stepsError.message)
      const stepsList = (stepsData ?? []) as SequenceStep[]

      // 3. Combinar en el frontend
      const sequencesWithSteps: Sequence[] = sequencesList.map((seq: Record<string, unknown>) => ({
        ...seq,
        steps_count: stepsList.filter((s) => s.sequence_id === seq.id).length,
        steps: stepsList.filter((s) => s.sequence_id === seq.id),
      })) as Sequence[]

      setSequences(sequencesWithSteps)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar estrategias')
      setSequences([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadActiveContactSequences = useCallback(async () => {
    try {
      const userId = await getUserId()
      const { data, error: err } = await supabase
        .from('contact_sequences')
        .select(
          `
          id, contact_id, sequence_id, user_id, status, fecha_inicio, paso_actual, ewg_contaminantes, created_at,
          contact:contacts(nombre),
          sequence:sequences(nombre, nicho)
        `
        )
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('fecha_inicio', { ascending: false })
      if (err) throw new Error(err.message)
      const rows = (data ?? []) as ContactSequenceRow[]
      const seqIds = [...new Set(rows.map((r) => r.sequence_id))]
      let stepsCount: Record<string, number> = {}
      let stepsBySeq: Record<string, { dia: number; canal: string; hora_envio: string | null }[]> = {}
      if (seqIds.length > 0) {
        const { data: steps } = await supabase
          .from('sequence_steps')
          .select('sequence_id, dia, canal, hora_envio, orden')
          .in('sequence_id', seqIds)
          .order('orden', { ascending: true })
        for (const s of steps ?? []) {
          stepsCount[s.sequence_id] = (stepsCount[s.sequence_id] ?? 0) + 1
          if (!stepsBySeq[s.sequence_id]) stepsBySeq[s.sequence_id] = []
          stepsBySeq[s.sequence_id].push({
            dia: s.dia,
            canal: s.canal ?? 'sms',
            hora_envio: s.hora_envio,
          })
        }
      }
      setActiveContactSequences(
        rows.map((r) => ({
          ...r,
          sequence: r.sequence
            ? {
                ...r.sequence,
                _stepsTotal: stepsCount[r.sequence_id] ?? 0,
                _steps: stepsBySeq[r.sequence_id] ?? [],
              }
            : undefined,
        }))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar contactos activos')
      setActiveContactSequences([])
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void loadSequences()
  }, [loadSequences])

  useEffect(() => {
    if (tab === 'active') void loadActiveContactSequences()
  }, [tab, loadActiveContactSequences])

  const predefinidas = useMemo(
    () => sequences.filter((s) => s.es_publica),
    [sequences]
  )
  const predefinidasByGroup = useMemo(() => {
    const map: Record<string, Sequence[]> = {}
    for (const key of PREDEFINIDAS_GROUP_ORDER) {
      map[key] = []
    }
    for (const seq of predefinidas) {
      const group = PREDEFINIDAS_GROUP_ORDER.includes(seq.nicho as (typeof PREDEFINIDAS_GROUP_ORDER)[number])
        ? seq.nicho
        : 'general'
      if (!map[group]) map[group] = []
      map[group].push(seq)
    }
    return map
  }, [predefinidas])
  const misEstrategias = useMemo(
    () => sequences.filter((s) => !s.es_publica),
    [sequences]
  )

  const filteredActiveContactSequences = useMemo(() => {
    let list = activeContactSequences
    const q = activeSearchQuery.trim().toLowerCase()
    if (q) {
      const name = (row: ContactSequenceRow) =>
        (row.contact as { nombre?: string } | null)?.nombre ?? ''
      list = list.filter((row) => name(row).toLowerCase().includes(q))
    }
    if (activeFilter === 'sms') {
      list = list.filter((row) => {
        const steps = (row.sequence as { _steps?: { canal: string }[] })?._steps ?? []
        const paso = row.paso_actual
        return steps[paso]?.canal === 'sms'
      })
    } else if (activeFilter === 'llamadas') {
      list = list.filter((row) => {
        const steps = (row.sequence as { _steps?: { canal: string }[] })?._steps ?? []
        const paso = row.paso_actual
        return steps[paso]?.canal === 'call'
      })
    } else if (activeFilter === 'nicho' && activeNichoFilter) {
      list = list.filter((row) => (row.sequence as { nicho?: string })?.nicho === activeNichoFilter)
    }
    return list
  }, [activeContactSequences, activeFilter, activeNichoFilter, activeSearchQuery])

  function sequenceStepsUseVariable(steps: SequenceStep[], variable: string): boolean {
    return steps.some((s) => (s.mensaje ?? '').includes(variable))
  }

  async function openAssignModal(sequenceId: string) {
    setAssignModalSequenceId(sequenceId)
    setAssignContactId('')
    setAssignStartDate(new Date().toISOString().slice(0, 10))
    setAssignGoogleReviewLink('')
    setAssignHora('')
    setAssignReferido('')
    setAssignError(null)
    const userId = await getUserId()
    if (userId) {
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
    }
    const [contactsRes, stepsRes, userRes] = await Promise.all([
      supabase.from('contacts').select('id, nombre').eq('user_id', userId).order('nombre'),
      supabase
        .from('sequence_steps')
        .select('id, sequence_id, orden, dia, canal, mensaje, hora_envio, activo')
        .eq('sequence_id', sequenceId)
        .order('orden', { ascending: true }),
      supabase.from('users').select('google_review_link').eq('id', userId).maybeSingle(),
    ])
    // eslint-disable-next-line no-console
    console.log('users data:', userRes.data)
    // eslint-disable-next-line no-console
    console.log('users error:', userRes.error)
    const steps = (stepsRes.data ?? []) as SequenceStep[]
    setAssignSteps(steps)
    setAssignContacts((contactsRes.data ?? []) as { id: string; nombre: string | null }[])
    const link = (userRes.data as { google_review_link?: string } | null)?.google_review_link ?? ''
    setAssignGoogleReviewLink(link)
  }

  function closeAssignModal() {
    setAssignModalSequenceId(null)
    setAssignError(null)
  }

  async function onActivateAssignSequence() {
    const seqId = assignModalSequenceId
    if (!seqId || !assignContactId) {
      setAssignError('Selecciona un contacto.')
      return
    }
    const needsGoogleLink = sequenceStepsUseVariable(assignSteps, '{google_review_link}')
    if (needsGoogleLink && !assignGoogleReviewLink.trim()) {
      setAssignError('Link de Google Review es obligatorio para esta estrategia.')
      return
    }
    setAssignSaving(true)
    setAssignError(null)
    try {
      const userId = await getUserId()
      const variablesExtra: Record<string, string> = {}
      if (assignGoogleReviewLink.trim()) variablesExtra.google_review_link = assignGoogleReviewLink.trim()
      if (assignHora.trim()) variablesExtra.hora = assignHora.trim()
      if (assignReferido.trim()) variablesExtra.referido = assignReferido.trim()
      const { error } = await supabase.from('contact_sequences').insert({
        contact_id: assignContactId,
        sequence_id: seqId,
        user_id: userId,
        status: 'active',
        fecha_inicio: assignStartDate,
        paso_actual: 0,
        ewg_contaminantes: null,
        variables_extra: Object.keys(variablesExtra).length ? variablesExtra : null,
      })
      if (error) throw new Error(error.message)
      closeAssignModal()
      await loadSequences()
      if (tab === 'active') await loadActiveContactSequences()
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : 'Error al activar secuencia.')
    } finally {
      setAssignSaving(false)
    }
  }

  function openNew() {
    setEditingId(null)
    setFormNombre('')
    setFormNicho('agua')
    setFormDescripcion('')
    setFormSteps([
      { dia: 0, canal: 'sms', mensaje: '', hora_envio: '09:00', activo: true },
    ])
    setFormError(null)
    setModalOpen(true)
  }

  async function openEdit(id: string) {
    setFormError(null)
    const seq = sequences.find((s) => s.id === id)
    if (!seq) return
    const { data: steps } = await supabase
      .from('sequence_steps')
      .select('id, dia, canal, mensaje, hora_envio, activo, orden')
      .eq('sequence_id', id)
      .order('orden', { ascending: true })
    setEditingId(id)
    setFormNombre(seq.nombre)
    setFormNicho(seq.nicho)
    setFormDescripcion(seq.descripcion ?? '')
    setFormSteps(
      (steps ?? []).length > 0
        ? (steps ?? []).map((s) => ({
            dia: s.dia,
            canal: (s.canal as 'sms' | 'call') || 'sms',
            mensaje: s.mensaje ?? '',
            hora_envio: (s.hora_envio ?? '09:00').toString().slice(0, 5),
            activo: s.activo ?? true,
          }))
        : [{ dia: 0, canal: 'sms', mensaje: '', hora_envio: '09:00', activo: true }]
    )
    setModalOpen(true)
  }

  function addStep() {
    const maxDia = Math.max(0, ...formSteps.map((s) => s.dia))
    setFormSteps((prev) => [
      ...prev,
      {
        dia: maxDia + 1,
        canal: 'sms',
        mensaje: '',
        hora_envio: '09:00',
        activo: true,
      },
    ])
  }

  function removeStep(index: number) {
    if (formSteps.length <= 1) return
    setFormSteps((prev) => prev.filter((_, i) => i !== index))
  }

  function updateStep(index: number, patch: Partial<StepForm>) {
    setFormSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s))
    )
  }

  const stepsWithIndex = formSteps
    .map((step, i) => ({ step, originalIndex: i }))
    .sort((a, b) => a.step.dia - b.step.dia)

  async function saveStrategy() {
    if (!formNombre.trim()) {
      setFormError('El nombre es obligatorio.')
      return
    }
    setFormSaving(true)
    setFormError(null)
    try {
      const userId = await getUserId()
      if (editingId) {
        await supabase
          .from('sequences')
          .update({
            nombre: formNombre.trim(),
            nicho: formNicho,
            descripcion: formDescripcion.trim() || null,
          })
          .eq('id', editingId)
          .eq('user_id', userId)
        await supabase.from('sequence_steps').delete().eq('sequence_id', editingId)
        const sortedSteps = [...formSteps].sort((a, b) => a.dia - b.dia)
        const toInsert = sortedSteps
          .filter((s) => s.mensaje.trim() || s.canal === 'call')
          .map((s, i) => ({
            sequence_id: editingId,
            orden: i + 1,
            dia: s.dia,
            canal: s.canal,
            mensaje: s.mensaje.trim(),
            hora_envio: s.hora_envio || null,
            activo: s.activo,
          }))
        if (toInsert.length > 0) {
          await supabase.from('sequence_steps').insert(toInsert)
        }
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('sequences')
          .insert({
            user_id: userId,
            nombre: formNombre.trim(),
            nicho: formNicho,
            descripcion: formDescripcion.trim() || null,
            es_publica: false,
          })
          .select('id')
          .single()
        if (insertErr || !inserted) throw new Error(insertErr?.message ?? 'Error al crear')
        const seqId = inserted.id
        const sortedSteps = [...formSteps].sort((a, b) => a.dia - b.dia)
        const toInsert = sortedSteps
          .filter((s) => s.mensaje.trim() || s.canal === 'call')
          .map((s, i) => ({
            sequence_id: seqId,
            orden: i + 1,
            dia: s.dia,
            canal: s.canal,
            mensaje: s.mensaje.trim(),
            hora_envio: s.hora_envio || null,
            activo: s.activo,
          }))
        if (toInsert.length > 0) {
          await supabase.from('sequence_steps').insert(toInsert)
        }
      }
      setModalOpen(false)
      await loadSequences()
      if (tab === 'active') await loadActiveContactSequences()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setFormSaving(false)
    }
  }

  async function duplicateSequence(id: string) {
    const seq = sequences.find((s) => s.id === id)
    if (!seq) return
    try {
      const userId = await getUserId()
      const { data: steps } = await supabase
        .from('sequence_steps')
        .select('dia, canal, mensaje, hora_envio, activo, orden')
        .eq('sequence_id', id)
        .order('orden', { ascending: true })
      const { data: newSeq, error: err } = await supabase
        .from('sequences')
        .insert({
          user_id: userId,
          nombre: `${seq.nombre} (copia)`,
          nicho: seq.nicho,
          descripcion: seq.descripcion,
          es_publica: false,
        })
        .select('id')
        .single()
      if (err || !newSeq) throw new Error(err?.message ?? 'Error al duplicar')
      if ((steps ?? []).length > 0) {
        await supabase.from('sequence_steps').insert(
          (steps ?? []).map((s, i) => ({
            sequence_id: newSeq.id,
            orden: i + 1,
            dia: s.dia,
            canal: s.canal,
            mensaje: s.mensaje ?? '',
            hora_envio: s.hora_envio,
            activo: s.activo ?? true,
          }))
        )
      }
      await loadSequences()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al duplicar')
    }
  }

  async function deleteSequence(id: string) {
    if (!confirm('¿Eliminar esta estrategia? No se eliminarán los contactos en secuencia.'))
      return
    try {
      const userId = await getUserId()
      await supabase.from('sequence_steps').delete().eq('sequence_id', id)
      const { error } = await supabase
        .from('sequences')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (error) throw new Error(error.message)
      await loadSequences()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  const loadStepsForView = useCallback(async (sequenceId: string): Promise<SequenceStep[]> => {
    const { data: steps, error } = await supabase
      .from('sequence_steps')
      .select('*')
      .eq('sequence_id', sequenceId)
      .order('orden', { ascending: true })
    if (error) throw new Error(error.message)
    return (steps ?? []) as SequenceStep[]
  }, [])

  async function pauseContactSequence(csId: string) {
    try {
      const userId = await getUserId()
      const { error } = await supabase
        .from('contact_sequences')
        .update({ status: 'paused' })
        .eq('id', csId)
        .eq('user_id', userId)
      if (error) throw new Error(error.message)
      await loadActiveContactSequences()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al pausar')
    }
  }

  async function cancelContactSequence(csId: string) {
    if (!confirm('¿Cancelar esta secuencia para el contacto?')) return
    try {
      const userId = await getUserId()
      const { error } = await supabase
        .from('contact_sequences')
        .update({ status: 'cancelled' })
        .eq('id', csId)
        .eq('user_id', userId)
      if (error) throw new Error(error.message)
      await loadActiveContactSequences()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cancelar')
    }
  }

  function getNextStepDate(fechaInicio: string, pasoActual: number, steps: { dia: number; hora_envio: string | null }[]): { date: string; canal: string } | null {
    if (!steps.length || pasoActual >= steps.length) return null
    const step = steps[pasoActual]
    const d = new Date(fechaInicio)
    d.setDate(d.getDate() + step.dia)
    const time = step.hora_envio ?? '09:00'
    const [h, m] = time.split(':').map(Number)
    d.setHours(h, m, 0, 0)
    return {
      date: d.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }),
      canal: step.dia !== undefined ? (step as { canal?: string }).canal ?? 'sms' : 'sms',
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">
          Secuencias de Seguimiento
        </h1>
        <p className="mt-1 text-sm theme-text-muted">
          Gestiona estrategias de seguimiento y contactos en secuencia activa.
        </p>
      </div>

      <div className="flex gap-2 border-b theme-border">
        <button
          type="button"
          onClick={() => setTab('strategies')}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
            tab === 'strategies'
              ? 'theme-bg-elevated theme-text-primary ring-1 theme-border-strong -mb-px'
              : 'theme-text-muted hover:theme-text-primary'
          }`}
        >
          Mis Estrategias
        </button>
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
            tab === 'active'
              ? 'theme-bg-elevated theme-text-primary ring-1 theme-border-strong -mb-px'
              : 'theme-text-muted hover:theme-text-primary'
          }`}
        >
          Contactos Activos
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {tab === 'strategies' && (
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-5 space-y-8">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
            >
              <Plus className="h-4 w-4" />
              Nueva Estrategia
            </button>
          </div>
          {loading ? (
            <div className="py-8 text-center theme-text-muted">Cargando...</div>
          ) : (
            <>
              {/* SECCIÓN 1 — Predefinidas agrupadas (acordeón) */}
              {predefinidas.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold theme-text-primary">Predefinidas</h2>
                  {PREDEFINIDAS_GROUP_ORDER.map((groupKey) => {
                    const groupSeqs = predefinidasByGroup[groupKey] ?? []
                    if (groupSeqs.length === 0) return null
                    const label = PREDEFINIDAS_GROUP_LABELS[groupKey] ?? groupKey
                    const isExpanded = predefinidasExpanded[groupKey] !== false
                    return (
                      <div
                        key={groupKey}
                        className="rounded-xl border theme-border/80 theme-bg-base overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => togglePredefinidasGroup(groupKey)}
                          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left theme-text-primary font-medium hover:theme-bg-elevated transition"
                        >
                          <span>{label}</span>
                          <ChevronDown
                            className={`h-4 w-4 shrink-0 transition ${isExpanded ? '' : '-rotate-90'}`}
                          />
                        </button>
                        {isExpanded && (
                          <div className="border-t theme-border/80 px-4 pb-4 pt-2">
                            <ul className="space-y-2">
                              {groupSeqs.map((seq) => {
                                const canUse = canUseSequence(seq, userPlan)
                                const reqPlan = seq.plan_requerido || 'prospectador'
                                return (
                                <li key={seq.id} className="rounded-lg border theme-border/80 theme-bg-base p-4 space-y-3 relative">
                                  {!canUse && (
                                    <div
                                      className="absolute top-2 right-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-500/40"
                                      title="Esta estrategia combina llamadas + SMS automáticos. Requiere el Plan Cazador."
                                    >
                                      🔒 Requiere Plan Cazador
                                    </div>
                                  )}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold theme-text-primary truncate">
                                      {seq.nombre}
                                    </span>
                                    <span className="rounded-full bg-[#22c55e]/20 px-2 py-0.5 text-xs font-medium text-[#22c55e] ring-1 ring-[#22c55e]/40">
                                      Predefinida
                                    </span>
                                    {reqPlan === 'prospectador' && (
                                      <span className="rounded-full bg-zinc-500/20 px-2 py-0.5 text-xs font-medium text-zinc-300 ring-1 ring-zinc-500/40">
                                        Todos los planes
                                      </span>
                                    )}
                                    {reqPlan === 'vendedor' && (
                                      <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300 ring-1 ring-blue-500/40">
                                        Plan Vendedor ⚡
                                      </span>
                                    )}
                                    {reqPlan === 'cazador' && (
                                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-500/40">
                                        Plan Cazador 👑
                                      </span>
                                    )}
                                    <span className="text-xs theme-text-dim">
                                      ({seq.steps_count ?? 0} pasos)
                                    </span>
                                  </div>
                                  {seq.descripcion ? (
                                    <p className="text-sm theme-text-muted line-clamp-2">{seq.descripcion}</p>
                                  ) : null}
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => canUse ? openAssignModal(seq.id) : setUpgradeModalOpen(true)}
                                      title={!canUse ? 'Esta estrategia combina llamadas + SMS automáticos. Requiere el Plan Cazador.' : undefined}
                                      disabled={!canUse}
                                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium ring-1 ${
                                        canUse
                                          ? 'bg-[#22c55e]/20 text-[#22c55e] ring-[#22c55e]/40 hover:bg-[#22c55e]/30'
                                          : 'bg-zinc-700/30 text-zinc-500 ring-zinc-600/40 cursor-not-allowed'
                                      }`}
                                    >
                                      Usar esta estrategia
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => duplicateSequence(seq.id)}
                                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium theme-text-secondary hover:theme-text-primary transition"
                                    >
                                      <Copy className="h-3 w-3" />
                                      Duplicar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setViewStepsId(viewStepsId === seq.id ? null : seq.id)}
                                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium theme-bg-elevated theme-text-secondary hover:theme-text-primary transition"
                                    >
                                      Ver pasos
                                      <ChevronRight className={`h-3 w-3 transition ${viewStepsId === seq.id ? 'rotate-90' : ''}`} />
                                    </button>
                                  </div>
{viewStepsId === seq.id && (
                          <StepsExpandable sequenceId={seq.id} loadSteps={loadStepsForView} initialSteps={seq.steps} />
                        )}
                                </li>
                              )})}
                            </ul>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* SECCIÓN 2 — Mis Estrategias */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold theme-text-primary">Mis Estrategias</h2>
                {misEstrategias.length === 0 ? (
                  <div className="py-6 text-center theme-text-muted text-sm">
                    No tienes estrategias propias. Crea una o duplica una predefinida.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {misEstrategias.map((seq) => (
                      <div
                        key={seq.id}
                        className="rounded-xl border theme-border/80 theme-bg-base p-4 space-y-3"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold theme-text-primary truncate">{seq.nombre}</span>
                          <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-300 ring-1 ring-violet-500/40">
                            Personalizada
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                              NICHO_COLORS[seq.nicho] ?? NICHO_COLORS.todos
                            }`}
                          >
                            {NICHOS.find((n) => n.value === seq.nicho)?.label ?? seq.nicho}
                          </span>
                        </div>
                        {seq.descripcion ? (
                          <p className="text-sm theme-text-muted line-clamp-2">{seq.descripcion}</p>
                        ) : null}
                        <div className="text-xs theme-text-dim">{seq.steps_count ?? 0} pasos</div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setViewStepsId(viewStepsId === seq.id ? null : seq.id)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium theme-bg-elevated theme-text-secondary hover:theme-text-primary transition"
                          >
                            Ver pasos
                            <ChevronRight className={`h-3 w-3 transition ${viewStepsId === seq.id ? 'rotate-90' : ''}`} />
                          </button>
                          <button type="button" onClick={() => openEdit(seq.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium theme-text-secondary hover:theme-text-primary transition" aria-label="Editar">
                            <Pencil className="h-3 w-3" />
                            Editar
                          </button>
                          <button type="button" onClick={() => duplicateSequence(seq.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium theme-text-secondary hover:theme-text-primary transition" aria-label="Duplicar">
                            <Copy className="h-3 w-3" />
                            Duplicar
                          </button>
                          <button type="button" onClick={() => deleteSequence(seq.id)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 transition" aria-label="Eliminar">
                            <Trash2 className="h-3 w-3" />
                            Eliminar
                          </button>
                        </div>
                        {viewStepsId === seq.id && (
                          <StepsExpandable sequenceId={seq.id} loadSteps={loadStepsForView} initialSteps={seq.steps} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'active' && (
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-5 space-y-4">
          {loading ? (
            <div className="py-8 text-center theme-text-muted">Cargando...</div>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm theme-text-muted">
                  <span className="font-semibold theme-text-primary">{filteredActiveContactSequences.length}</span>
                  {' '}contactos en secuencia activa
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={activeSearchQuery}
                    onChange={(e) => setActiveSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="w-full sm:w-48 rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-primary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                  <div className="flex rounded-lg ring-1 theme-border overflow-hidden">
                    {(['todos', 'sms', 'llamadas', 'nicho'] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setActiveFilter(f)}
                        className={`px-3 py-1.5 text-xs font-medium transition ${
                          activeFilter === f
                            ? 'bg-[#22c55e] text-[#0b0b0b]'
                            : 'theme-bg-base theme-text-muted hover:theme-text-primary'
                        }`}
                      >
                        {f === 'todos' ? 'Todos' : f === 'sms' ? 'Solo SMS' : f === 'llamadas' ? 'Solo Llamadas' : 'Por nicho'}
                      </button>
                    ))}
                  </div>
                  {activeFilter === 'nicho' && (
                    <select
                      value={activeNichoFilter}
                      onChange={(e) => setActiveNichoFilter(e.target.value)}
                      className="rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-primary ring-1 theme-border"
                    >
                      <option value="">Nicho...</option>
                      {NICHOS.map((n) => (
                        <option key={n.value} value={n.value}>{n.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              {activeContactSequences.length === 0 ? (
                <div className="py-8 text-center theme-text-muted">
                  No hay contactos con secuencia activa.
                </div>
              ) : filteredActiveContactSequences.length === 0 ? (
                <div className="py-8 text-center theme-text-muted">
                  No hay resultados con los filtros aplicados.
                </div>
              ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide theme-text-muted">
                  <tr className="border-b theme-border/80">
                    <th className="px-4 py-3 font-medium">Contacto</th>
                    <th className="px-4 py-3 font-medium">Estrategia</th>
                    <th className="px-4 py-3 font-medium">Paso</th>
                    <th className="px-4 py-3 font-medium">Fecha inicio</th>
                    <th className="px-4 py-3 font-medium">Próximo paso</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActiveContactSequences.map((cs) => {
                    const seqMeta = cs.sequence as {
                      _stepsTotal?: number
                      _steps?: { dia: number; canal: string; hora_envio: string | null }[]
                    }
                    const stepsTotal = seqMeta?._stepsTotal ?? 0
                    const stepsList = seqMeta?._steps ?? []
                    let nextStep: { date: string; canal: string } | null = null
                    if (stepsList.length > 0 && cs.paso_actual < stepsList.length) {
                      const step = stepsList[cs.paso_actual]
                      const d = new Date(cs.fecha_inicio)
                      d.setDate(d.getDate() + step.dia)
                      const [h, m] = (step.hora_envio ?? '09:00').toString().split(':').map(Number)
                      d.setHours(h, m, 0, 0)
                      nextStep = {
                        date: d.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }),
                        canal: step.canal === 'call' ? '📞 Llamada' : '💬 SMS',
                      }
                    }
                    return (
                      <tr
                        key={cs.id}
                        className="border-b theme-border/80 last:border-b-0 hover:bg-zinc-900/30"
                      >
                        <td className="px-4 py-3 theme-text-primary">
                          {(cs.contact as { nombre?: string } | null)?.nombre ?? '—'}
                        </td>
                        <td className="px-4 py-3 theme-text-secondary">
                          {(cs.sequence as { nombre?: string })?.nombre ?? '—'}
                        </td>
                        <td className="px-4 py-3 theme-text-secondary">
                          {cs.paso_actual + 1} / {stepsTotal || '—'}
                        </td>
                        <td className="px-4 py-3 theme-text-secondary">
                          {new Date(cs.fecha_inicio).toLocaleDateString('es')}
                        </td>
                        <td className="px-4 py-3 theme-text-secondary">
                          {nextStep ? `${nextStep.date} (${nextStep.canal})` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => pauseContactSequence(cs.id)}
                              className="rounded-lg px-2 py-1.5 text-xs font-medium text-amber-200 ring-1 ring-amber-500/40 hover:bg-amber-500/10"
                            >
                              Pausar
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelContactSequence(cs.id)}
                              className="rounded-lg px-2 py-1.5 text-xs font-medium text-red-200 ring-1 ring-red-500/40 hover:bg-red-500/10"
                            >
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal Nueva/Editar Estrategia */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="absolute inset-0 bg-black/70"
            aria-label="Cerrar"
          />
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border theme-border/80 theme-bg-card shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b theme-border/80 px-5 py-4 theme-bg-card">
              <div>
                <div className="text-base font-semibold theme-text-primary">
                  {editingId ? 'Editar Estrategia' : 'Nueva Estrategia'}
                </div>
                <div className="mt-1 text-sm theme-text-muted">
                  Configura nombre, nicho, descripción y pasos.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-2 theme-text-muted hover:bg-zinc-900/40 transition"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium theme-text-primary">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    placeholder="Ej: Seguimiento Agua"
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-primary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium theme-text-primary">
                    Nicho
                  </label>
                  <select
                    value={formNicho}
                    onChange={(e) => setFormNicho(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-primary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  >
                    {NICHOS.map((n) => (
                      <option key={n.value} value={n.value}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium theme-text-primary">
                  Descripción
                </label>
                <textarea
                  value={formDescripcion}
                  onChange={(e) => setFormDescripcion(e.target.value)}
                  placeholder="Breve descripción de la estrategia"
                  rows={2}
                  className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-primary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold theme-text-primary">
                    Pasos de la secuencia
                  </span>
                  <button
                    type="button"
                    onClick={addStep}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium theme-accent-text ring-1 ring-[#22c55e]/40 hover:bg-[#22c55e]/10"
                  >
                    <Plus className="h-3 w-3" />
                    Agregar Paso
                  </button>
                </div>
                <div className="rounded-lg border theme-border/80 theme-bg-base overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setVariablesHintOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium theme-text-secondary hover:theme-text-primary transition"
                  >
                    <span>Variables disponibles (clic para insertar en el mensaje)</span>
                    {variablesHintOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                  {variablesHintOpen && (
                    <div className="px-3 pb-3 pt-0 space-y-2 border-t theme-border/80">
                      {VARIABLES_HINT_GROUPS.map((g) => (
                        <div key={g.label}>
                          <div className="text-[10px] uppercase tracking-wide theme-text-muted mb-1">{g.label}</div>
                          <div className="flex flex-wrap gap-1">
                            {g.vars.map((v) => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => {
                                  if (focusedStepIndex !== null) {
                                    updateStep(focusedStepIndex, {
                                      mensaje: formSteps[focusedStepIndex].mensaje + v,
                                    })
                                  }
                                }}
                                className="rounded px-2 py-1 text-xs theme-bg-elevated theme-text-secondary hover:theme-text-primary ring-1 theme-border"
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {stepsWithIndex.map(({ step, originalIndex: idx }, index) => (
                    <div
                      key={idx}
                      className="rounded-xl border theme-border/80 theme-bg-base p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium theme-text-muted">
                          Paso {index + 1} (día {step.dia})
                        </span>
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          disabled={formSteps.length <= 1}
                          className="rounded p-1 text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                          aria-label="Eliminar paso"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-xs theme-text-dim">Día</label>
                          <input
                            type="number"
                            value={step.dia}
                            onChange={(e) =>
                              updateStep(idx, {
                                dia: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="mt-1 w-full rounded-lg theme-bg-base px-2 py-1.5 text-sm theme-text-primary ring-1 theme-border"
                          />
                        </div>
                        <div>
                          <label className="text-xs theme-text-dim">Canal</label>
                          <select
                            value={step.canal}
                            onChange={(e) =>
                              updateStep(idx, {
                                canal: e.target.value as 'sms' | 'call',
                              })
                            }
                            className="mt-1 w-full rounded-lg theme-bg-base px-2 py-1.5 text-sm theme-text-primary ring-1 theme-border"
                          >
                            <option value="sms">💬 SMS</option>
                            <option value="call">📞 Llamada</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs theme-text-dim">Hora envío</label>
                          <input
                            type="time"
                            value={step.hora_envio}
                            onChange={(e) =>
                              updateStep(idx, { hora_envio: e.target.value })
                            }
                            className="mt-1 w-full rounded-lg theme-bg-base px-2 py-1.5 text-sm theme-text-primary ring-1 theme-border"
                          />
                        </div>
                        <div className="flex items-center gap-2 sm:col-span-2">
                          <input
                            type="checkbox"
                            id={`activo-${idx}`}
                            checked={step.activo}
                            onChange={(e) =>
                              updateStep(idx, { activo: e.target.checked })
                            }
                            className="h-4 w-4 rounded border-zinc-600 theme-bg-base text-[#22c55e]"
                          />
                          <label
                            htmlFor={`activo-${idx}`}
                            className="text-sm theme-text-secondary"
                          >
                            Paso activo
                          </label>
                        </div>
                      </div>
<div>
                          <label className="text-xs theme-text-dim">Mensaje</label>
                          <textarea
                            value={step.mensaje}
                            onChange={(e) => updateStep(idx, { mensaje: e.target.value })}
                            onFocus={() => setFocusedStepIndex(idx)}
                            onBlur={() => setFocusedStepIndex(null)}
                            placeholder={
                            step.canal === 'call'
                              ? 'Llamada de seguimiento (opcional nota)'
                              : 'Texto del mensaje. Usa variables si aplica.'
                          }
                          rows={2}
                          className="mt-1 w-full rounded-lg theme-bg-base px-2 py-1.5 text-sm theme-text-primary ring-1 theme-border"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {formError ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {formError}
                </div>
              ) : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium theme-text-muted hover:theme-text-primary transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={saveStrategy}
                  disabled={formSaving}
                  className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition"
                >
                  {formSaving ? 'Guardando...' : 'Guardar Estrategia'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Asignar Estrategia (desde predefinida) */}
      {assignModalSequenceId && (() => {
        const seq = sequences.find((s) => s.id === assignModalSequenceId)
        const needsGoogleLink = sequenceStepsUseVariable(assignSteps, '{google_review_link}')
        const needsHora = sequenceStepsUseVariable(assignSteps, '{hora}')
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
            <button type="button" onClick={closeAssignModal} className="absolute inset-0 bg-black/70" aria-label="Cerrar" />
            <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border theme-border/80 theme-bg-card shadow-2xl">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b theme-border/80 px-5 py-4 theme-bg-card">
                <div>
                  <div className="text-base font-semibold theme-text-primary">Asignar Estrategia</div>
                  <div className="mt-1 text-sm theme-text-muted">{seq?.nombre ?? '—'}</div>
                </div>
                <button type="button" onClick={closeAssignModal} className="rounded-lg p-2 theme-text-muted hover:bg-zinc-900/40" aria-label="Cerrar">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-5 py-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium theme-text-primary">Contacto</label>
                  <select
                    value={assignContactId}
                    onChange={(e) => setAssignContactId(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-primary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  >
                    <option value="">Selecciona un contacto...</option>
                    {assignContacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre ?? 'Sin nombre'}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium theme-text-primary">Fecha de inicio</label>
                  <input
                    type="date"
                    value={assignStartDate}
                    onChange={(e) => setAssignStartDate(e.target.value)}
                    className="w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-primary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  />
                </div>
                {needsGoogleLink && (
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
                {needsHora && (
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
                <div className="space-y-2">
                  <label className="text-sm font-medium theme-text-primary">Preview de pasos</label>
                  <div className="rounded-xl border theme-border/80 theme-bg-base p-3 space-y-2 max-h-48 overflow-y-auto">
                    {assignSteps.map((s, i) => (
                      <div key={s.id} className="flex gap-2 text-xs">
                        <span className="theme-text-muted shrink-0">Día {s.dia}</span>
                        <span>{s.canal === 'call' ? '📞' : '💬'}</span>
                        <span className="theme-text-secondary truncate">
                          {s.mensaje ? `${s.mensaje.slice(0, 50)}${s.mensaje.length > 50 ? '…' : ''}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {assignError ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{assignError}</div>
                ) : null}
              </div>
              <div className="flex justify-end gap-2 border-t theme-border/80 px-5 py-4">
                <button type="button" onClick={closeAssignModal} className="rounded-lg px-4 py-2 text-sm font-medium theme-text-muted hover:theme-text-primary transition">Cancelar</button>
                <button
                  type="button"
                  onClick={onActivateAssignSequence}
                  disabled={assignSaving}
                  className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition"
                >
                  {assignSaving ? 'Activando...' : 'Activar Secuencia'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      <UpgradePlanModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        userPlan={userPlan}
      />
    </section>
  )
}

function StepsExpandable({
  sequenceId,
  loadSteps,
  initialSteps,
}: {
  sequenceId: string
  loadSteps: (id: string) => Promise<SequenceStep[]>
  initialSteps?: SequenceStep[] | undefined
}) {
  const [steps, setSteps] = useState<SequenceStep[]>(() => Array.isArray(initialSteps) ? initialSteps : [])
  const [loading, setLoading] = useState(() => !initialSteps || initialSteps.length === 0)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!sequenceId) return
    // Si ya tenemos pasos cargados (initialSteps), no hacer fetch
    if (Array.isArray(initialSteps) && initialSteps.length > 0) {
      setSteps(initialSteps)
      setLoading(false)
      setError(null)
      return
    }
    let mounted = true
    setLoading(true)
    setError(null)
    loadSteps(sequenceId)
      .then((data) => {
        if (mounted) {
          setSteps(Array.isArray(data) ? data : [])
          setLoading(false)
        }
      })
      .catch((e) => {
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Error al cargar pasos')
          setSteps([])
          setLoading(false)
        }
      })
    return () => {
      mounted = false
    }
  }, [sequenceId, loadSteps, initialSteps])
  if (loading) return <div className="text-xs theme-text-dim mt-2">Cargando pasos...</div>
  if (error) {
    return (
      <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        {error}
      </div>
    )
  }
  if (steps.length === 0) {
    return <div className="text-xs theme-text-dim mt-2">No hay pasos en esta estrategia.</div>
  }
  return (
    <div className="mt-3 border-l-2 border-[#22c55e]/40 pl-4 space-y-4">
      {steps.map((s, i) => (
        <div key={s.id ?? i} className="relative">
          <div className="absolute -left-[21px] w-3 h-3 rounded-full border-2 border-[#22c55e]/60 bg-[#0b0b0b]" />
          <div className="text-xs theme-text-muted">
            Día {s.dia} · {s.canal === 'call' ? '📞 Llamada' : '💬 SMS'}
            {s.hora_envio ? ` · ${String(s.hora_envio).slice(0, 5)}` : ''}
          </div>
          {s.mensaje ? (
            <div className="mt-0.5 rounded-lg theme-bg-base px-2 py-1.5 text-xs theme-text-secondary border theme-border/80">
              {s.mensaje.length > 200 ? `${s.mensaje.slice(0, 200)}…` : s.mensaje}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
