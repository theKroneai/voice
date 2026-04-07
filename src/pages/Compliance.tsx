import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TERMS_VERSION = 'v1.0'

const BUSINESS_TYPES = [
  'Servicios del hogar',
  'Salud',
  'Seguros',
  'Real Estate',
  'Retail',
  'Otro',
] as const

const COUNTRIES = [
  { code: 'US', name: 'Estados Unidos' },
  { code: 'MX', name: 'México' },
  { code: 'CO', name: 'Colombia' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'PE', name: 'Perú' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'ES', name: 'España' },
  { code: 'DO', name: 'República Dominicana' },
  { code: 'PR', name: 'Puerto Rico' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'HN', name: 'Honduras' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'PA', name: 'Panamá' },
  { code: 'OTHER', name: 'Otro' },
] as const

const CONTACT_SOURCES = [
  { id: 'direct', label: 'Clientes que me dieron su número directamente' },
  { id: 'web_optin', label: 'Formulario web con opt-in explícito' },
  { id: 'existing', label: 'Clientes existentes de mi negocio' },
  { id: 'referrals', label: 'Referidos que consintieron ser contactados' },
  { id: 'other', label: 'Otro (especificar)' },
] as const

type ContactSourceId = (typeof CONTACT_SOURCES)[number]['id']

