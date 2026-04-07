import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type InboundAgentRow = {
  id: string
  user_id: string
  agente_tipo: string | null
  nombre_analista: string | null
  tiene_equipo: boolean | null
  activo: boolean | null
  phone_number: string | null
  descripcion: string | null
  configuracion: Record<string, unknown> | null
  retell_agent_id: string | null
  created_at?: string
}

type UserIntegrations = {
  calcom_api_key: string | null
  calcom_event_type_id: string | null
  calcom_username: string | null
}

type AgentTipoKey =
  | 'door_hanger_agua'
  | 'solo_agendar'
  | 'atencion_cliente'
  | 'servicios_domicilio'
  | 'restaurante'

const TIPO_META: Record<
  AgentTipoKey,
  {
    label: string
    emoji: string
    badgeColor: string
    borderColor: string
    descripcionCorta: string
    requiereCalcom?: boolean
  }
> = {
  door_hanger_agua: {
    label: 'Door Hanger — Agua',
    emoji: '🚿',
    badgeColor: 'bg-cyan-500/20 text-cyan-300',
    borderColor: 'border-cyan-500/30',
    descripcionCorta:
      'Recibe llamadas de door hangers, identifica al técnico y agenda un análisis gratuito del agua.',
    requiereCalcom: true,
  },
  solo_agendar: {
    label: 'Solo Agendar — Médico/Legal',
    emoji: '📅',
    badgeColor: 'bg-emerald-500/20 text-emerald-300',
    borderColor: 'border-emerald-500/30',
    descripcionCorta:
      'Agenda citas para consultorios médicos y despachos legales sin intervención humana.',
    requiereCalcom: true,
  },
  atencion_cliente: {
    label: 'Atención al Cliente / FAQ',
    emoji: '📞',
    badgeColor: 'bg-violet-500/20 text-violet-300',
    borderColor: 'border-violet-500/30',
    descripcionCorta:
      'Responde preguntas frecuentes y transfiere llamadas complejas al número indicado.',
  },
  servicios_domicilio: {
    label: 'Servicios a Domicilio',
    emoji: '🏠',
    badgeColor: 'bg-orange-500/20 text-orange-300',
    borderColor: 'border-orange-500/30',
    descripcionCorta:
      'Filtra emergencias y solicitudes para servicios a domicilio y alerta al técnico correspondiente.',
  },
  restaurante: {
    label: 'Recepcionista — Restaurante',
    emoji: '🍽️',
    badgeColor: 'bg-red-500/20 text-red-300',
    borderColor: 'border-red-500/30',
    descripcionCorta:
      'Gestiona reservas y pedidos para llevar, respondiendo preguntas básicas del cliente.',
  },
}

type CreateStep = 1 | 2 | 3
type Genero = 'femenino' | 'masculino'

type Stats = {
  totalLlamadas: number
  citasAgendadas: number
  llamadasSemana: number
}

