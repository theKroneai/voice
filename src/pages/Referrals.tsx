import { useEffect, useState } from 'react'
import { Copy, ChevronDown, ChevronUp, Link2, MessageCircle, DollarSign } from 'lucide-react'
import { supabase } from '../lib/supabase'

const WHATSAPP_GREEN = '#25D366'
const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://voice.kronecrm.com'
const REGISTER_LINK_PATH = '/login'

type ReferralRow = {
  id: string
  referred_id: string
  status: string
  created_at: string
  referred_email: string | null
  referred_company: string | null
  total_consumo_usd: number
  total_comision_usd: number
}

type TransactionRow = {
  id: string
  referral_id: string
  referred_id: string
  consumo_minutos: number
  consumo_usd: number
  comision_usd: number
  status: string
  acreditado_at: string | null
  created_at: string
  referred_email: string | null
  referred_company: string | null
}

export default function Referrals() {
  const [referralCode, setReferralCode] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [saldoReferidos, setSaldoReferidos] = useState<number>(0)
  const [totalReferidos, setTotalReferidos] = useState(0)
  const [referidosActivos, setReferidosActivos] = useState(0)
  const [totalGanado, setTotalGanado] = useState(0)
  const [esteMes, setEsteMes] = useState(0)
  const [referralsList, setReferralsList] = useState<ReferralRow[]>([])
  const [transactionsList, setTransactionsList] = useState<TransactionRow[]>([])
  const [termsOpen, setTermsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copyDone, setCopyDone] = useState(false)

  const shareLink = referralCode ? `${BASE_URL}${REGISTER_LINK_PATH}?ref=${encodeURIComponent(referralCode)}` : ''
  const whatsappMessage = referralCode
    ? `Hola! Te comparto Krone Agent AI, una plataforma de agentes de voz con IA para tu negocio. Úsala para hacer llamadas automáticas de ventas 24/7. Regístrate aquí y ambos ganamos créditos: ${shareLink}`
    : ''

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) return

      const [userRes, creditsRes, refListRes, transRes] = await Promise.all([
        supabase.from('users').select('referral_code').eq('id', userId).maybeSingle(),
        supabase.from('credits').select('saldo_referidos_usd').eq('user_id', userId).maybeSingle(),
        supabase.rpc('get_my_referrals_with_details') as Promise<{ data: ReferralRow[] | null }>,
        supabase.rpc('get_my_referral_transactions') as Promise<{ data: TransactionRow[] | null }>,
      ])

      if (userRes.data?.referral_code) setReferralCode(userRes.data.referral_code)
      const saldo = creditsRes.data?.saldo_referidos_usd
      setSaldoReferidos(typeof saldo === 'number' ? saldo : Number(saldo) || 0)

      const refList = refListRes.data ?? []
      setReferralsList(refList)
      setTotalReferidos(refList.length)
      const activos = refList.filter((r) => r.status === 'active').length
      setReferidosActivos(activos)

      const trans = transRes.data ?? []
      setTransactionsList(trans)
      const totalComision = trans.reduce((s, t) => s + Number(t.comision_usd || 0), 0)
      setTotalGanado(totalComision)
      const now = new Date()
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const esteMesSum = trans
        .filter((t) => t.created_at >= startMonth)
        .reduce((s, t) => s + Number(t.comision_usd || 0), 0)
      setEsteMes(esteMesSum)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateCode() {
    setGeneratingCode(true)
    try {
      const { data, error } = await supabase.rpc('generate_referral_code')
      if (error) throw new Error(error.message)
      if (data) setReferralCode(data)
      await loadAll()
    } catch {
      // toast o mensaje
    } finally {
      setGeneratingCode(false)
    }
  }

  function copyCode() {
    if (!shareLink) return
    navigator.clipboard.writeText(shareLink)
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

  function shareWhatsApp() {
    if (!whatsappMessage) return
    const url = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`
    window.open(url, '_blank')
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return iso
    }
  }

  if (loading && !referralCode) {
    return (
      <div className="theme-bg-base min-h-screen flex items-center justify-center">
        <div className="theme-text-muted">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="theme-bg-base theme-text-secondary min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="rounded-xl border theme-border theme-bg-card p-6">
          <h1 className="text-xl font-semibold theme-text-primary mb-4">Programa de Referidos</h1>
          <div className="flex flex-wrap items-center gap-3">
            {referralCode ? (
              <>
                <span className="text-sm theme-text-muted">Tu código:</span>
                <code className="px-3 py-1.5 rounded-lg bg-[#22c55e]/10 text-[#22c55e] font-mono font-semibold">
                  {referralCode}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium theme-bg-input hover:bg-zinc-600/50 transition"
                >
                  <Copy className="h-4 w-4" />
                  {copyDone ? '¡Copiado!' : 'Copiar código'}
                </button>
                <button
                  type="button"
                  onClick={shareWhatsApp}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
                  style={{ backgroundColor: WHATSAPP_GREEN }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Compartir por WhatsApp
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleGenerateCode}
                disabled={generatingCode}
                className="rounded-lg px-4 py-2 text-sm font-semibold bg-[#22c55e] text-white hover:opacity-90 disabled:opacity-60"
              >
                {generatingCode ? 'Generando...' : 'Generar mi código'}
              </button>
            )}
          </div>
          {referralCode && (
            <p className="mt-3 text-sm theme-text-muted flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Link completo: <span className="theme-text-secondary break-all">{shareLink}</span>
            </p>
          )}
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border theme-border theme-bg-card p-4">
            <div className="flex items-center gap-2 text-sm theme-text-muted mb-1">👥 Total referidos</div>
            <div className="text-2xl font-semibold theme-text-primary">{totalReferidos}</div>
          </div>
          <div className="rounded-xl border theme-border theme-bg-card p-4">
            <div className="flex items-center gap-2 text-sm theme-text-muted mb-1">✅ Referidos activos</div>
            <div className="text-2xl font-semibold theme-text-primary">{referidosActivos}</div>
          </div>
          <div className="rounded-xl border theme-border theme-bg-card p-4">
            <div className="flex items-center gap-2 text-sm theme-text-muted mb-1">💰 Total ganado</div>
            <div className="text-2xl font-semibold text-[#22c55e]">${totalGanado.toFixed(2)}</div>
          </div>
          <div className="rounded-xl border theme-border theme-bg-card p-4">
            <div className="flex items-center gap-2 text-sm theme-text-muted mb-1">📅 Este mes</div>
            <div className="text-2xl font-semibold theme-text-primary">${esteMes.toFixed(2)}</div>
          </div>
        </div>

        {/* Saldo disponible */}
        <div className="rounded-xl border-2 border-[#22c55e]/50 bg-[#22c55e]/10 p-6">
          <div className="flex items-center gap-2 text-[#22c55e] font-semibold text-lg mb-1">
            <DollarSign className="h-5 w-5" />
            Saldo de referidos disponible: ${saldoReferidos.toFixed(2)}
          </div>
          <p className="text-sm theme-text-muted">Se acredita automáticamente como créditos de voz.</p>
        </div>

        {/* Cómo funciona */}
        <div className="rounded-xl border theme-border theme-bg-card p-6">
          <h2 className="text-lg font-semibold theme-text-primary mb-4">Cómo funciona</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex gap-3">
              <span className="text-2xl">🔗</span>
              <div>
                <div className="font-medium theme-text-primary">Comparte tu código único</div>
                <p className="text-sm theme-text-muted mt-1">Usa el link o compártelo por WhatsApp.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl">👤</span>
              <div>
                <div className="font-medium theme-text-primary">Tu referido se registra y consume minutos</div>
                <p className="text-sm theme-text-muted mt-1">Cuando haga su primera recarga pasa a activo.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <div className="font-medium theme-text-primary">Ganas 20% de por vida</div>
                <p className="text-sm theme-text-muted mt-1">De todo lo que consuma, sin límite de referidos.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de referidos */}
        <div className="rounded-xl border theme-border theme-bg-card overflow-hidden">
          <h2 className="text-lg font-semibold theme-text-primary p-4 border-b theme-border">Lista de referidos</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="theme-bg-input/50">
                  <th className="text-left p-3 theme-text-muted font-medium">Nombre / Email</th>
                  <th className="text-left p-3 theme-text-muted font-medium">Estado</th>
                  <th className="text-right p-3 theme-text-muted font-medium">Total consumido</th>
                  <th className="text-right p-3 theme-text-muted font-medium">Comisión</th>
                  <th className="text-left p-3 theme-text-muted font-medium">Fecha registro</th>
                </tr>
              </thead>
              <tbody>
                {referralsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center theme-text-muted">
                      Aún no tienes referidos. Comparte tu link para empezar.
                    </td>
                  </tr>
                ) : (
                  referralsList.map((r) => (
                    <tr key={r.id} className="border-t theme-border">
                      <td className="p-3">
                        <span className="theme-text-primary">{r.referred_company || r.referred_email || '—'}</span>
                        {r.referred_email && r.referred_company && (
                          <span className="block text-xs theme-text-muted">{r.referred_email}</span>
                        )}
                      </td>
                      <td className="p-3">
                        {r.status === 'active' ? (
                          <span className="text-[#22c55e]">✅ Activo</span>
                        ) : (
                          <span className="theme-text-muted">⏳ Pendiente</span>
                        )}
                      </td>
                      <td className="p-3 text-right">${Number(r.total_consumo_usd || 0).toFixed(2)}</td>
                      <td className="p-3 text-right text-[#22c55e]">${Number(r.total_comision_usd || 0).toFixed(2)}</td>
                      <td className="p-3 theme-text-muted">{formatDate(r.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Historial de comisiones */}
        <div className="rounded-xl border theme-border theme-bg-card overflow-hidden">
          <h2 className="text-lg font-semibold theme-text-primary p-4 border-b theme-border">Historial de comisiones</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="theme-bg-input/50">
                  <th className="text-left p-3 theme-text-muted font-medium">Fecha</th>
                  <th className="text-left p-3 theme-text-muted font-medium">Referido</th>
                  <th className="text-right p-3 theme-text-muted font-medium">Consumo</th>
                  <th className="text-right p-3 theme-text-muted font-medium">Tu comisión (20%)</th>
                  <th className="text-left p-3 theme-text-muted font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {transactionsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center theme-text-muted">
                      No hay comisiones aún.
                    </td>
                  </tr>
                ) : (
                  transactionsList.map((t) => (
                    <tr key={t.id} className="border-t theme-border">
                      <td className="p-3 theme-text-muted">{formatDate(t.created_at)}</td>
                      <td className="p-3 theme-text-primary">{t.referred_company || t.referred_email || '—'}</td>
                      <td className="p-3 text-right">${Number(t.consumo_usd || 0).toFixed(2)}</td>
                      <td className="p-3 text-right text-[#22c55e]">${Number(t.comision_usd || 0).toFixed(2)}</td>
                      <td className="p-3">
                        {t.status === 'acreditado' ? (
                          <span className="text-[#22c55e]">✅ Acreditado</span>
                        ) : (
                          <span className="theme-text-muted">⏳ Pendiente (acredita en 48h)</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Términos colapsables */}
        <div className="rounded-xl border theme-border theme-bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setTermsOpen(!termsOpen)}
            className="w-full flex items-center justify-between p-4 text-left theme-text-primary font-medium hover:bg-white/5 transition"
          >
            Términos del programa
            {termsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
          {termsOpen && (
            <div className="px-4 pb-4 text-sm theme-text-muted space-y-2 border-t theme-border pt-3">
              <p>• 20% de comisión sobre minutos consumidos por tus referidos.</p>
              <p>• Se acredita 48h después del consumo.</p>
              <p>• De por vida — sin límite de referidos.</p>
              <p>• Créditos no canjeables por efectivo.</p>
              <p>• La comisión se activa con la primera recarga del referido.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
