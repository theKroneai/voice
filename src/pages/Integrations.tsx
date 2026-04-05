import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getPublicWebhookBaseUrl } from '../lib/getPublicWebhookBaseUrl'

type CrmType =
  | 'bitrix24'
  | 'hubspot'
  | 'gohighlevel'
  | 'zoho'
  | 'salesforce'
  | 'pipedrive'
  | 'monday'
  | 'custom'

type CrmDefinition = {
  id: CrmType
  name: string
  emoji: string
  description: string
  badge?: string
  badgeColor?: string
  logo_url?: string | null
}

type CrmIntegrationRow = {
  id: string
  user_id: string
  crm_type: CrmType
  is_connected: boolean
  config: Record<string, unknown> | null
}

type SyncLogRow = {
  id: string
  crm_type: CrmType
  event: string
  contact_name: string | null
  result: string | null
  status: string
  created_at: string
}

type ModalState = {
  open: boolean
  crm: CrmType | null
}

type UserPlan = 'prospectador' | 'vendedor' | 'cazador'

export default function Integrations() {
  const [userId, setUserId] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<UserPlan>('prospectador')
  const [integrations, setIntegrations] = useState<Record<CrmType, CrmIntegrationRow | null>>({
    bitrix24: null,
    hubspot: null,
    gohighlevel: null,
    zoho: null,
    salesforce: null,
    pipedrive: null,
    monday: null,
    custom: null,
  })
  const [modal, setModal] = useState<ModalState>({ open: false, crm: null })
  const [saving, setSaving] = useState(false)
  const [syncLogs, setSyncLogs] = useState<SyncLogRow[]>([])
  const [syncFilter, setSyncFilter] = useState<'all' | CrmType>('all')
  const [crmCatalog, setCrmCatalog] = useState<CrmDefinition[]>([])

  // Formularios por CRM (guardados en memoria mientras el modal está abierto)
  const [bitrixUrl, setBitrixUrl] = useState('')
  const [bitrixWebhook, setBitrixWebhook] = useState('')
  const [bitrixSyncContacts, setBitrixSyncContacts] = useState(true)
  const [bitrixUpdateDeals, setBitrixUpdateDeals] = useState(true)
  const [bitrixAddNote, setBitrixAddNote] = useState(true)

  const [hubspotApiKey, setHubspotApiKey] = useState('')
  const [hubspotSyncContacts, setHubspotSyncContacts] = useState(true)
  const [hubspotCreateActivity, setHubspotCreateActivity] = useState(true)
  const [hubspotUpdateStage, setHubspotUpdateStage] = useState(true)

  const [ghlApiKey, setGhlApiKey] = useState('')
  const [ghlLocationId, setGhlLocationId] = useState('')
  const [ghlSyncContacts, setGhlSyncContacts] = useState(true)
  const [ghlUpdateOpportunity, setGhlUpdateOpportunity] = useState(true)

  const [pipedriveApiKey, setPipedriveApiKey] = useState('')
  const [pipedriveSyncPersons, setPipedriveSyncPersons] = useState(true)
  const [pipedriveUpdateDeals, setPipedriveUpdateDeals] = useState(true)

  const [mondayApiKey, setMondayApiKey] = useState('')
  const [mondayBoardId, setMondayBoardId] = useState('')
  const [mondaySyncItems, setMondaySyncItems] = useState(true)

  const [customName, setCustomName] = useState('')
  const [customWebhookUrl, setCustomWebhookUrl] = useState('')
  const [customSecretToken, setCustomSecretToken] = useState('')
  const [customOnCreateContact, setCustomOnCreateContact] = useState(true)
  const [customOnCallResult, setCustomOnCallResult] = useState(true)
  const [customOnAppointment, setCustomOnAppointment] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const uid = session?.user?.id
        if (!uid) return
        setUserId(uid)

        const [{ data: rows }, { data: logs }, { data: catalog }, { data: credits }] = await Promise.all([
          supabase
            .from('crm_integrations')
            .select('id, user_id, crm_type, is_connected, config')
            .eq('user_id', uid),
          supabase
            .from('crm_sync_logs')
            .select('id, crm_type, event, contact_name, result, status, created_at')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('crm_integration_catalog')
            .select(`
              crm_type,
              name,
              description,
              emoji,
              logo_url,
              is_visible,
              sort_order,
              badge,
              badge_color,
              plan_required
            `)
            .eq('is_visible', true)
            .order('sort_order', { ascending: true }),
          supabase.from('credits').select('plan_voz').eq('user_id', uid).maybeSingle(),
        ])

        const plan = (credits as { plan_voz?: string } | null)?.plan_voz
        if (plan === 'vendedor' || plan === 'cazador' || plan === 'prospectador') {
          setUserPlan(plan)
        }

        const map: Record<CrmType, CrmIntegrationRow | null> = {
          bitrix24: null,
          hubspot: null,
          gohighlevel: null,
          zoho: null,
          salesforce: null,
          pipedrive: null,
          monday: null,
          custom: null,
        }
        ;(rows ?? []).forEach((r) => {
          const type = r.crm_type as CrmType
          if (type in map) {
            map[type] = r as CrmIntegrationRow
          }
        })
        setIntegrations(map)
        setSyncLogs((logs ?? []) as SyncLogRow[])
        const catalogList = (catalog ?? []).map(
          (c: {
            crm_type: string
            name: string | null
            description: string | null
            emoji: string | null
            logo_url: string | null
            is_visible: boolean | null
            sort_order: number | null
            badge: string | null
            badge_color: string | null
            plan_required: string | null
          }) => ({
            id: c.crm_type as CrmType,
            name: c.name ?? c.crm_type,
            emoji: c.emoji ?? '🔌',
            description: c.description ?? '',
            badge: c.badge ?? undefined,
            badgeColor: c.badge_color ?? undefined,
            logo_url: c.logo_url,
          }),
        )
        setCrmCatalog(catalogList)
      } catch {
        // silencioso
      }
    }
    void load()
  }, [])

  const webhookBaseUrl = getPublicWebhookBaseUrl()
  const incomingWebhookUrl = useMemo(() => {
    if (!userId) return ''
    return `${webhookBaseUrl}/webhook/crm-incoming/${userId}`
  }, [userId, webhookBaseUrl])

  function openModal(crm: CrmType) {
    setModal({ open: true, crm })
    const existing = integrations[crm]?.config ?? {}
    switch (crm) {
      case 'bitrix24':
        setBitrixUrl((existing.bitrix_url as string) ?? '')
        setBitrixWebhook((existing.bitrix_webhook as string) ?? '')
        setBitrixSyncContacts((existing.sync_contacts as boolean) ?? true)
        setBitrixUpdateDeals((existing.update_deals as boolean) ?? true)
        setBitrixAddNote((existing.add_note as boolean) ?? true)
        break
      case 'hubspot':
        setHubspotApiKey((existing.api_key as string) ?? '')
        setHubspotSyncContacts((existing.sync_contacts as boolean) ?? true)
        setHubspotCreateActivity((existing.create_activity as boolean) ?? true)
        setHubspotUpdateStage((existing.update_stage as boolean) ?? true)
        break
      case 'gohighlevel':
        setGhlApiKey((existing.api_key as string) ?? '')
        setGhlLocationId((existing.location_id as string) ?? '')
        setGhlSyncContacts((existing.sync_contacts as boolean) ?? true)
        setGhlUpdateOpportunity((existing.update_opportunity as boolean) ?? true)
        break
      case 'pipedrive':
        setPipedriveApiKey((existing.api_key as string) ?? '')
        setPipedriveSyncPersons((existing.sync_persons as boolean) ?? true)
        setPipedriveUpdateDeals((existing.update_deals as boolean) ?? true)
        break
      case 'monday':
        setMondayApiKey((existing.api_key as string) ?? '')
        setMondayBoardId((existing.board_id as string) ?? '')
        setMondaySyncItems((existing.sync_items as boolean) ?? true)
        break
      case 'custom':
        setCustomName((existing.name as string) ?? '')
        setCustomWebhookUrl((existing.webhook_url as string) ?? '')
        setCustomSecretToken((existing.secret_token as string) ?? '')
        setCustomOnCreateContact((existing.on_create_contact as boolean) ?? true)
        setCustomOnCallResult((existing.on_call_result as boolean) ?? true)
        setCustomOnAppointment((existing.on_appointment as boolean) ?? true)
        break
      default:
        break
    }
  }

  function closeModal() {
    setModal({ open: false, crm: null })
  }

  async function saveCurrentIntegration() {
    if (!modal.crm || !userId) return
    setSaving(true)
    try {
      let config: Record<string, unknown> = {}
      switch (modal.crm) {
        case 'bitrix24':
          config = {
            bitrix_url: bitrixUrl,
            bitrix_webhook: bitrixWebhook,
            sync_contacts: bitrixSyncContacts,
            update_deals: bitrixUpdateDeals,
            add_note: bitrixAddNote,
          }
          break
        case 'hubspot':
          config = {
            api_key: hubspotApiKey,
            sync_contacts: hubspotSyncContacts,
            create_activity: hubspotCreateActivity,
            update_stage: hubspotUpdateStage,
          }
          break
        case 'gohighlevel':
          config = {
            api_key: ghlApiKey,
            location_id: ghlLocationId,
            sync_contacts: ghlSyncContacts,
            update_opportunity: ghlUpdateOpportunity,
          }
          break
        case 'zoho':
        case 'salesforce':
          // Por ahora solo texto informativo de OAuth próximamente
          config = {}
          break
        case 'pipedrive':
          config = {
            api_key: pipedriveApiKey,
            sync_persons: pipedriveSyncPersons,
            update_deals: pipedriveUpdateDeals,
          }
          break
        case 'monday':
          config = {
            api_key: mondayApiKey,
            board_id: mondayBoardId,
            sync_items: mondaySyncItems,
          }
          break
        case 'custom':
          config = {
            name: customName,
            webhook_url: customWebhookUrl,
            secret_token: customSecretToken,
            on_create_contact: customOnCreateContact,
            on_call_result: customOnCallResult,
            on_appointment: customOnAppointment,
          }
          break
        default:
          break
      }

      const payload = {
        user_id: userId,
        crm_type: modal.crm,
        is_connected: true,
        config,
      }
      const existingId = integrations[modal.crm]?.id
      const { data, error } = await supabase
        .from('crm_integrations')
        .upsert(existingId ? { ...payload, id: existingId } : payload, {
          onConflict: 'user_id,crm_type',
        })
        .select()
      if (error) throw new Error(error.message)
      const row = (data?.[0] ?? null) as CrmIntegrationRow | null
      if (row) {
        setIntegrations((prev) => ({ ...prev, [modal.crm!]: row }))
      }
      closeModal()
    } catch {
      // se podría agregar toast
    } finally {
      setSaving(false)
    }
  }

  function renderCrmStatus(crm: CrmType) {
    const connected = integrations[crm]?.is_connected
    if (connected) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
          <span>✅</span>
          Conectado
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-700/40 px-2 py-0.5 text-xs font-medium theme-text-muted">
        <span>⚪</span>
        No conectado
      </span>
    )
  }

  function copyIncomingWebhook() {
    if (!incomingWebhookUrl) return
    void navigator.clipboard.writeText(incomingWebhookUrl)
  }

  const filteredLogs = useMemo(() => {
    if (syncFilter === 'all') return syncLogs
    return syncLogs.filter((log) => log.crm_type === syncFilter)
  }, [syncFilter, syncLogs])

  // Banner de plan actual (texto simple)
  const planLabel =
    userPlan === 'cazador'
      ? 'Tu plan Cazador incluye todos los CRMs.'
      : userPlan === 'vendedor'
      ? 'Tu plan Vendedor incluye hasta 2 CRMs.'
      : 'Tu plan Prospectador incluye hasta 1 CRM.'

  return (
    <section className="min-h-screen theme-bg-base theme-text-secondary px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">
            Integraciones CRM
          </h1>
          <p className="text-sm text-zinc-500">
            Conecta Krone con tu CRM para sincronizar contactos y resultados automáticamente.
          </p>
          <p className="text-xs text-zinc-500">{planLabel}</p>
        </header>

        {/* Grid solo logos */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {crmCatalog.length === 0 ? (
            <div className="col-span-full rounded-2xl border theme-border/80 theme-bg-card p-6 text-center text-sm theme-text-muted">
              No hay integraciones disponibles. El administrador puede activarlas desde Admin → Integraciones CRM.
            </div>
          ) : null}
          {crmCatalog.map((crm) => {
            const connected = integrations[crm.id]?.is_connected
            const isBlocked = false // lógica de plan se puede reusar aquí luego

            return (
              <button
                key={crm.id}
                type="button"
                onClick={() => (!isBlocked ? openModal(crm.id) : undefined)}
                className={`relative flex h-24 w-24 flex-col items-center justify-center rounded-2xl border bg-zinc-900/90 transition transform hover:scale-[1.05] ${
                  connected ? 'border-[#22c55e]' : 'border-zinc-800 hover:border-zinc-700'
                }`}
                title={crm.badge ?? undefined}
              >
                {/* Indicador de estado */}
                {connected && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[#22c55e]" />
                )}

                {/* Logo */}
                <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-black/30 mb-1">
                  <span className="text-3xl">{crm.emoji}</span>
                  {crm.logo_url && (
                    <img
                      src={crm.logo_url}
                      alt={crm.name}
                      className="absolute inset-0 h-12 w-12 rounded-xl object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  )}
                </div>

                {/* Nombre */}
                <span className="px-1 text-[11px] font-medium text-zinc-400 truncate max-w-[80px]">
                  {crm.name}
                </span>

                {/* Overlay bloqueado */}
                {isBlocked && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50">
                    <span className="text-lg">🔒</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Tu webhook entrante */}
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
          <h2 className="text-base font-semibold theme-text-primary">
            Tu URL de Webhook Entrante
          </h2>
          <p className="mt-1 text-xs theme-text-muted max-w-2xl">
            Usa esta URL en tu CRM para enviar contactos a Krone automáticamente. Cuando tu CRM
            crea un lead nuevo, Krone lo importa y lanza la llamada.
          </p>
          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
            <code className="flex-1 truncate rounded-lg bg-black/60 px-3 py-2 text-xs theme-text-secondary ring-1 theme-border">
              {incomingWebhookUrl || 'Inicia sesión para ver tu URL.'}
            </code>
            <button
              type="button"
              onClick={copyIncomingWebhook}
              className="inline-flex items-center justify-center rounded-lg bg-[#22c55e] px-3 py-2 text-xs font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
              disabled={!incomingWebhookUrl}
            >
              Copiar URL
            </button>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold theme-text-primary mb-1">
              Payload que acepta Krone:
            </p>
            <pre className="max-h-64 overflow-auto rounded-lg bg-black/70 p-3 text-[11px] leading-relaxed text-zinc-200">
{`{
  "nombre": "Carlos López",      // requerido
  "telefono": "+13055550100",    // requerido
  "email": "carlos@email.com",   // opcional
  "ciudad": "Miami",             // opcional
  "zipcode": "33101",            // opcional
  "campaign_id": "uuid",         // opcional
  "notas": "Lead de Facebook Ads" // opcional
}`}
            </pre>
          </div>
        </div>

      </div>

      {/* Modal configuración */}
      {modal.open && modal.crm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border theme-border/80 theme-bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold theme-text-primary">
                  {crmCatalog.find((c) => c.id === modal.crm)?.name ?? modal.crm}
                </h3>
                <p className="mt-1 text-xs theme-text-muted">
                  Configura cómo Krone se conecta y sincroniza con este CRM.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-xs theme-text-muted hover:theme-text-primary"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {modal.crm === 'bitrix24' && (
                <>
                  <div>
                    <label className="text-xs theme-text-muted">
                      URL de tu Bitrix24
                    </label>
                    <input
                      type="text"
                      value={bitrixUrl}
                      onChange={(e) => setBitrixUrl(e.target.value)}
                      placeholder="miempresa.bitrix24.com"
                      className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                    <p className="mt-1 text-[11px] theme-text-dim">
                      Ejemplo: miempresa.bitrix24.com (sin http/https).
                    </p>
                  </div>
                  <div>
                    <label className="text-xs theme-text-muted">
                      Webhook entrante de Bitrix24
                    </label>
                    <input
                      type="password"
                      value={bitrixWebhook}
                      onChange={(e) => setBitrixWebhook(e.target.value)}
                      placeholder="https://miempresa.bitrix24.com/rest/..."
                      className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                    <p className="mt-1 text-[11px] theme-text-dim">
                      Bitrix24 → Configuración → Webhooks entrantes → Crear.
                    </p>
                  </div>
                  <ToggleRow
                    label="Sync contactos automático"
                    checked={bitrixSyncContacts}
                    onChange={setBitrixSyncContacts}
                  />
                  <ToggleRow
                    label="Actualizar deals tras llamada"
                    checked={bitrixUpdateDeals}
                    onChange={setBitrixUpdateDeals}
                  />
                  <ToggleRow
                    label="Agregar nota con transcripción"
                    checked={bitrixAddNote}
                    onChange={setBitrixAddNote}
                  />
                </>
              )}

              {modal.crm === 'hubspot' && (
                <>
                  <div>
                    <label className="text-xs theme-text-muted">
                      API Key (Private App Token)
                    </label>
                    <input
                      type="password"
                      value={hubspotApiKey}
                      onChange={(e) => setHubspotApiKey(e.target.value)}
                      placeholder="pat-..."
                      className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                    <p className="mt-1 text-[11px] theme-text-dim">
                      HubSpot → Configuración → Integraciones → Apps privadas → Crear.
                    </p>
                  </div>
                  <ToggleRow
                    label="Sync contactos"
                    checked={hubspotSyncContacts}
                    onChange={setHubspotSyncContacts}
                  />
                  <ToggleRow
                    label="Crear actividad tras llamada"
                    checked={hubspotCreateActivity}
                    onChange={setHubspotCreateActivity}
                  />
                  <ToggleRow
                    label="Actualizar etapa del deal"
                    checked={hubspotUpdateStage}
                    onChange={setHubspotUpdateStage}
                  />
                </>
              )}

              {modal.crm === 'gohighlevel' && (
                <>
                  <div>
                    <label className="text-xs theme-text-muted">API Key</label>
                    <input
                      type="password"
                      value={ghlApiKey}
                      onChange={(e) => setGhlApiKey(e.target.value)}
                      className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                  </div>
                  <div>
                    <label className="text-xs theme-text-muted">Location ID</label>
                    <input
                      type="text"
                      value={ghlLocationId}
                      onChange={(e) => setGhlLocationId(e.target.value)}
                      className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                  </div>
                  <ToggleRow
                    label="Sync contactos"
                    checked={ghlSyncContacts}
                    onChange={setGhlSyncContacts}
                  />
                  <ToggleRow
                    label="Actualizar oportunidad"
                    checked={ghlUpdateOpportunity}
                    onChange={setGhlUpdateOpportunity}
                  />
                </>
              )}

              {modal.crm === 'zoho' && (
                <>
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed rounded-lg bg-zinc-800/80 px-3 py-2 text-xs font-semibold theme-text-muted"
                  >
                    Conectar con Zoho (OAuth2) — Próximamente
                  </button>
                  <ToggleRow
                    label="Sync contactos"
                    checked
                    onChange={() => {}}
                    disabled
                  />
                  <ToggleRow
                    label="Actualizar leads"
                    checked
                    onChange={() => {}}
                    disabled
                  />
                  <p className="mt-1 text-[11px] theme-text-dim">
                    Próximamente habilitaremos OAuth2 oficial. Mientras tanto, puedes usar un
                    CRM Personalizado con Webhook.
                  </p>
                </>
              )}

              {modal.crm === 'salesforce' && (
                <>
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed rounded-lg bg-zinc-800/80 px-3 py-2 text-xs font-semibold theme-text-muted"
                  >
                    Conectar con Salesforce (OAuth2) — Próximamente
                  </button>
                  <ToggleRow
                    label="Sync contactos"
                    checked
                    onChange={() => {}}
                    disabled
                  />
                  <ToggleRow
                    label="Actualizar oportunidades"
                    checked
                    onChange={() => {}}
                    disabled
                  />
                  <p className="mt-1 text-[11px] theme-text-dim">
                    Próximamente habilitaremos OAuth2 oficial. Mientras tanto, puedes usar un
                    CRM Personalizado con Webhook.
                  </p>
                </>
              )}

              {modal.crm === 'pipedrive' && (
                <>
                  <div>
                    <label className="text-xs theme-text-muted">API Key</label>
                    <input
                      type="password"
                      value={pipedriveApiKey}
                      onChange={(e) => setPipedriveApiKey(e.target.value)}
                      className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                    <p className="mt-1 text-[11px] theme-text-dim">
                      Pipedrive → Personal → API → Generar API token.
                    </p>
                  </div>
                  <ToggleRow
                    label="Sync personas"
                    checked={pipedriveSyncPersons}
                    onChange={setPipedriveSyncPersons}
                  />
                  <ToggleRow
                    label="Actualizar deals"
                    checked={pipedriveUpdateDeals}
                    onChange={setPipedriveUpdateDeals}
                  />
                </>
              )}

              {modal.crm === 'monday' && (
                <>
                  <div>
                    <label className="text-xs theme-text-muted">API Key</label>
                    <input
                      type="password"
                      value={mondayApiKey}
                      onChange={(e) => setMondayApiKey(e.target.value)}
                      className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                    <p className="mt-1 text-[11px] theme-text-dim">
                      Monday.com → Admin → API → Generar token.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs theme-text-muted">Board ID</label>
                    <input
                      type="text"
                      value={mondayBoardId}
                      onChange={(e) => setMondayBoardId(e.target.value)}
                      className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                    <p className="mt-1 text-[11px] theme-text-dim">
                      ID del board donde quieres que se sincronicen los items/contactos.
                    </p>
                  </div>
                  <ToggleRow
                    label="Sync items"
                    checked={mondaySyncItems}
                    onChange={setMondaySyncItems}
                  />
                </>
              )}

              {modal.crm === 'custom' && (
                <>
                  <div>
                    <label className="text-xs theme-text-muted">Nombre del CRM</label>
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="Mi CRM Propio"
                      className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                  </div>
                  <div>
                    <label className="text-xs theme-text-muted">URL del Webhook</label>
                    <input
                      type="url"
                      value={customWebhookUrl}
                      onChange={(e) => setCustomWebhookUrl(e.target.value)}
                      placeholder="https://mi-crm.com/webhooks/krone"
                      className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                    <p className="mt-1 text-[11px] theme-text-dim">
                      URL donde Krone enviará los resultados de las llamadas y creación de
                      contactos.
                    </p>
                  </div>
                  <div>
                    <label className="text-xs theme-text-muted">Secret Token</label>
                    <input
                      type="password"
                      value={customSecretToken}
                      onChange={(e) => setCustomSecretToken(e.target.value)}
                      placeholder="Secreto para validar requests"
                      className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    />
                    <p className="mt-1 text-[11px] theme-text-dim">
                      Este token se enviará en los headers para que tu CRM valide que el
                      request viene de Krone.
                    </p>
                  </div>
                  <ToggleRow
                    label="Enviar al crear contacto"
                    checked={customOnCreateContact}
                    onChange={setCustomOnCreateContact}
                  />
                  <ToggleRow
                    label="Enviar resultado de llamada"
                    checked={customOnCallResult}
                    onChange={setCustomOnCallResult}
                  />
                  <ToggleRow
                    label="Enviar cuando agenda cita"
                    checked={customOnAppointment}
                    onChange={setCustomOnAppointment}
                  />

                  <div>
                    <p className="mt-3 text-xs font-semibold theme-text-primary">
                      Payload que Krone enviará (ejemplo):
                    </p>
                    <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-black/70 p-3 text-[11px] leading-relaxed text-zinc-200">
{`{
  "event": "call_completed",
  "contact": {
    "nombre": "Carlos López",
    "telefono": "+13055550100",
    "email": ""
  },
  "llamada": {
    "disposition": "completed",
    "duracion_minutos": 2.5,
    "sentiment": "Positive",
    "transcripcion": "...",
    "resumen": "...",
    "costo_usd": 1.87
  },
  "timestamp": "2025-01-15T10:30:00Z"
}`}
                    </pre>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg px-3 py-2 text-xs font-medium theme-text-muted hover:theme-text-primary"
              >
                Cancelar
              </button>
              {modal.crm !== 'zoho' && modal.crm !== 'salesforce' && (
                <button
                  type="button"
                  onClick={saveCurrentIntegration}
                  disabled={saving}
                  className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition"
                >
                  {saving ? 'Guardando...' : 'Guardar integración'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

type ToggleRowProps = {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

function ToggleRow({ label, checked, onChange, disabled }: ToggleRowProps) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg bg-black/40 px-3 py-2">
      <span className="text-xs theme-text-secondary">{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full border transition ${
          checked ? 'border-[#22c55e] bg-[#22c55e]/20' : 'border-zinc-600 bg-zinc-800'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </button>
    </label>
  )
}

