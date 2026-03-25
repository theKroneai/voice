import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type UserProfile = {
  company_name: string | null
  nicho: string | null
  email: string | null
}

type BillingProfile = {
  nombre: string
  ein_itin: string
  correo: string
  direccion: string
  estado: string
  ciudad: string
  telefono: string
}

type NichoTemplate = {
  id: string
  nicho: string
}

type CreditRow = {
  id: string
  created_at: string
  tipo: string | null
  monto_usd: number | null
  minutos: number | null
  sms_cantidad: number | null
  descripcion: string | null
}

type UserIntegrations = {
  calcom_api_key: string | null
  calcom_event_type_id: string | null
  calcom_username: string | null
}

type Technician = {
  id: string
  nombre: string | null
  codigo: string | null
  zona: string | null
  ciudad: string | null
  activo: boolean | null
}

export default function Settings() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile>({
    company_name: '',
    nicho: '',
    email: '',
  })
  const [voiceMinutes, setVoiceMinutes] = useState(0)
  const [smsBalance, setSmsBalance] = useState(0)
  const [lastTransactions, setLastTransactions] = useState<CreditRow[]>([])
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingCompany, setSavingCompany] = useState(false)
  const [companyError, setCompanyError] = useState<string | null>(null)
  const [companySuccess, setCompanySuccess] = useState(false)

  // Perfil para facturación (Stripe)
  const [billing, setBilling] = useState<BillingProfile>({
    nombre: '',
    ein_itin: '',
    correo: '',
    direccion: '',
    estado: '',
    ciudad: '',
    telefono: '',
  })
  const [savingBilling, setSavingBilling] = useState(false)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [billingSuccess, setBillingSuccess] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [nichos, setNichos] = useState<NichoTemplate[]>([])

   // Integraciones Cal.com + Google Review
  const [integrations, setIntegrations] = useState<UserIntegrations>({
    calcom_api_key: '',
    calcom_event_type_id: '',
    calcom_username: '',
  })
  const [googleReviewLink, setGoogleReviewLink] = useState('')
  const [savingIntegrations, setSavingIntegrations] = useState(false)
  const [integrationsError, setIntegrationsError] = useState<string | null>(null)
  const [integrationsSuccess, setIntegrationsSuccess] = useState(false)

  // Equipo de técnicos
  const [hasTeam, setHasTeam] = useState(false)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [techModalOpen, setTechModalOpen] = useState(false)
  const [techNombre, setTechNombre] = useState('')
  const [techCodigo, setTechCodigo] = useState('')
  const [techZona, setTechZona] = useState('')
  const [techCiudad, setTechCiudad] = useState('')
  const [savingTech, setSavingTech] = useState(false)
  const [techError, setTechError] = useState<string | null>(null)

  // Mi Agente Inbound
  type AgenteTipo = 'door_hanger_agua' | 'solo_agendar_medico_legal' | 'solo_agendar_general'
  const [agenteTipo, setAgenteTipo] = useState<AgenteTipo>('door_hanger_agua')
  const [inboundPhoneNumber, setInboundPhoneNumber] = useState<string | null>(null)
  const [nombreAnalista, setNombreAnalista] = useState('')
  const [agenteActivo, setAgenteActivo] = useState(true)
  const [savingInboundAgent, setSavingInboundAgent] = useState(false)
  const [inboundAgentError, setInboundAgentError] = useState<string | null>(null)
  const [inboundAgentSuccess, setInboundAgentSuccess] = useState(false)
  const isSoloAgendar = agenteTipo === 'solo_agendar_medico_legal' || agenteTipo === 'solo_agendar_general'

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()
        if (sessionError || !session?.user?.id) return
        const userId = session.user.id
        const emailFromAuth = session.user.email ?? ''

        const [
          { data: userRow },
          { data: nichosData },
          { data: credits },
          { data: tx },
          { data: integ },
          { data: techs },
          { data: inboundAgent },
        ] = await Promise.all([
          supabase
            .from('users')
            .select('company_name, nicho, email, google_review_link, billing_nombre, billing_ein_itin, billing_email, billing_direccion, billing_estado, billing_ciudad, billing_telefono')
            .eq('id', userId)
            .maybeSingle(),
          supabase.from('nicho_templates').select('id, nicho').order('nicho'),
          supabase
            .from('credits')
            .select('minutos_voz, sms_disponibles')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('credit_transactions')
            .select(
              'id, created_at, tipo, monto_usd, minutos, sms_cantidad, descripcion',
            )
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('user_integrations')
            .select('calcom_api_key, calcom_event_type_id, calcom_username')
            .eq('user_id', userId)
            .maybeSingle(),
          supabase
            .from('tecnicos')
            .select('id, nombre, codigo, zona, ciudad, activo')
            .eq('user_id', userId)
            .order('nombre'),
          supabase
            .from('inbound_agents')
            .select('agente_tipo, phone_number, nombre_analista, tiene_equipo, activo')
            .eq('user_id', userId)
            .maybeSingle(),
        ])

        if (!mounted) return
        setProfile({
          company_name: userRow?.company_name ?? '',
          nicho: userRow?.nicho ?? '',
          email: userRow?.email ?? emailFromAuth,
        })
        const u = userRow as Record<string, unknown> | null
        setBilling({
          nombre: (u?.billing_nombre as string) ?? '',
          ein_itin: (u?.billing_ein_itin as string) ?? '',
          correo: (u?.billing_email as string) ?? (userRow?.email ?? emailFromAuth) ?? '',
          direccion: (u?.billing_direccion as string) ?? '',
          estado: (u?.billing_estado as string) ?? '',
          ciudad: (u?.billing_ciudad as string) ?? '',
          telefono: (u?.billing_telefono as string) ?? '',
        })
        setNichos((nichosData ?? []) as NichoTemplate[])

        if (credits) {
          setVoiceMinutes((credits as { minutos_voz?: number }).minutos_voz ?? 0)
          setSmsBalance((credits as { sms_disponibles?: number }).sms_disponibles ?? 0)
        }

        if (tx) {
          setLastTransactions((tx ?? []) as CreditRow[])
        }

        if (integ) {
          setIntegrations({
            calcom_api_key: integ.calcom_api_key ?? '',
            calcom_event_type_id: integ.calcom_event_type_id ?? '',
            calcom_username: integ.calcom_username ?? '',
          })
        }
        const grl = (userRow as Record<string, unknown>)?.google_review_link as string | undefined
        setGoogleReviewLink(grl ?? '')

        if (techs) {
          setTechnicians(techs as Technician[])
          setHasTeam((techs as Technician[]).length > 0)
        }

        if (inboundAgent) {
          setInboundPhoneNumber(inboundAgent.phone_number ?? null)
          setNombreAnalista(inboundAgent.nombre_analista ?? '')
          setAgenteActivo(inboundAgent.activo ?? true)
          setAgenteTipo(
            inboundAgent.agente_tipo === 'solo_agendar'
              ? 'solo_agendar_general'
              : 'door_hanger_agua',
          )
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setLoadingProfile(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  async function saveCompany() {
    setCompanyError(null)
    setCompanySuccess(false)
    setSavingCompany(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError || !session?.user?.id) throw new Error('No hay sesión.')
      const { error } = await supabase
        .from('users')
        .update({
          company_name: profile.company_name?.trim() || null,
          nicho: profile.nicho?.trim() || null,
          email: profile.email?.trim() || null,
        })
        .eq('id', session.user.id)
      if (error) throw error
      setCompanySuccess(true)
    } catch (e) {
      setCompanyError(e instanceof Error ? e.message : 'Error al guardar.')
    } finally {
      setSavingCompany(false)
    }
  }

  async function saveBillingProfile() {
    setBillingError(null)
    setBillingSuccess(false)
    setSavingBilling(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError || !session?.user?.id) throw new Error('No hay sesión.')
      const { error } = await supabase
        .from('users')
        .update({
          billing_nombre: billing.nombre?.trim() || null,
          billing_ein_itin: billing.ein_itin?.trim() || null,
          billing_email: billing.correo?.trim() || null,
          billing_direccion: billing.direccion?.trim() || null,
          billing_estado: billing.estado?.trim() || null,
          billing_ciudad: billing.ciudad?.trim() || null,
          billing_telefono: billing.telefono?.trim() || null,
        })
        .eq('id', session.user.id)
      if (error) throw error
      setBillingSuccess(true)
    } catch (e) {
      setBillingError(
        e instanceof Error ? e.message : 'Error al guardar el perfil de facturación.',
      )
    } finally {
      setSavingBilling(false)
    }
  }

  async function saveIntegrations() {
    setIntegrationsError(null)
    setIntegrationsSuccess(false)
    setSavingIntegrations(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError || !session?.user?.id) throw new Error('No hay sesión.')
      const userId = session.user.id
      const { error } = await supabase.from('user_integrations').upsert(
        {
          user_id: userId,
          calcom_api_key: integrations.calcom_api_key?.trim() || null,
          calcom_event_type_id: integrations.calcom_event_type_id?.trim() || null,
          calcom_username: integrations.calcom_username?.trim() || null,
        },
        { onConflict: 'user_id' },
      )
      if (error) throw error
      const { error: userError } = await supabase
        .from('users')
        .update({ google_review_link: googleReviewLink?.trim() || null })
        .eq('id', userId)
      if (userError) throw userError
      setIntegrationsSuccess(true)
    } catch (e) {
      setIntegrationsError(
        e instanceof Error ? e.message : 'Error al guardar integraciones.',
      )
    } finally {
      setSavingIntegrations(false)
    }
  }

  async function saveInboundAgent() {
    setInboundAgentError(null)
    setInboundAgentSuccess(false)
    setSavingInboundAgent(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError || !session?.user?.id) throw new Error('No hay sesión.')
      const userId = session.user.id
      const payload = isSoloAgendar
        ? {
            user_id: userId,
            agente_tipo: 'solo_agendar' as const,
            nombre_analista: nombreAnalista?.trim() || null,
            tiene_equipo: false,
            activo: agenteActivo,
          }
        : {
            user_id: userId,
            agente_tipo: 'door_hanger_agua' as const,
            nombre_analista: nombreAnalista?.trim() || null,
            tiene_equipo: hasTeam,
            activo: agenteActivo,
          }
      const { error } = await supabase
        .from('inbound_agents')
        .upsert(payload, { onConflict: 'user_id' })
      if (error) throw error
      setInboundAgentSuccess(true)
    } catch (e) {
      setInboundAgentError(
        e instanceof Error ? e.message : 'Error al guardar el agente.',
      )
    } finally {
      setSavingInboundAgent(false)
    }
  }

  function openTechModal() {
    setTechModalOpen(true)
    setTechNombre('')
    setTechCodigo('')
    setTechZona('')
    setTechCiudad('')
    setTechError(null)
  }

  function closeTechModal() {
    setTechModalOpen(false)
    setSavingTech(false)
  }

  async function saveTechnician() {
    setTechError(null)
    if (!techNombre.trim()) {
      setTechError('El nombre del técnico es obligatorio.')
      return
    }
    setSavingTech(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError || !session?.user?.id) throw new Error('No hay sesión.')
      const userId = session.user.id
      const { data, error } = await supabase
        .from('tecnicos')
        .insert({
          user_id: userId,
          nombre: techNombre.trim(),
          codigo: techCodigo.trim() || null,
          zona: techZona.trim() || null,
          ciudad: techCiudad.trim() || null,
          activo: true,
        })
        .select()
      if (error) throw error
      const inserted = (data ?? []) as Technician[]
      setTechnicians((prev) => [...prev, ...inserted])
      setHasTeam(true)
      closeTechModal()
    } catch (e) {
      setTechError(
        e instanceof Error ? e.message : 'Error al agregar técnico.',
      )
    } finally {
      setSavingTech(false)
    }
  }

  async function toggleTechnicianActive(id: string, current: boolean | null) {
    try {
      const { error } = await supabase
        .from('tecnicos')
        .update({ activo: !current })
        .eq('id', id)
      if (error) throw error
      setTechnicians((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, activo: !current } : t,
        ),
      )
    } catch {
      // opcional: podrías mostrar error
    }
  }

  async function changePassword() {
    setPasswordError(null)
    setPasswordSuccess(false)
    if (newPassword.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      return
    }
    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Error al cambiar contraseña.')
    } finally {
      setChangingPassword(false)
    }
  }

  function openDeleteModal() {
    setDeleteModalOpen(true)
    setDeleteConfirm('')
    setDeleteError(null)
  }

  function closeDeleteModal() {
    setDeleteModalOpen(false)
    setDeleting(false)
  }

  async function confirmDeleteAccount() {
    setDeleteError(null)
    if (deleteConfirm.toLowerCase() !== 'eliminar') {
      setDeleteError('Escribe ELIMINAR para confirmar.')
      return
    }
    setDeleting(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: undefined })
      if (error) throw error
      setDeleteError(
        'La eliminación de cuenta debe completarse desde el panel de administración o contactando a soporte. Tu solicitud ha quedado registrada.',
      )
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Error. Contacta a soporte para eliminar tu cuenta.')
    } finally {
      setDeleting(false)
    }
  }

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm theme-text-muted">Cargando...</span>
      </div>
    )
  }

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">
          Configuración
        </h1>
        <p className="mt-1 text-sm theme-text-muted">
          Gestiona tu empresa, créditos y seguridad.
        </p>
      </div>

      {/* A) Mi Empresa — configuración para el agente de voz */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Mi Empresa</h2>
        <p className="mt-1 text-xs theme-text-muted">
          Datos que usa tu agente de voz en las llamadas. Incluye si tienes equipo y el nombre de tu representante.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm theme-text-muted">Nombre de empresa</label>
            <input
              value={profile.company_name ?? ''}
              onChange={(e) =>
                setProfile((p) => ({ ...p, company_name: e.target.value }))
              }
              className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="Ej. Mi Empresa S.A."
            />
          </div>
          <div>
            <label className="text-sm theme-text-muted">Nicho</label>
            {nichos.length === 0 ? (
              <div className="mt-1 text-xs theme-text-dim">
                No hay nichos configurados
              </div>
            ) : (
              <select
                value={profile.nicho ?? ''}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    nicho: e.target.value || null,
                  }))
                }
                className="mt-1 w-full max-w-md rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              >
                <option value="">Seleccionar nicho...</option>
                {nichos.map((n) => (
                  <option key={n.id} value={n.nicho}>
                    {n.nicho}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="text-sm theme-text-muted">Email de contacto</label>
            <input
              type="email"
              value={profile.email ?? ''}
              onChange={(e) =>
                setProfile((p) => ({ ...p, email: e.target.value }))
              }
              className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="contacto@empresa.com"
            />
          </div>

          {!isSoloAgendar && (
            <div className="flex items-center gap-3">
              <span className="text-sm theme-text-muted">
                ¿Tienes equipo de técnicos?
              </span>
              <div className="inline-flex rounded-full theme-bg-base p-1 ring-1 theme-border">
                <button
                  type="button"
                  onClick={() => setHasTeam(false)}
                  className={
                    'px-3 py-1 text-xs font-medium rounded-full ' +
                    (!hasTeam
                      ? 'bg-zinc-200 text-[#0b0b0b]'
                      : 'theme-text-muted hover:bg-zinc-900/60')
                  }
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setHasTeam(true)}
                  className={
                    'px-3 py-1 text-xs font-medium rounded-full ' +
                    (hasTeam
                      ? 'bg-[#22c55e] text-[#0b0b0b]'
                      : 'theme-text-muted hover:bg-zinc-900/60')
                  }
                >
                  Sí
                </button>
              </div>
            </div>
          )}

          {isSoloAgendar && (
            <div>
              <label className="text-sm theme-text-muted">
                Especialidad o servicio
              </label>
              <input
                type="text"
                value={nombreAnalista}
                onChange={(e) => setNombreAnalista(e.target.value)}
                placeholder="Ej. Médico familiar, Abogado de inmigración, Dentista..."
                className="mt-1 w-full max-w-md rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              />
              <p className="mt-1 text-[11px] theme-text-dim">
                Se guarda en el agente para personalizar las respuestas.
              </p>
            </div>
          )}
          {!isSoloAgendar && !hasTeam && (
            <div>
              <label className="text-sm theme-text-muted">
                ¿Cómo se llama tu representante?
              </label>
              <input
                type="text"
                value={nombreAnalista}
                onChange={(e) => setNombreAnalista(e.target.value)}
                placeholder="Ej. Jose Daniel"
                className="mt-1 w-full max-w-md rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              />
              <p className="mt-1 text-[11px] theme-text-dim">
                Este nombre lo usará el agente cuando no hay equipo configurado.
              </p>
            </div>
          )}

          {companyError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {companyError}
            </div>
          )}
          {companySuccess && (
            <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-2 text-sm text-[#22c55e]">
              Cambios guardados.
            </div>
          )}
          <button
            type="button"
            onClick={saveCompany}
            disabled={savingCompany}
            className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition"
          >
            {savingCompany ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Perfil para facturación (Stripe) */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Perfil para facturación</h2>
        <p className="mt-1 text-xs theme-text-muted">
          Datos para generar facturas con Stripe. Completa esta información para recibir invoices correctos.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm theme-text-muted">Nombre (razón social o titular)</label>
            <input
              value={billing.nombre}
              onChange={(e) => setBilling((b) => ({ ...b, nombre: e.target.value }))}
              className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="Ej. Juan Pérez o Mi Empresa LLC"
            />
          </div>
          <div>
            <label className="text-sm theme-text-muted">EIN o ITIN</label>
            <input
              value={billing.ein_itin}
              onChange={(e) => setBilling((b) => ({ ...b, ein_itin: e.target.value }))}
              className="mt-1 w-full max-w-xs rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="Ej. 12-3456789"
            />
          </div>
          <div>
            <label className="text-sm theme-text-muted">Correo para facturación</label>
            <input
              type="email"
              value={billing.correo}
              onChange={(e) => setBilling((b) => ({ ...b, correo: e.target.value }))}
              className="mt-1 w-full max-w-md rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="facturacion@empresa.com"
            />
          </div>
          <div>
            <label className="text-sm theme-text-muted">Dirección</label>
            <input
              value={billing.direccion}
              onChange={(e) => setBilling((b) => ({ ...b, direccion: e.target.value }))}
              className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="Calle, número, colonia"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm theme-text-muted">Ciudad</label>
              <input
                value={billing.ciudad}
                onChange={(e) => setBilling((b) => ({ ...b, ciudad: e.target.value }))}
                className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                placeholder="Ej. Houston"
              />
            </div>
            <div>
              <label className="text-sm theme-text-muted">Estado</label>
              <input
                value={billing.estado}
                onChange={(e) => setBilling((b) => ({ ...b, estado: e.target.value }))}
                className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                placeholder="Ej. TX"
              />
            </div>
          </div>
          <div>
            <label className="text-sm theme-text-muted">Teléfono de contacto</label>
            <input
              type="tel"
              value={billing.telefono}
              onChange={(e) => setBilling((b) => ({ ...b, telefono: e.target.value }))}
              className="mt-1 w-full max-w-xs rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="+1 234 567 8900"
            />
          </div>
          {billingError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {billingError}
            </div>
          )}
          {billingSuccess && (
            <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-2 text-sm text-[#22c55e]">
              Perfil de facturación guardado.
            </div>
          )}
          <button
            type="button"
            onClick={saveBillingProfile}
            disabled={savingBilling}
            className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition"
          >
            {savingBilling ? 'Guardando...' : 'Guardar perfil de facturación'}
          </button>
        </div>
      </div>

      {/* B) Mis Créditos */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Mis Créditos</h2>
        <p className="mt-1 text-xs theme-text-muted">Balance y últimas transacciones.</p>
        <div className="mt-4 flex gap-4">
          <div className="rounded-xl border theme-border/80 theme-bg-base px-4 py-3">
            <div className="text-xs theme-text-muted">Minutos de voz</div>
            <div className="text-xl font-semibold theme-text-primary">{voiceMinutes}</div>
          </div>
          <div className="rounded-xl border theme-border/80 theme-bg-base px-4 py-3">
            <div className="text-xs theme-text-muted">SMS</div>
            <div className="text-xl font-semibold theme-text-primary">{smsBalance}</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="text-xs theme-text-muted mb-2">Últimas 5 transacciones</div>
          <div className="rounded-xl border theme-border/80 theme-bg-base overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="text-xs theme-text-dim border-b theme-border/80">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Min/SMS</th>
                </tr>
              </thead>
              <tbody>
                {lastTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center theme-text-dim">
                      Sin transacciones
                    </td>
                  </tr>
                ) : (
                  lastTransactions.map((t) => (
                    <tr key={t.id} className="border-b theme-border/80 last:border-0">
                      <td className="px-3 py-2 theme-text-muted">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 theme-text-muted">{t.tipo ?? '—'}</td>
                      <td className="px-3 py-2 theme-text-muted">
                        {t.monto_usd != null ? `$${t.monto_usd.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-3 py-2 theme-text-muted">
                        {t.minutos ?? 0} / {t.sms_cantidad ?? 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/credits')}
          className="mt-4 rounded-lg border border-[#22c55e]/50 px-4 py-2 text-sm font-medium text-[#22c55e] hover:bg-[#22c55e]/10 transition"
        >
          Recargar créditos
        </button>
      </div>

      {/* C) Equipo — solo visible para tipo Door Hanger cuando tiene equipo */}
      {!isSoloAgendar && hasTeam && (
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Equipo</h2>
        <p className="mt-1 text-xs theme-text-muted">
          Gestiona a los técnicos que atenderán las citas.
        </p>

        <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs theme-text-muted">
                Técnicos registrados ({technicians.length})
              </div>
              <button
                type="button"
                onClick={openTechModal}
                className="rounded-lg bg-[#22c55e] px-3 py-1.5 text-xs font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
              >
                Agregar técnico
              </button>
            </div>
            <div className="rounded-xl border theme-border/80 theme-bg-base overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="text-xs theme-text-dim border-b theme-border/80">
                  <tr>
                    <th className="px-3 py-2">Nombre</th>
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2">Zona</th>
                    <th className="px-3 py-2">Ciudad</th>
                    <th className="px-3 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {technicians.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-4 text-center theme-text-dim"
                      >
                        Aún no tienes técnicos registrados.
                      </td>
                    </tr>
                  ) : (
                    technicians.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b theme-border/80 last:border-0"
                      >
                        <td className="px-3 py-2 theme-text-secondary">
                          {t.nombre ?? '—'}
                        </td>
                        <td className="px-3 py-2 theme-text-muted">
                          {t.codigo ?? '—'}
                        </td>
                        <td className="px-3 py-2 theme-text-muted">
                          {t.zona ?? '—'}
                        </td>
                        <td className="px-3 py-2 theme-text-muted">
                          {t.ciudad ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              toggleTechnicianActive(t.id, t.activo ?? false)
                            }
                            className={
                              'rounded-full px-3 py-1 text-xs font-semibold ' +
                              (t.activo
                                ? 'bg-[#22c55e]/20 text-[#22c55e]'
                                : 'bg-zinc-700/40 theme-text-secondary')
                            }
                          >
                            {t.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {techError && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {techError}
              </div>
            )}
        </div>
      </div>
      )}

      {/* D) Integraciones */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Integraciones</h2>
        <p className="mt-1 text-xs theme-text-muted">
          Conecta Cal.com y tu link de Google Review para secuencias y reseñas.
        </p>
        <button
          type="button"
          onClick={() => navigate('/integrations')}
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-3 py-1.5 text-[11px] font-semibold theme-text-secondary ring-1 theme-border hover:ring-[#22c55e] hover:text-[#22c55e] transition"
        >
          <span>🔌</span>
          Gestionar integraciones CRM →
        </button>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm theme-text-muted">Link de Google Review</label>
            <input
              type="url"
              value={googleReviewLink}
              onChange={(e) => setGoogleReviewLink(e.target.value)}
              placeholder="https://g.page/r/tu-negocio/review"
              className="mt-1 w-full max-w-md rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
            <p className="mt-1 text-[11px] theme-text-dim">
              Encuéntralo en Google Business Profile → Pedir reseñas
            </p>
          </div>
          <div>
            <label className="text-sm theme-text-muted">Cal.com API Key</label>
            <input
              type="password"
              value={integrations.calcom_api_key ?? ''}
              onChange={(e) =>
                setIntegrations((p) => ({
                  ...p,
                  calcom_api_key: e.target.value,
                }))
              }
              className="mt-1 w-full max-w-md rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm theme-text-muted">
                Cal.com Event Type ID
              </label>
              <input
                type="text"
                value={integrations.calcom_event_type_id ?? ''}
                onChange={(e) =>
                  setIntegrations((p) => ({
                    ...p,
                    calcom_event_type_id: e.target.value,
                  }))
                }
                placeholder="Ej. 123456"
                className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              />
            </div>
            <div>
              <label className="text-sm theme-text-muted">Cal.com Username</label>
              <input
                type="text"
                value={integrations.calcom_username ?? ''}
                onChange={(e) =>
                  setIntegrations((p) => ({
                    ...p,
                    calcom_username: e.target.value,
                  }))
                }
                placeholder="Ej. jose-daniel"
                className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              />
            </div>
          </div>

          {integrationsError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {integrationsError}
            </div>
          )}
          {integrationsSuccess && (
            <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-2 text-sm text-[#22c55e]">
              Integraciones guardadas.
            </div>
          )}

          <button
            type="button"
            onClick={saveIntegrations}
            disabled={savingIntegrations}
            className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition"
          >
            {savingIntegrations ? 'Guardando...' : 'Guardar integraciones'}
          </button>

          <p className="text-[11px] theme-text-dim">
            ¿Cómo obtener tu API Key? Ve a cal.com → Settings → Developer → API
            Keys → Create new key.
          </p>
        </div>
      </div>

      {/* Modal Agregar técnico */}
      {techModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl border theme-border/80 theme-bg-card p-5">
            <h3 className="text-lg font-semibold theme-text-primary">Agregar técnico</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm theme-text-muted">Nombre</label>
                <input
                  value={techNombre}
                  onChange={(e) => setTechNombre(e.target.value)}
                  className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  placeholder="Nombre del técnico"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="text-sm theme-text-muted">Código</label>
                  <input
                    value={techCodigo}
                    onChange={(e) => setTechCodigo(e.target.value)}
                    className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    placeholder="Opcional"
                  />
                </div>
                <div>
                  <label className="text-sm theme-text-muted">Zona</label>
                  <input
                    value={techZona}
                    onChange={(e) => setTechZona(e.target.value)}
                    className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                    placeholder="Ej. Norte, Sur..."
                  />
                </div>
              </div>
              <div>
                <label className="text-sm theme-text-muted">Ciudad</label>
                <input
                  value={techCiudad}
                  onChange={(e) => setTechCiudad(e.target.value)}
                  className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  placeholder="Ciudad"
                />
              </div>
              {techError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {techError}
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeTechModal}
                className="rounded-lg px-3 py-2 text-sm font-medium theme-text-muted ring-1 theme-border-strong hover:bg-zinc-800/60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveTechnician}
                disabled={savingTech}
                className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] disabled:opacity-60"
              >
                {savingTech ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* E) Seguridad */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Seguridad</h2>
        <p className="mt-1 text-xs theme-text-muted">Cambiar contraseña.</p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-sm theme-text-muted">Nueva contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label className="text-sm theme-text-muted">Confirmar contraseña</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="••••••••"
            />
          </div>
          {passwordError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-2 text-sm text-[#22c55e]">
              Contraseña actualizada.
            </div>
          )}
          <button
            type="button"
            onClick={changePassword}
            disabled={changingPassword}
            className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition"
          >
            Cambiar contraseña
          </button>
        </div>
      </div>

      {/* D) Zona de peligro */}
      <div className="rounded-2xl border border-red-500/30 theme-bg-card p-5">
        <h2 className="text-base font-semibold text-red-200">Zona de peligro</h2>
        <p className="mt-1 text-xs theme-text-muted">
          Eliminar tu cuenta y todos los datos asociados.
        </p>
        <button
          type="button"
          onClick={openDeleteModal}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold theme-text-primary hover:bg-red-500 transition"
        >
          Eliminar mi cuenta
        </button>
      </div>

      {/* Modal eliminar cuenta */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70">
          <div className="w-full max-w-md rounded-2xl border theme-border/80 theme-bg-card p-5">
            <h3 className="text-lg font-semibold theme-text-primary">
              ¿Eliminar tu cuenta?
            </h3>
            <p className="mt-2 text-sm theme-text-muted">
              Esta acción no se puede deshacer. Escribe <strong>ELIMINAR</strong> para
              confirmar.
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="ELIMINAR"
              className="mt-4 w-full rounded-lg theme-bg-base px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            {deleteError && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {deleteError}
              </div>
            )}
            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="rounded-lg px-3 py-2 text-sm font-medium theme-text-muted ring-1 theme-border-strong hover:bg-zinc-800/60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAccount}
                disabled={deleting || deleteConfirm.toLowerCase() !== 'eliminar'}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold theme-text-primary hover:bg-red-500 disabled:opacity-50 transition"
              >
                {deleting ? 'Procesando...' : 'Eliminar cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
