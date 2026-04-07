import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type SmsRow = {
  id: string
  destinatario: string
  numero: string
  mensaje: string
  estado: 'enviado' | 'fallido' | 'pendiente' | string
  created_at: string
  respuesta?: boolean
}

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

const MSG_TRUNCATE = 60

function truncate(str: string, max: number): string {
  if (!str || str.length <= max) return str
  return str.slice(0, max) + '…'
}

export default function SMS() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<SmsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalEnviados, setTotalEnviados] = useState(0)
  const [semanaEnviados, setSemanaEnviados] = useState(0)
  const [tasaRespuesta, setTasaRespuesta] = useState<number | null>(null)

  async function loadSms() {
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

      const list = (rows ?? []) as any[]
      const now = new Date()
      const inicioSemana = new Date(now)
      inicioSemana.setDate(now.getDate() - 6)
      inicioSemana.setHours(0, 0, 0, 0)

      const mapped: SmsRow[] = list.map((r: any) => ({
        id: r.id,
        destinatario:
          r.destinatario ?? r.contact_name ?? r.nombre ?? r.to_name ?? r.numero ?? '-',
        numero: r.numero ?? r.to_number ?? r.telefono ?? r.phone ?? '-',
        mensaje: r.mensaje ?? r.message ?? r.body ?? '',
        estado: (r.estado ?? r.status ?? 'pendiente').toLowerCase(),
        created_at: r.created_at,
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
  }

  useEffect(() => {
    loadSms()
  }, [])

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">
            SMS
          </h1>
          <p className="mt-1 text-sm theme-text-muted">
            Historial de mensajes enviados.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadSms()}
          disabled={loading}
          className="rounded-lg px-3 py-2 text-sm font-medium theme-text-muted ring-1 theme-border hover:theme-bg-hover hover:theme-text-primary transition disabled:opacity-50"
        >
          ↻ Actualizar
        </button>
      </div>

      {/* Métricas */}
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
            Activa SMS en tus campañas para comenzar.
          </p>
          <button
            type="button"
            onClick={() => navigate('/campaigns')}
            className="mt-4 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
          >
            Ir a Campañas
          </button>
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
    </section>
  )
}