export default function Compliance() {
  const [companyName, setCompanyName] = useState('')
  const [businessType, setBusinessType] = useState<string>(BUSINESS_TYPES[0])
  const [country, setCountry] = useState('US')
  const [website, setWebsite] = useState('')
  const [contactSource, setContactSource] = useState<ContactSourceId>('direct')
  const [contactSourceOther, setContactSourceOther] = useState('')
  const [consentDescription, setConsentDescription] = useState('')
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('')
  const [optInFormUrl, setOptInFormUrl] = useState('')
  const [decl1, setDecl1] = useState(false)
  const [decl2, setDecl2] = useState(false)
  const [decl3, setDecl3] = useState(false)
  const [decl4, setDecl4] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successRef, setSuccessRef] = useState<string | null>(null)
  const [latestSignedAt, setLatestSignedAt] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.user?.id) return
      const { data: profile } = await supabase
        .from('users')
        .select('company_name')
        .eq('id', session.user.id)
        .maybeSingle()
      if (mounted && profile?.company_name) {
        setCompanyName((prev) => prev || profile.company_name || '')
      }
      const { data: last } = await supabase
        .from('compliance_agreements')
        .select('created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (mounted && last?.created_at) {
        setLatestSignedAt(last.created_at)
      }
    })()
    return () => {
      mounted = false
    }
  }, [successRef])

  const hasWebsite = website.trim().length > 0
  const legalClass = 'text-[13px] leading-relaxed text-zinc-400'

  async function handleSign() {
    setSubmitError(null)
    setSuccessRef(null)

    if (!companyName.trim()) {
      setSubmitError('Indica el nombre de tu empresa.')
      return
    }
    if (!businessType) {
      setSubmitError('Selecciona el tipo de negocio.')
      return
    }
    if (!country) {
      setSubmitError('Selecciona el país.')
      return
    }
    if (contactSource === 'other' && !contactSourceOther.trim()) {
      setSubmitError('Describe el origen cuando eliges "Otro".')
      return
    }
    if (consentDescription.trim().length < 50) {
      setSubmitError('La descripción del consentimiento debe tener al menos 50 caracteres.')
      return
    }
    if (!decl1 || !decl2 || !decl3 || !decl4) {
      setSubmitError('Debes marcar las cuatro declaraciones legales obligatorias.')
      return
    }

    setSubmitting(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error('No hay sesión activa.')

      let ip: string | null = null
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json')
        if (ipRes.ok) {
          const j = (await ipRes.json()) as { ip?: string }
          if (j.ip) ip = j.ip
        }
      } catch {
        ip = null
      }

      const userAgent =
        typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 2000) : null

      const { data: inserted, error } = await supabase
        .from('compliance_agreements')
        .insert({
          user_id: userId,
          company_name: companyName.trim(),
          business_type: businessType,
          country,
          website: website.trim() || null,
          contact_source: contactSource,
          contact_source_other:
            contactSource === 'other' ? contactSourceOther.trim() || null : null,
          consent_description: consentDescription.trim(),
          privacy_policy_url: hasWebsite ? privacyPolicyUrl.trim() || null : null,
          opt_in_form_url: hasWebsite ? optInFormUrl.trim() || null : null,
          decl_consent_contacts: true,
          decl_laws: true,
          decl_opt_out: true,
          decl_responsibility: true,
          ip_address: ip,
          user_agent: userAgent,
          terms_version: TERMS_VERSION,
        })
        .select('id')
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!inserted?.id) throw new Error('No se pudo obtener el número de referencia.')

      setSuccessRef(inserted.id)
      setLatestSignedAt(new Date().toISOString())
      setDecl1(false)
      setDecl2(false)
      setDecl3(false)
      setDecl4(false)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Error al guardar la declaración.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-10">
      <div>
        <Link
          to="/settings"
          className="mb-4 inline-block text-sm font-medium text-[#22c55e] hover:text-[#86efac] transition"
        >
          ← Volver a Configuración
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight theme-text-primary sm:text-3xl">
          📋 Declaración de Cumplimiento Legal
        </h1>
        <p className="mt-3 text-sm theme-text-muted whitespace-pre-line">
          Para usar los servicios de llamadas y SMS de Krone Agent AI, debes confirmar que cuentas con el
          consentimiento legal de tus contactos.
        </p>
      </div>

      {latestSignedAt && !successRef ? (
        <div className="rounded-xl border border-[#22c55e]/40 bg-[#22c55e]/10 px-4 py-3 text-sm text-[#86efac]">
          ✅ Ya registraste una declaración el{' '}
          {new Date(latestSignedAt).toLocaleDateString('es', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
          . Puedes enviar una nueva declaración abajo si actualizaste tu negocio u origen de datos (se
          guardará un nuevo registro).
        </div>
      ) : null}

      {successRef ? (
        <div className="rounded-2xl border border-[#22c55e]/50 bg-[#0b0b0b] p-6 ring-1 ring-[#22c55e]/20">
          <h2 className="text-lg font-semibold text-[#22c55e]">Declaración registrada</h2>
          <p className="mt-2 text-sm theme-text-muted">
            Tu firma quedó guardada con fecha y hora, dirección IP y navegador para fines probatorios.
          </p>
          <p className="mt-4 text-sm theme-text-secondary">
            <span className="theme-text-muted">Número de referencia (UUID):</span>
            <br />
            <code className="mt-1 inline-block break-all rounded-lg bg-zinc-900 px-2 py-1 text-xs text-zinc-200">
              {successRef}
            </code>
          </p>
          <p className="mt-2 text-xs text-zinc-500">Versión de términos: {TERMS_VERSION}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/settings"
              className="rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455]"
            >
              Ir a Configuración
            </Link>
            <button
              type="button"
              onClick={() => setSuccessRef(null)}
              className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium theme-text-muted hover:bg-zinc-900"
            >
              Registrar otra declaración
            </button>
          </div>
        </div>
      ) : null}

      {!successRef ? (
        <div className="space-y-8 rounded-2xl border theme-border/80 theme-bg-card p-6 sm:p-8">
          <div>
            <h2 className="text-base font-semibold theme-text-primary">
              1. Información de tu negocio
            </h2>
            <div className="mt-4 space-y-4">
              <div>
                <label className="text-sm theme-text-muted">Nombre de tu empresa</label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                />
              </div>
              <div>
                <label className="text-sm theme-text-muted">Tipo de negocio</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm theme-text-muted">País de operación principal</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm theme-text-muted">Sitio web (opcional)</label>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                  className="mt-1 w-full rounded-lg bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold theme-text-primary">
              2. Origen de tus contactos
            </h2>
            <p className="mt-2 text-sm theme-text-muted">
              ¿Cómo obtuviste los números de teléfono que usarás en tus campañas?
            </p>
            <div className="mt-4 space-y-3">
              {CONTACT_SOURCES.map((opt) => (
                <label
                  key={opt.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800/80 bg-[#0b0b0b]/60 p-3 hover:border-zinc-700"
                >
                  <input
                    type="radio"
                    name="contactSource"
                    checked={contactSource === opt.id}
                    onChange={() => setContactSource(opt.id)}
                    className="mt-1 h-4 w-4 border-zinc-600 text-[#22c55e] focus:ring-[#22c55e]"
                  />
                  <span className="text-sm theme-text-secondary">{opt.label}</span>
                </label>
              ))}
            </div>
            {contactSource === 'other' ? (
              <input
                value={contactSourceOther}
                onChange={(e) => setContactSourceOther(e.target.value)}
                placeholder="Especifica el origen"
                className="mt-3 w-full rounded-lg bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800"
              />
            ) : null}
            <div className="mt-4">
              <label className="text-sm theme-text-muted">
                Describe cómo obtuviste el consentimiento (mínimo 50 caracteres)
              </label>
              <textarea
                value={consentDescription}
                onChange={(e) => setConsentDescription(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              />
              <p className="mt-1 text-xs text-zinc-500">
                {consentDescription.trim().length}/50 caracteres mínimo
              </p>
            </div>
            {hasWebsite ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-sm theme-text-muted">
                    URL de política de privacidad (opcional)
                  </label>
                  <input
                    value={privacyPolicyUrl}
                    onChange={(e) => setPrivacyPolicyUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="text-sm theme-text-muted">
                    URL de formulario de opt-in (opcional)
                  </label>
                  <input
                    value={optInFormUrl}
                    onChange={(e) => setOptInFormUrl(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-[#0b0b0b] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800"
                    placeholder="https://..."
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div>
            <h2 className="text-base font-semibold theme-text-primary">
              3. Declaraciones legales
            </h2>
            <p className={`mt-2 ${legalClass}`}>
              Marca cada casilla para confirmar que lees y aceptas lo indicado.
            </p>
            <div className="mt-4 space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800/80 bg-[#0b0b0b]/60 p-4">
                <input
                  type="checkbox"
                  checked={decl1}
                  onChange={(e) => setDecl1(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-zinc-600 text-[#22c55e] focus:ring-[#22c55e]"
                />
                <span className={legalClass}>
                  Declaro que todos los contactos en mis campañas han dado su consentimiento explícito para
                  recibir llamadas y mensajes de mi empresa.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800/80 bg-[#0b0b0b]/60 p-4">
                <input
                  type="checkbox"
                  checked={decl2}
                  onChange={(e) => setDecl2(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-zinc-600 text-[#22c55e] focus:ring-[#22c55e]"
                />
                <span className={legalClass}>
                  Entiendo y cumplo con las leyes aplicables de mi país incluyendo: TCPA (EE.UU.), Habeas
                  Data (Colombia/LATAM), GDPR (Europa) y regulaciones locales de telecomunicaciones.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800/80 bg-[#0b0b0b]/60 p-4">
                <input
                  type="checkbox"
                  checked={decl3}
                  onChange={(e) => setDecl3(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-zinc-600 text-[#22c55e] focus:ring-[#22c55e]"
                />
                <span className={legalClass}>
                  Me comprometo a incluir opciones de opt-out en todos mis mensajes (responder STOP para SMS)
                  y a respetar inmediatamente estas solicitudes.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-800/80 bg-[#0b0b0b]/60 p-4">
                <input
                  type="checkbox"
                  checked={decl4}
                  onChange={(e) => setDecl4(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-zinc-600 text-[#22c55e] focus:ring-[#22c55e]"
                />
                <span className={legalClass}>
                  Entiendo que Pineapple Group LLC / Krone Agent AI actúa como proveedor de tecnología y que
                  yo, como usuario, soy el único responsable legal del uso de los contactos y del cumplimiento
                  de las leyes aplicables en mi jurisdicción.
                </span>
              </label>
            </div>
          </div>

          {submitError ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {submitError}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSign()}
            disabled={submitting}
            className="w-full rounded-xl bg-[#22c55e] py-3.5 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60"
          >
            {submitting ? 'Guardando…' : '✍️ Firmar Declaración de Cumplimiento'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