export default function InboundAgents() {
  const [agents, setAgents] = useState<InboundAgentRow[]>([])
  const [hasCalcom, setHasCalcom] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [savingToggle, setSavingToggle] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [createStep, setCreateStep] = useState<CreateStep>(1)
  const [createTipo, setCreateTipo] = useState<AgentTipoKey | null>(null)
  const [createNombre, setCreateNombre] = useState('')
  const [createGenero, setCreateGenero] = useState<Genero>('femenino')

  const [cfgTieneEquipo, setCfgTieneEquipo] = useState(false)
  const [cfgNombreRepresentante, setCfgNombreRepresentante] = useState('')
  const [cfgEspecialidad, setCfgEspecialidad] = useState('')
  const [cfgHorario, setCfgHorario] = useState('')
  const [cfgTelefonoTransferencia, setCfgTelefonoTransferencia] = useState('')
  const [cfgFaq, setCfgFaq] = useState('')
  const [cfgServicios, setCfgServicios] = useState('')
  const [cfgTelefonoTecnico, setCfgTelefonoTecnico] = useState('')
  const [cfgHorarioRestaurante, setCfgHorarioRestaurante] = useState('')
  const [cfgAceptaReservas, setCfgAceptaReservas] = useState(true)
  const [cfgAceptaTakeout, setCfgAceptaTakeout] = useState(true)

  const [createSaving, setCreateSaving] = useState(false)

  const [selectedAgent, setSelectedAgent] = useState<InboundAgentRow | null>(null)
  const [selectedTab, setSelectedTab] = useState<'info' | 'config' | 'stats'>(
    'info',
  )
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        const userId = session?.user?.id
        if (!userId) throw new Error('No hay sesión activa.')

        const [{ data: agentsData, error: agentsError }, { data: integ }] =
          await Promise.all([
            supabase
              .from('inbound_agents')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: true }),
            supabase
              .from('user_integrations')
              .select('calcom_api_key, calcom_event_type_id, calcom_username')
              .eq('user_id', userId)
              .maybeSingle(),
          ])

        if (agentsError) throw agentsError
        if (!mounted) return

        setAgents((agentsData ?? []) as InboundAgentRow[])
        const integRow = (integ ?? null) as UserIntegrations | null
        setHasCalcom(
          !!(
            integRow?.calcom_api_key &&
            integRow.calcom_api_key.trim().length > 0
          ),
        )
      } catch (e) {
        if (!mounted) return
        setError(
          e instanceof Error ? e.message : 'Error al cargar los agentes inbound.',
        )
        setAgents([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  const hasAgents = agents.length > 0

  const createTipoMeta = useMemo(
    () => (createTipo ? TIPO_META[createTipo] : null),
    [createTipo],
  )

  function openCreateModal() {
    setCreateOpen(true)
    setCreateStep(1)
    setCreateTipo(null)
    setCreateNombre('')
    setCreateGenero('femenino')
    setCfgTieneEquipo(false)
    setCfgNombreRepresentante('')
    setCfgEspecialidad('')
    setCfgHorario('')
    setCfgTelefonoTransferencia('')
    setCfgFaq('')
    setCfgServicios('')
    setCfgTelefonoTecnico('')
    setCfgHorarioRestaurante('')
    setCfgAceptaReservas(true)
    setCfgAceptaTakeout(true)
    setError(null)
  }

  function closeCreateModal() {
    setCreateOpen(false)
  }

  async function handleToggleActive(agent: InboundAgentRow) {
    setSavingToggle(agent.id)
    try {
      const { error: sessionError, data } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const userId = data.session?.user?.id
      if (!userId) throw new Error('No hay sesión.')
      const { error } = await supabase
        .from('inbound_agents')
        .update({ activo: !agent.activo })
        .eq('id', agent.id)
        .eq('user_id', userId)
      if (error) throw error
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id ? { ...a, activo: !agent.activo } : a,
        ),
      )
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Error al actualizar el estado del agente.',
      )
    } finally {
      setSavingToggle(null)
    }
  }

  function buildConfiguracion(tipo: AgentTipoKey) {
    const cfg: Record<string, unknown> = {
      agent_gender: createGenero,
    }
    if (tipo === 'door_hanger_agua') {
      cfg.tiene_equipo_codigos = cfgTieneEquipo
      if (!cfgTieneEquipo && cfgNombreRepresentante.trim()) {
        cfg.nombre_representante = cfgNombreRepresentante.trim()
      }
    }
    if (tipo === 'solo_agendar') {
      if (cfgEspecialidad.trim()) cfg.especialidad = cfgEspecialidad.trim()
    }
    if (tipo === 'atencion_cliente') {
      if (cfgHorario.trim()) cfg.horario = cfgHorario.trim()
      if (cfgTelefonoTransferencia.trim())
        cfg.telefono_transferencia = cfgTelefonoTransferencia.trim()
      if (cfgFaq.trim()) cfg.faq = cfgFaq.trim()
    }
    if (tipo === 'servicios_domicilio') {
      if (cfgServicios.trim()) cfg.servicios = cfgServicios.trim()
      if (cfgTelefonoTecnico.trim())
        cfg.telefono_tecnico = cfgTelefonoTecnico.trim()
    }
    if (tipo === 'restaurante') {
      if (cfgHorarioRestaurante.trim())
        cfg.horario = cfgHorarioRestaurante.trim()
      cfg.acepta_reservas = cfgAceptaReservas
      cfg.acepta_takeout = cfgAceptaTakeout
    }
    return cfg
  }

  async function handleCreateAgent() {
    if (!createTipo) {
      setError('Selecciona un tipo de agente.')
      return
    }
    if (!createNombre.trim()) {
      setError('Escribe un nombre para el agente.')
      return
    }
    setCreateSaving(true)
    setError(null)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const userId = session?.user?.id
      if (!userId) throw new Error('No hay sesión activa.')

      const configuracion = buildConfiguracion(createTipo)

      const payload = {
        user_id: userId,
        agente_tipo: createTipo,
        nombre_analista: createNombre.trim(),
        tiene_equipo: createTipo === 'door_hanger_agua' ? cfgTieneEquipo : false,
        activo: false,
        phone_number: null,
        descripcion: TIPO_META[createTipo].descripcionCorta,
        configuracion,
      }

      const { data, error } = await supabase
        .from('inbound_agents')
        .insert(payload)
        .select()
      if (error) throw error
      const inserted = (data ?? []) as InboundAgentRow[]
      setAgents((prev) => [...prev, ...inserted])
      setCreateOpen(false)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Error al crear el agente inbound.',
      )
    } finally {
      setCreateSaving(false)
    }
  }

  function openConfigModal(agent: InboundAgentRow) {
    setSelectedAgent(agent)
    setSelectedTab('info')
    const cfg = (agent.configuracion ?? {}) as Record<string, unknown>
    const genero = (cfg.agent_gender as Genero) || 'femenino'
    setCreateGenero(genero)
    setCreateNombre(agent.nombre_analista ?? '')
    const tipo = (agent.agente_tipo ?? 'door_hanger_agua') as AgentTipoKey
    if (tipo === 'door_hanger_agua') {
      setCfgTieneEquipo(Boolean(agent.tiene_equipo || cfg.tiene_equipo_codigos))
      setCfgNombreRepresentante((cfg.nombre_representante as string) ?? '')
    } else {
      setCfgTieneEquipo(false)
      setCfgNombreRepresentante('')
    }
    setCfgEspecialidad(
      (cfg.especialidad as string) ??
        (agent.agente_tipo === 'solo_agendar' ? agent.descripcion ?? '' : ''),
    )
    setCfgHorario((cfg.horario as string) ?? '')
    setCfgTelefonoTransferencia(
      (cfg.telefono_transferencia as string) ?? '',
    )
    setCfgFaq((cfg.faq as string) ?? '')
    setCfgServicios((cfg.servicios as string) ?? '')
    setCfgTelefonoTecnico((cfg.telefono_tecnico as string) ?? '')
    setCfgHorarioRestaurante((cfg.horario as string) ?? '')
    setCfgAceptaReservas(
      (cfg.acepta_reservas as boolean) ?? true,
    )
    setCfgAceptaTakeout(
      (cfg.acepta_takeout as boolean) ?? true,
    )
    setStats(null)
  }

  function closeConfigModal() {
    setSelectedAgent(null)
  }

  async function loadStats() {
    if (!selectedAgent) return
    setLoadingStats(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const userId = session?.user?.id
      if (!userId) throw new Error('No hay sesión.')

      const now = new Date()
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(now)
      monday.setDate(diff)
      monday.setHours(0, 0, 0, 0)

      const [
        { count: totalLlamadas },
        { count: llamadasSemana },
        { count: citasAgendadas },
      ] = await Promise.all([
        supabase
          .from('call_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),
        supabase
          .from('call_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', monday.toISOString()),
        supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'scheduled'),
      ])

      setStats({
        totalLlamadas: totalLlamadas ?? 0,
        llamadasSemana: llamadasSemana ?? 0,
        citasAgendadas: citasAgendadas ?? 0,
      })
    } catch {
      setStats(null)
    } finally {
      setLoadingStats(false)
    }
  }

  async function saveConfigChanges() {
    if (!selectedAgent) return
    const tipo = (selectedAgent.agente_tipo ??
      'door_hanger_agua') as AgentTipoKey
    if (!createNombre.trim()) {
      setError('El nombre del agente es obligatorio.')
      return
    }
    setSavingConfig(true)
    setError(null)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const userId = session?.user?.id
      if (!userId) throw new Error('No hay sesión.')

      const configuracion = buildConfiguracion(tipo)
      const { error } = await supabase
        .from('inbound_agents')
        .update({
          nombre_analista: createNombre.trim(),
          tiene_equipo: tipo === 'door_hanger_agua' ? cfgTieneEquipo : false,
          configuracion,
        })
        .eq('id', selectedAgent.id)
        .eq('user_id', userId)
      if (error) throw error
      setAgents((prev) =>
        prev.map((a) =>
          a.id === selectedAgent.id
            ? {
                ...a,
                nombre_analista: createNombre.trim(),
                tiene_equipo: tipo === 'door_hanger_agua' ? cfgTieneEquipo : false,
                configuracion,
              }
            : a,
        ),
      )
      setSelectedAgent((a) =>
        a
          ? {
              ...a,
              nombre_analista: createNombre.trim(),
              tiene_equipo: tipo === 'door_hanger_agua' ? cfgTieneEquipo : false,
              configuracion,
            }
          : a,
      )
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Error al guardar la configuración del agente.',
      )
    } finally {
      setSavingConfig(false)
    }
  }

  function renderTipoBadges(agent: InboundAgentRow) {
    const tipo = (agent.agente_tipo ?? 'door_hanger_agua') as AgentTipoKey
    const meta = TIPO_META[tipo]
    const estadoClass = agent.activo
      ? 'bg-emerald-500/15 text-emerald-300'
      : 'bg-zinc-600/20 theme-text-muted'
    const estadoLabel = agent.activo ? 'Activo' : 'Inactivo'
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${meta.badgeColor}`}
        >
          INBOUND
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${estadoClass}`}
        >
          {estadoLabel}
        </span>
      </div>
    )
  }

  function renderAgentCard(agent: InboundAgentRow) {
    const tipo = (agent.agente_tipo ?? 'door_hanger_agua') as AgentTipoKey
    const meta = TIPO_META[tipo]
    const cfg = (agent.configuracion ?? {}) as Record<string, unknown>
    const genero = (cfg.agent_gender as Genero) ?? 'femenino'
    const generoLabel = genero === 'femenino' ? 'femenino' : 'masculino'
    const especialidad =
      (cfg.especialidad as string) ||
      (cfg.nombre_representante as string) ||
      agent.descripcion ||
      ''
    const requiereCalcom = meta.requiereCalcom && !hasCalcom

    return (
      <div
        key={agent.id}
        className={`rounded-2xl border theme-border/80 theme-bg-card p-5 ${meta.borderColor}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{meta.emoji}</span>
              <div>
                <div className="text-sm font-semibold theme-text-primary">
                  {meta.label}
                </div>
                {renderTipoBadges(agent)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm theme-text-muted">
          <div>
            <span className="mr-1 theme-text-dim">📞 Número:</span>
            {agent.phone_number ? (
              <span className="font-mono text-xs theme-text-secondary">
                {agent.phone_number}
              </span>
            ) : (
              <span className="theme-text-dim">Sin número asignado</span>
            )}
          </div>
          <div>
            <span className="mr-1 theme-text-dim">👤</span>
            <span className="theme-text-secondary">
              {agent.nombre_analista || 'Sin nombre'} ({generoLabel})
            </span>
          </div>
          {especialidad && (
            <div className="text-xs theme-text-muted">📝 {especialidad}</div>
          )}
          <div className="pt-1 text-xs theme-text-muted">
            {agent.descripcion ?? meta.descripcionCorta}
          </div>
          {requiereCalcom && (
            <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              ⚠️ Este agente requiere Cal.com configurado en la sección de
              Integraciones.
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => openConfigModal(agent)}
            className="text-sm font-medium text-[#22c55e] hover:underline"
          >
            Configurar →
          </button>
          <button
            type="button"
            onClick={() => void handleToggleActive(agent)}
            disabled={savingToggle === agent.id}
            className={
              'rounded-full px-3 py-1.5 text-xs font-semibold transition ' +
              (agent.activo
                ? 'bg-[#22c55e]/20 text-[#22c55e]'
                : 'bg-zinc-700/40 theme-text-muted')
            }
          >
            {savingToggle === agent.id
              ? 'Guardando...'
              : agent.activo
                ? 'Activo'
                : 'Inactivo'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">
            Recepcionista Virtual 24/7
          </h1>
          <p className="mt-1 text-sm theme-text-muted">
            Configura los agentes que atienden tus llamadas entrantes como una recepcionista virtual siempre disponible.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
        >
          + Agregar agente
        </button>
      </div>

      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-xl">📲</div>
          <div>
            <h2 className="text-sm font-semibold theme-text-primary">
              ¿Qué es tu recepcionista virtual 24/7?
            </h2>
            <p className="mt-1 text-xs theme-text-muted">
              Tu agente contesta las llamadas que recibe tu número, identifica la
              necesidad del prospecto y agenda la cita automáticamente — 24/7.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-6">
          <div>
            <div className="text-sm font-medium theme-text-primary">📲 Inbound</div>
            <div className="text-xs theme-text-dim">Recibe llamadas</div>
          </div>
          <div>
            <div className="text-sm font-medium theme-text-primary">🕐 24/7</div>
            <div className="text-xs theme-text-dim">Sin horario límite</div>
          </div>
          <div>
            <div className="text-sm font-medium theme-text-primary">📅 Auto</div>
            <div className="text-xs theme-text-dim">Agenda solo</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-6 text-sm theme-text-muted">
          Cargando agentes inbound...
        </div>
      ) : !hasAgents ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed theme-border/80 theme-bg-card px-6 py-16 text-center">
          <div className="text-4xl mb-3">📲</div>
          <h2 className="text-lg font-semibold theme-text-primary">
            Sin agentes inbound
          </h2>
          <p className="mt-2 max-w-md text-sm theme-text-muted">
            Agrega tu primer agente para empezar a recibir llamadas
            automáticamente.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-6 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
          >
            + Agregar mi primer agente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {agents.map((a) => renderAgentCard(a))}
        </div>
      )}

      {/* Modal crear agente */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-3xl rounded-2xl border theme-border/80 theme-bg-card p-5">
            <div className="flex items-start justify-between gap-3 border-b theme-border/80 pb-3">
              <div>
                <div className="text-base font-semibold theme-text-primary">
                  Nuevo agente inbound
                </div>
                <div className="mt-1 text-xs theme-text-muted">
                  Paso {createStep} de 3
                </div>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-lg p-2 theme-text-muted hover:bg-zinc-900/60 hover:theme-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-6">
              {createStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold theme-text-primary">
                      ¿Qué tipo de agente necesitas?
                    </div>
                    <div className="mt-1 text-xs theme-text-muted">
                      Elige el flujo que mejor se adapta a tu negocio.
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {/* Door hanger */}
                    <button
                      type="button"
                      onClick={() => setCreateTipo('door_hanger_agua')}
                      className={
                        'text-left rounded-2xl border p-4 transition ' +
                        (createTipo === 'door_hanger_agua'
                          ? 'border-cyan-500/60 bg-cyan-500/5'
                          : 'theme-border/80 theme-bg-base hover:border-zinc-700')
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold theme-text-primary">
                            🚿 Door Hanger — Agua
                          </div>
                          <p className="mt-1 text-xs theme-text-muted">
                            Para empresas de agua que usan tarjetas door hanger.
                          </p>
                          <p className="mt-1 text-[11px] theme-text-dim">
                            Requiere: Cal.com + técnicos o analista
                          </p>
                        </div>
                        <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                          INBOUND
                        </span>
                      </div>
                    </button>
                    {/* Solo agendar */}
                    <button
                      type="button"
                      onClick={() => setCreateTipo('solo_agendar')}
                      className={
                        'text-left rounded-2xl border p-4 transition ' +
                        (createTipo === 'solo_agendar'
                          ? 'border-emerald-500/60 bg-emerald-500/5'
                          : 'theme-border/80 theme-bg-base hover:border-zinc-700')
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold theme-text-primary">
                            📅 Solo Agendar — Médico/Legal
                          </div>
                          <p className="mt-1 text-xs theme-text-muted">
                            Para consultorios y despachos que reciben citas por
                            teléfono.
                          </p>
                          <p className="mt-1 text-[11px] theme-text-dim">
                            Requiere: Cal.com configurado
                          </p>
                        </div>
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          INBOUND
                        </span>
                      </div>
                    </button>
                    {/* Atención cliente */}
                    <button
                      type="button"
                      onClick={() => setCreateTipo('atencion_cliente')}
                      className={
                        'text-left rounded-2xl border p-4 transition ' +
                        (createTipo === 'atencion_cliente'
                          ? 'border-violet-500/60 bg-violet-500/5'
                          : 'theme-border/80 theme-bg-base hover:border-zinc-700')
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold theme-text-primary">
                            📞 Atención al Cliente / FAQ
                          </div>
                          <p className="mt-1 text-xs theme-text-muted">
                            Responde preguntas frecuentes y transfiere llamadas
                            complejas.
                          </p>
                          <p className="mt-1 text-[11px] theme-text-dim">
                            Requiere: teléfono de transferencia
                          </p>
                        </div>
                        <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                          INBOUND
                        </span>
                      </div>
                    </button>
                    {/* Servicios domicilio */}
                    <button
                      type="button"
                      onClick={() => setCreateTipo('servicios_domicilio')}
                      className={
                        'text-left rounded-2xl border p-4 transition ' +
                        (createTipo === 'servicios_domicilio'
                          ? 'border-orange-500/60 bg-orange-500/5'
                          : 'theme-border/80 theme-bg-base hover:border-zinc-700')
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold theme-text-primary">
                            🏠 Servicios a Domicilio
                          </div>
                          <p className="mt-1 text-xs theme-text-muted">
                            Captura solicitudes y alerta al técnico
                            correspondiente.
                          </p>
                          <p className="mt-1 text-[11px] theme-text-dim">
                            Requiere: teléfono del técnico
                          </p>
                        </div>
                        <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-300">
                          INBOUND
                        </span>
                      </div>
                    </button>
                    {/* Restaurante */}
                    <button
                      type="button"
                      onClick={() => setCreateTipo('restaurante')}
                      className={
                        'text-left rounded-2xl border p-4 transition ' +
                        (createTipo === 'restaurante'
                          ? 'border-red-500/60 bg-red-500/5'
                          : 'theme-border/80 theme-bg-base hover:border-zinc-700')
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold theme-text-primary">
                            🍽️ Recepcionista — Restaurante
                          </div>
                          <p className="mt-1 text-xs theme-text-muted">
                            Toma reservas, responde preguntas y pedidos para
                            llevar.
                          </p>
                          <p className="mt-1 text-[11px] theme-text-dim">
                            Requiere: horarios del negocio
                          </p>
                        </div>
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                          INBOUND
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {createStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold theme-text-primary">
                      Configuración básica
                    </div>
                    {createTipoMeta && (
                      <p className="mt-1 text-xs theme-text-muted">
                        {createTipoMeta.emoji} {createTipoMeta.label}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm theme-text-muted">
                        Nombre del agente
                      </label>
                      <input
                        value={createNombre}
                        onChange={(e) => setCreateNombre(e.target.value)}
                        placeholder="Sofia, Alex, Maria..."
                        className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                      />
                    </div>
                    <div>
                      <div className="text-sm theme-text-muted">Género</div>
                      <div className="mt-1 inline-flex rounded-full theme-bg-base p-1 ring-1 ring-zinc-800/80">
                        <button
                          type="button"
                          onClick={() => setCreateGenero('femenino')}
                          className={
                            'px-3 py-1 text-xs font-medium rounded-full ' +
                            (createGenero === 'femenino'
                              ? 'bg-zinc-200 text-[#0b0b0b]'
                              : 'theme-text-muted hover:bg-zinc-900/60')
                          }
                        >
                          👩 Femenina
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreateGenero('masculino')}
                          className={
                            'px-3 py-1 text-xs font-medium rounded-full ' +
                            (createGenero === 'masculino'
                              ? 'bg-zinc-200 text-[#0b0b0b]'
                              : 'theme-text-muted hover:bg-zinc-900/60')
                          }
                        >
                          👨 Masculina
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Campos específicos */}
                  {createTipo === 'door_hanger_agua' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm theme-text-muted">
                          ¿Tienes equipo con códigos?
                        </span>
                        <button
                          type="button"
                          onClick={() => setCfgTieneEquipo((v) => !v)}
                          className={
                            'rounded-full px-3 py-1.5 text-xs font-semibold transition ' +
                            (cfgTieneEquipo
                              ? 'bg-[#22c55e]/20 text-[#22c55e]'
                              : 'bg-zinc-700/40 theme-text-muted')
                          }
                        >
                          {cfgTieneEquipo ? 'Sí' : 'No'}
                        </button>
                      </div>
                      {!cfgTieneEquipo && (
                        <div>
                          <label className="text-sm theme-text-muted">
                            Nombre del representante
                          </label>
                          <input
                            value={cfgNombreRepresentante}
                            onChange={(e) =>
                              setCfgNombreRepresentante(e.target.value)
                            }
                            placeholder="Ej. Carlos, Sofia..."
                            className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {createTipo === 'solo_agendar' && (
                    <div>
                      <label className="text-sm theme-text-muted">Especialidad</label>
                      <input
                        value={cfgEspecialidad}
                        onChange={(e) => setCfgEspecialidad(e.target.value)}
                        placeholder="Médico familiar, Abogado de inmigración..."
                        className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                      />
                    </div>
                  )}

                  {createTipo === 'atencion_cliente' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm theme-text-muted">
                          Horario de atención
                        </label>
                        <input
                          value={cfgHorario}
                          onChange={(e) => setCfgHorario(e.target.value)}
                          placeholder="Lun-Vie 9am-6pm"
                          className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        />
                      </div>
                      <div>
                        <label className="text-sm theme-text-muted">
                          Teléfono de transferencia
                        </label>
                        <input
                          value={cfgTelefonoTransferencia}
                          onChange={(e) =>
                            setCfgTelefonoTransferencia(e.target.value)
                          }
                          placeholder="+1(305)..."
                          className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        />
                      </div>
                      <div>
                        <label className="text-sm theme-text-muted">
                          Preguntas frecuentes
                        </label>
                        <textarea
                          value={cfgFaq}
                          onChange={(e) => setCfgFaq(e.target.value)}
                          rows={4}
                          placeholder={'Horarios: ...\nPrecios: ...'}
                          className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {createTipo === 'servicios_domicilio' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm theme-text-muted">
                          Tipos de servicio
                        </label>
                        <input
                          value={cfgServicios}
                          onChange={(e) => setCfgServicios(e.target.value)}
                          placeholder="Plomería, electricidad, HVAC"
                          className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        />
                      </div>
                      <div>
                        <label className="text-sm theme-text-muted">
                          Teléfono del técnico
                        </label>
                        <input
                          value={cfgTelefonoTecnico}
                          onChange={(e) => setCfgTelefonoTecnico(e.target.value)}
                          placeholder="+1(305)..."
                          className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        />
                      </div>
                    </div>
                  )}

                  {createTipo === 'restaurante' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm theme-text-muted">Horarios</label>
                        <input
                          value={cfgHorarioRestaurante}
                          onChange={(e) =>
                            setCfgHorarioRestaurante(e.target.value)
                          }
                          placeholder="9am-10pm"
                          className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm theme-text-muted">
                          ¿Acepta reservas?
                        </span>
                        <button
                          type="button"
                          onClick={() => setCfgAceptaReservas((v) => !v)}
                          className={
                            'rounded-full px-3 py-1.5 text-xs font-semibold transition ' +
                            (cfgAceptaReservas
                              ? 'bg-[#22c55e]/20 text-[#22c55e]'
                              : 'bg-zinc-700/40 theme-text-muted')
                          }
                        >
                          {cfgAceptaReservas ? 'Sí' : 'No'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm theme-text-muted">
                          ¿Acepta pedidos para llevar?
                        </span>
                        <button
                          type="button"
                          onClick={() => setCfgAceptaTakeout((v) => !v)}
                          className={
                            'rounded-full px-3 py-1.5 text-xs font-semibold transition ' +
                            (cfgAceptaTakeout
                              ? 'bg-[#22c55e]/20 text-[#22c55e]'
                              : 'bg-zinc-700/40 theme-text-muted')
                          }
                        >
                          {cfgAceptaTakeout ? 'Sí' : 'No'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {createStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <div className="text-sm font-semibold theme-text-primary">
                      Confirmar agente
                    </div>
                    {createTipoMeta && (
                      <p className="mt-1 text-xs theme-text-muted">
                        {createTipoMeta.emoji} {createTipoMeta.label}
                      </p>
                    )}
                  </div>
                  <div className="rounded-2xl border theme-border/80 theme-bg-base p-4 text-sm theme-text-muted">
                    <div>
                      <span className="font-semibold theme-text-primary">
                        Nombre del agente:
                      </span>{' '}
                      {createNombre || '—'}
                    </div>
                    <div className="mt-1">
                      <span className="font-semibold theme-text-primary">Género:</span>{' '}
                      {createGenero === 'femenino' ? 'Femenino' : 'Masculino'}
                    </div>
                    {createTipo === 'solo_agendar' && (
                      <div className="mt-1">
                        <span className="font-semibold theme-text-primary">
                          Especialidad:
                        </span>{' '}
                        {cfgEspecialidad || '—'}
                      </div>
                    )}
                    {createTipo === 'door_hanger_agua' && (
                      <div className="mt-1">
                        <span className="font-semibold theme-text-primary">
                          Equipo con códigos:
                        </span>{' '}
                        {cfgTieneEquipo ? 'Sí' : 'No'}
                      </div>
                    )}
                    <p className="mt-4 text-xs theme-text-muted">
                      ✅ Tu agente quedará configurado.
                      <br />
                      ⚠️ Para activarlo necesitas un número de teléfono asignado
                      por el administrador.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t theme-border/80 pt-4">
              <button
                type="button"
                onClick={closeCreateModal}
                className="text-xs font-medium theme-text-muted hover:theme-text-primary"
              >
                Cancelar
              </button>
              <div className="flex items-center gap-2">
                {createStep > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setCreateStep((s) => (s === 1 ? 1 : ((s - 1) as CreateStep)))
                    }
                    className="rounded-lg px-3 py-2 text-xs font-medium theme-text-secondary ring-1 ring-zinc-700/80 hover:bg-zinc-800/60"
                  >
                    Atrás
                  </button>
                )}
                {createStep < 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (createStep === 1 && !createTipo) {
                        setError('Selecciona un tipo de agente para continuar.')
                        return
                      }
                      if (createStep === 2 && !createNombre.trim()) {
                        setError('El nombre del agente es obligatorio.')
                        return
                      }
                      setError(null)
                      setCreateStep((s) => ((s + 1) as CreateStep))
                    }}
                    className="rounded-lg bg-[#22c55e] px-4 py-2 text-xs font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
                  >
                    Siguiente
                  </button>
                )}
                {createStep === 3 && (
                  <button
                    type="button"
                    onClick={handleCreateAgent}
                    disabled={createSaving}
                    className="rounded-lg bg-[#22c55e] px-4 py-2 text-xs font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition"
                  >
                    {createSaving ? 'Creando...' : 'Crear agente'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal configurar agente existente */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-3xl rounded-2xl border theme-border/80 theme-bg-card p-5">
            <div className="flex items-start justify-between gap-3 border-b theme-border/80 pb-3">
              <div>
                <div className="text-base font-semibold theme-text-primary">
                  Configurar agente inbound
                </div>
                <div className="mt-1 text-xs theme-text-muted">
                  {(selectedAgent.agente_tipo ?? '') in TIPO_META
                    ? TIPO_META[
                        (selectedAgent.agente_tipo ??
                          'door_hanger_agua') as AgentTipoKey
                      ].label
                    : selectedAgent.agente_tipo}
                </div>
              </div>
              <button
                type="button"
                onClick={closeConfigModal}
                className="rounded-lg p-2 theme-text-muted hover:bg-zinc-900/60 hover:theme-text-primary"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 border-b theme-border/80 pb-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedTab('info')}
                className={
                  'rounded-full px-3 py-1 font-medium ' +
                  (selectedTab === 'info'
                    ? 'bg-zinc-200 text-[#0b0b0b]'
                    : 'theme-text-muted hover:bg-zinc-800/70')
                }
              >
                ¿Cómo funciona?
              </button>
              <button
                type="button"
                onClick={() => setSelectedTab('config')}
                className={
                  'rounded-full px-3 py-1 font-medium ' +
                  (selectedTab === 'config'
                    ? 'bg-zinc-200 text-[#0b0b0b]'
                    : 'theme-text-muted hover:bg-zinc-800/70')
                }
              >
                Configuración
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedTab('stats')
                  void loadStats()
                }}
                className={
                  'rounded-full px-3 py-1 font-medium ' +
                  (selectedTab === 'stats'
                    ? 'bg-zinc-200 text-[#0b0b0b]'
                    : 'theme-text-muted hover:bg-zinc-800/70')
                }
              >
                Estadísticas
              </button>
            </div>

            <div className="mt-4 max-h-[60vh] overflow-y-auto space-y-4 pr-1">
              {selectedTab === 'info' && selectedAgent && (
                <div className="space-y-4 text-xs theme-text-muted">
                  {selectedAgent.agente_tipo === 'door_hanger_agua' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold theme-text-primary">
                        ¿Cómo funciona este agente?
                      </h3>
                      <ol className="list-decimal space-y-1 pl-5">
                        <li>El prospecto llama al número asignado al agente.</li>
                        <li>
                          El agente saluda usando el nombre de tu empresa y se
                          presenta.
                        </li>
                        <li>
                          Menciona contaminantes de agua comunes detectados en el
                          área para generar conciencia.
                        </li>
                        <li>
                          Pide el código del door hanger si trabajas con equipo de
                          técnicos (o usa el nombre del representante si no
                          tienes equipo).
                        </li>
                        <li>
                          Ofrece un análisis gratuito del agua en el domicilio del
                          cliente.
                        </li>
                        <li>
                          Agenda la visita en tu calendario de Cal.com, dejando
                          todos los datos listos para el técnico.
                        </li>
                      </ol>
                      <div className="mt-3 space-y-1 text-[11px] theme-text-dim">
                        <p>⏱️ Duración promedio: 3–5 minutos</p>
                        <p>🌎 Idiomas: Español + Inglés automático</p>
                        <p>📅 Requiere: Cal.com configurado</p>
                      </div>
                    </div>
                  )}

                  {selectedAgent.agente_tipo === 'solo_agendar' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold theme-text-primary">
                        ¿Cómo funciona este agente?
                      </h3>
                      <ol className="list-decimal space-y-1 pl-5">
                        <li>El cliente llama al número del consultorio o despacho.</li>
                        <li>El agente saluda con el nombre de tu empresa.</li>
                        <li>Pregunta el motivo de la visita o consulta.</li>
                        <li>
                          Ofrece horarios disponibles según la agenda conectada a
                          Cal.com.
                        </li>
                        <li>
                          Recopila nombre, teléfono y, si aplica, dirección del
                          paciente o cliente.
                        </li>
                        <li>
                          Confirma la cita en Cal.com y repite los datos para
                          evitar errores.
                        </li>
                      </ol>
                      <div className="mt-3 space-y-1 text-[11px] theme-text-dim">
                        <p>⏱️ Duración promedio: 2–4 minutos</p>
                        <p>🌎 Idiomas: Español + Inglés</p>
                        <p>📅 Requiere: Cal.com configurado</p>
                      </div>
                    </div>
                  )}

                  {selectedAgent.agente_tipo === 'atencion_cliente' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold theme-text-primary">
                        ¿Cómo funciona este agente?
                      </h3>
                      <ol className="list-decimal space-y-1 pl-5">
                        <li>El cliente llama al número principal de tu negocio.</li>
                        <li>
                          El agente saluda, se presenta y pregunta en qué puede
                          ayudar.
                        </li>
                        <li>
                          Identifica si la consulta es una pregunta frecuente
                          (horarios, precios, ubicación, políticas, etc.).
                        </li>
                        <li>
                          Responde usando la información configurada en las
                          preguntas frecuentes.
                        </li>
                        <li>
                          Si la consulta es compleja o sensible, transfiere la
                          llamada al número de transferencia configurado.
                        </li>
                      </ol>
                      <div className="mt-3 space-y-1 text-[11px] theme-text-dim">
                        <p>⏱️ Duración promedio: 1–3 minutos</p>
                        <p>🌎 Idiomas: Español + Inglés</p>
                        <p>📞 Requiere: teléfono de transferencia</p>
                      </div>
                    </div>
                  )}

                  {selectedAgent.agente_tipo === 'servicios_domicilio' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold theme-text-primary">
                        ¿Cómo funciona este agente?
                      </h3>
                      <ol className="list-decimal space-y-1 pl-5">
                        <li>
                          El cliente llama describiendo el problema o servicio que
                          necesita.
                        </li>
                        <li>
                          El agente clasifica la urgencia (fuga activa, emergencia,
                          mantenimiento, cotización, etc.).
                        </li>
                        <li>
                          Pide y valida la dirección exacta y datos de contacto.
                        </li>
                        <li>
                          Envía una alerta al técnico al teléfono configurado,
                          incluyendo resumen del problema.
                        </li>
                        <li>
                          Informa al cliente que el técnico se pondrá en contacto
                          en breve.
                        </li>
                      </ol>
                      <div className="mt-3 space-y-1 text-[11px] theme-text-dim">
                        <p>⏱️ Duración promedio: 2–3 minutos</p>
                        <p>🌎 Idiomas: Español + Inglés</p>
                        <p>📱 Requiere: teléfono del técnico</p>
                      </div>
                    </div>
                  )}

                  {selectedAgent.agente_tipo === 'restaurante' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold theme-text-primary">
                        ¿Cómo funciona este agente?
                      </h3>
                      <ol className="list-decimal space-y-1 pl-5">
                        <li>El cliente llama al número del restaurante.</li>
                        <li>
                          El agente saluda con el nombre del negocio y pregunta si
                          desea reserva o pedido para llevar.
                        </li>
                        <li>
                          Para reservas: toma fecha, hora, número de personas y
                          nombre.
                        </li>
                        <li>
                          Para pedidos: toma los elementos básicos de la orden,
                          nombre y hora estimada de recogida.
                        </li>
                        <li>
                          Confirma todos los datos al cliente antes de terminar la
                          llamada.
                        </li>
                      </ol>
                      <div className="mt-3 space-y-1 text-[11px] theme-text-dim">
                        <p>⏱️ Duración promedio: 1–2 minutos</p>
                        <p>🌎 Idiomas: Español + Inglés</p>
                        <p>📋 Requiere: horarios del negocio actualizados</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selectedTab === 'config' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm theme-text-muted">
                        Nombre del agente
                      </label>
                      <input
                        value={createNombre}
                        onChange={(e) => setCreateNombre(e.target.value)}
                        placeholder="Sofia, Alex, Maria..."
                        className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                      />
                    </div>
                    <div>
                      <div className="text-sm theme-text-muted">Género</div>
                      <div className="mt-1 inline-flex rounded-full theme-bg-base p-1 ring-1 ring-zinc-800/80">
                        <button
                          type="button"
                          onClick={() => setCreateGenero('femenino')}
                          className={
                            'px-3 py-1 text-xs font-medium rounded-full ' +
                            (createGenero === 'femenino'
                              ? 'bg-zinc-200 text-[#0b0b0b]'
                              : 'theme-text-muted hover:bg-zinc-900/60')
                          }
                        >
                          👩 Femenina
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreateGenero('masculino')}
                          className={
                            'px-3 py-1 text-xs font-medium rounded-full ' +
                            (createGenero === 'masculino'
                              ? 'bg-zinc-200 text-[#0b0b0b]'
                              : 'theme-text-muted hover:bg-zinc-900/60')
                          }
                        >
                          👨 Masculina
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reutilizamos los mismos campos específicos según tipo */}
                  {/* Door hanger */}
                  {selectedAgent.agente_tipo === 'door_hanger_agua' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm theme-text-muted">
                          ¿Tienes equipo con códigos?
                        </span>
                        <button
                          type="button"
                          onClick={() => setCfgTieneEquipo((v) => !v)}
                          className={
                            'rounded-full px-3 py-1.5 text-xs font-semibold transition ' +
                            (cfgTieneEquipo
                              ? 'bg-[#22c55e]/20 text-[#22c55e]'
                              : 'bg-zinc-700/40 theme-text-muted')
                          }
                        >
                          {cfgTieneEquipo ? 'Sí' : 'No'}
                        </button>
                      </div>
                      {!cfgTieneEquipo && (
                        <div>
                          <label className="text-sm theme-text-muted">
                            Nombre del representante
                          </label>
                          <input
                            value={cfgNombreRepresentante}
                            onChange={(e) =>
                              setCfgNombreRepresentante(e.target.value)
                            }
                            placeholder="Ej. Carlos, Sofia..."
                            className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {selectedAgent.agente_tipo === 'solo_agendar' && (
                    <div>
                      <label className="text-sm theme-text-muted">Especialidad</label>
                      <input
                        value={cfgEspecialidad}
                        onChange={(e) => setCfgEspecialidad(e.target.value)}
                        placeholder="Médico familiar, Abogado de inmigración..."
                        className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                      />
                    </div>
                  )}

                  {selectedAgent.agente_tipo === 'atencion_cliente' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm theme-text-muted">
                          Horario de atención
                        </label>
                        <input
                          value={cfgHorario}
                          onChange={(e) => setCfgHorario(e.target.value)}
                          placeholder="Lun-Vie 9am-6pm"
                          className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        />
                      </div>
                      <div>
                        <label className="text-sm theme-text-muted">
                          Teléfono de transferencia
                        </label>
                        <input
                          value={cfgTelefonoTransferencia}
                          onChange={(e) =>
                            setCfgTelefonoTransferencia(e.target.value)
                          }
                          placeholder="+1(305)..."
                          className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        />
                      </div>
                      <div>
                        <label className="text-sm theme-text-muted">
                          Preguntas frecuentes
                        </label>
                        <textarea
                          value={cfgFaq}
                          onChange={(e) => setCfgFaq(e.target.value)}
                          rows={4}
                          className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e] resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {selectedAgent.agente_tipo === 'servicios_domicilio' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm theme-text-muted">
                          Tipos de servicio
                        </label>
                        <input
                          value={cfgServicios}
                          onChange={(e) => setCfgServicios(e.target.value)}
                          placeholder="Plomería, electricidad, HVAC"
                          className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        />
                      </div>
                      <div>
                        <label className="text-sm theme-text-muted">
                          Teléfono del técnico
                        </label>
                        <input
                          value={cfgTelefonoTecnico}
                          onChange={(e) => setCfgTelefonoTecnico(e.target.value)}
                          placeholder="+1(305)..."
                          className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        />
                      </div>
                    </div>
                  )}

                  {selectedAgent.agente_tipo === 'restaurante' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm theme-text-muted">Horarios</label>
                        <input
                          value={cfgHorarioRestaurante}
                          onChange={(e) =>
                            setCfgHorarioRestaurante(e.target.value)
                          }
                          placeholder="9am-10pm"
                          className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm theme-text-muted">
                          ¿Acepta reservas?
                        </span>
                        <button
                          type="button"
                          onClick={() => setCfgAceptaReservas((v) => !v)}
                          className={
                            'rounded-full px-3 py-1.5 text-xs font-semibold transition ' +
                            (cfgAceptaReservas
                              ? 'bg-[#22c55e]/20 text-[#22c55e]'
                              : 'bg-zinc-700/40 theme-text-muted')
                          }
                        >
                          {cfgAceptaReservas ? 'Sí' : 'No'}
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm theme-text-muted">
                          ¿Acepta pedidos para llevar?
                        </span>
                        <button
                          type="button"
                          onClick={() => setCfgAceptaTakeout((v) => !v)}
                          className={
                            'rounded-full px-3 py-1.5 text-xs font-semibold transition ' +
                            (cfgAceptaTakeout
                              ? 'bg-[#22c55e]/20 text-[#22c55e]'
                              : 'bg-zinc-700/40 theme-text-muted')
                          }
                        >
                          {cfgAceptaTakeout ? 'Sí' : 'No'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={saveConfigChanges}
                      disabled={savingConfig}
                      className="rounded-lg bg-[#22c55e] px-4 py-2 text-xs font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition"
                    >
                      {savingConfig ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              )}

              {selectedTab === 'stats' && (
                <div className="space-y-4">
                  {loadingStats ? (
                    <div className="text-sm theme-text-muted">
                      Cargando estadísticas...
                    </div>
                  ) : !stats ? (
                    <div className="text-sm theme-text-dim">
                      No hay estadísticas disponibles todavía.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div className="rounded-xl border theme-border/80 theme-bg-base px-4 py-3">
                        <div className="text-xs theme-text-muted">
                          Total llamadas recibidas
                        </div>
                        <div className="mt-1 text-xl font-semibold theme-text-primary">
                          {stats.totalLlamadas}
                        </div>
                      </div>
                      <div className="rounded-xl border theme-border/80 theme-bg-base px-4 py-3">
                        <div className="text-xs theme-text-muted">
                          Citas agendadas
                        </div>
                        <div className="mt-1 text-xl font-semibold theme-text-primary">
                          {stats.citasAgendadas}
                        </div>
                      </div>
                      <div className="rounded-xl border theme-border/80 theme-bg-base px-4 py-3">
                        <div className="text-xs theme-text-muted">
                          Llamadas esta semana
                        </div>
                        <div className="mt-1 text-xl font-semibold theme-text-primary">
                          {stats.llamadasSemana}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

