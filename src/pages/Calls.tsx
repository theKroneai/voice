import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type CallRow = {
  id: string
  tipo: 'outbound' | 'inbound'
  contacto: string
  telefono: string
  disposition: string
  duracion_minutos: number | null
  costo_usd: number | null
  created_at: string
  transcripcion: string | null
  resumen: string | null
  sentiment: string | null
  raw: Record<string, unknown>
}

const DISPOSITION_COLOR: Record<string, string> = {
  user_hangup: 'bg-sky-500/20 text-sky-300',
  agent_hangup: 'bg-green-500/20 text-green-300',
  voicemail: 'bg-yellow-500/20 text-yellow-300',
  no_answer: 'bg-zinc-500/20 theme-text-muted',
  dial_no_answer: 'bg-zinc-500/20 theme-text-muted',
  appointed: 'bg-fuchsia-500/20 text-fuchsia-300',
  inbound: 'bg-[#22c55e]/20 text-[#22c55e]',
}

const DISPOSITION_LABEL: Record<string, string> = {
  user_hangup: 'Contestó',
  agent_hangup: 'Completada',
  voicemail: 'Buzón',
  no_answer: 'Sin respuesta',
  dial_no_answer: 'Sin respuesta',
  appointed: 'Cita agendada',
  inbound: 'Entrante',
}

const FILTER_ESTADO_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'user_hangup', label: 'Contestó' },
  { value: 'voicemail', label: 'Buzón' },
  { value: 'no_answer', label: 'Sin respuesta' },
  { value: 'dial_no_answer', label: 'Sin respuesta' },
  { value: 'agent_hangup', label: 'Completada' },
  { value: 'appointed', label: 'Cita agendada' },
  { value: 'inbound', label: 'Entrante' },
]

const PAGE_SIZE = 50

export default function Calls() {
  const [calls, setCalls] = useState<CallRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterTipo, setFilterTipo] = useState<'all' | 'outbound' | 'inbound'>('all')
  const [filterEstado, setFilterEstado] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [detailCall, setDetailCall] = useState<CallRow | null>(null)

  async function loadCalls() {
    setError(null)
    setLoading(true)
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError || !session?.user?.id) {
        setCalls([])
        return
      }
      const userId = session.user.id

      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('id')
        .eq('user_id', userId)
      const campaignIds = campaignsData?.map((c) => c.id) ?? []
      const hasCampaigns = campaignIds.length > 0

      const [outboundRes, inboundRes] = await Promise.all([
        hasCampaigns
          ? supabase
              .from('call_logs')
              .select(`
                id, created_at, duracion_minutos, disposition, campaign_id, resumen, sentiment, transcripcion, costo_usd,
                contacts (nombre, telefono)
              `)
              .in('campaign_id', campaignIds)
              .order('created_at', { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [] }),
        supabase
          .from('call_logs')
          .select(
            'id, created_at, duracion_minutos, disposition, user_id, campaign_id, resumen, sentiment, transcripcion, costo_usd',
          )
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(500),
      ])

      const outboundRaw = (outboundRes as { data?: any[] }).data ?? []
      const inboundRaw = (inboundRes as { data?: any[] }).data ?? []

      const outboundRows: CallRow[] = outboundRaw.map((row: any) => ({
        id: row.id,
        tipo: 'outbound',
        contacto: row.contacts?.nombre ?? 'Desconocido',
        telefono: row.contacts?.telefono ?? '-',
        disposition: row.disposition ?? '',
        duracion_minutos: row.duracion_minutos ?? null,
        costo_usd: row.costo_usd ?? null,
        created_at: row.created_at,
        transcripcion: row.transcripcion ?? null,
        resumen: row.resumen ?? null,
        sentiment: row.sentiment ?? null,
        raw: row,
      }))

      const outboundIds = new Set(outboundRows.map((r) => r.id))
      const inboundRows: CallRow[] = (inboundRaw as any[])
        .filter((row: any) => !outboundIds.has(row.id))
        .map((row: any) => {
          const resumen = row.resumen != null ? String(row.resumen).trim() : ''
          return {
            id: row.id,
            tipo: 'inbound' as const,
            contacto: resumen
              ? resumen.length > 80
                ? `${resumen.slice(0, 80)}…`
                : resumen
              : 'Llamada Inbound',
            telefono: '-',
            disposition: row.disposition ?? 'inbound',
            duracion_minutos: row.duracion_minutos ?? null,
            costo_usd: row.costo_usd ?? null,
            created_at: row.created_at,
            transcripcion: row.transcripcion ?? null,
            resumen: row.resumen ?? null,
            sentiment: row.sentiment ?? null,
            raw: row,
          }
        })

      const combined = [...outboundRows, ...inboundRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      setCalls(combined)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar llamadas.')
      setCalls([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCalls()
  }, [])

  const filtered = calls.filter((c) => {
    if (filterTipo === 'outbound' && c.tipo !== 'outbound') return false
    if (filterTipo === 'inbound' && c.tipo !== 'inbound') return false
    if (filterEstado && c.disposition !== filterEstado) return false
    const d = new Date(c.created_at)
    if (dateFrom && d < new Date(dateFrom + 'T00:00:00')) return false
    if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">
            Llamadas
          </h1>
          <p className="mt-1 text-sm theme-text-muted">
            Historial de llamadas outbound e inbound.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCalls()}
          disabled={loading}
          className="rounded-lg px-3 py-2 text-sm font-medium theme-text-muted ring-1 ring-zinc-800/80 hover:bg-zinc-800/60 hover:theme-text-primary transition disabled:opacity-50"
        >
          ↻ Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="text-xs font-medium theme-text-muted">Tipo</label>
            <select
              value={filterTipo}
              onChange={(e) => {
                setFilterTipo(e.target.value as 'all' | 'outbound' | 'inbound')
                setPage(1)
              }}
              className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              <option value="all">Todos</option>
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium theme-text-muted">Estado</label>
            <select
              value={filterEstado}
              onChange={(e) => {
                setFilterEstado(e.target.value)
                setPage(1)
              }}
              className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            >
              {FILTER_ESTADO_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium theme-text-muted">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
          <div>
            <label className="text-xs font-medium theme-text-muted">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              className="mt-1 w-full rounded-lg theme-bg-base px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border theme-border/80 theme-bg-card overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide theme-text-muted theme-bg-base/80">
              <tr className="border-b theme-border/80">
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Contacto</th>
                <th className="px-5 py-3 font-medium">Teléfono</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Duración</th>
                <th className="px-5 py-3 font-medium">Costo</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-zinc-500">
                    Cargando...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center theme-text-muted">
                    No hay llamadas que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                paginated.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b theme-border/80 last:border-b-0 hover:bg-zinc-900/30 transition"
                  >
                    <td className="px-5 py-3">
                      <span
                        className={
                          c.tipo === 'outbound'
                            ? 'inline-flex items-center rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-300'
                            : 'inline-flex items-center rounded-full bg-[#22c55e]/20 px-2 py-0.5 text-xs font-medium text-[#22c55e]'
                        }
                      >
                        {c.tipo === 'outbound' ? '📞 Out' : '📲 In'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-100">{c.contacto}</td>
                    <td className="px-5 py-3 theme-text-muted">{c.telefono}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          DISPOSITION_COLOR[c.disposition] ?? 'bg-zinc-700/30 theme-text-muted'
                        }`}
                      >
                        {DISPOSITION_LABEL[c.disposition] ?? (c.disposition || '—')}
                      </span>
                    </td>
                    <td className="px-5 py-3 theme-text-muted">
                      {c.duracion_minutos != null
                        ? `${Math.round(c.duracion_minutos)} min`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 theme-text-muted">
                      {c.costo_usd != null ? `$${Number(c.costo_usd).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-5 py-3 theme-text-muted">
                      {new Date(c.created_at).toLocaleString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailCall(c)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#22c55e] ring-1 ring-[#22c55e]/50 hover:bg-[#22c55e]/10 transition"
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-4 border-t theme-border/80 px-5 py-3">
            <div className="text-xs text-zinc-500">
              {filtered.length} llamadas · página {currentPage} de {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="rounded-lg px-3 py-2 text-sm font-medium theme-text-muted ring-1 ring-zinc-800/80 hover:bg-zinc-800/60 disabled:opacity-50 disabled:pointer-events-none"
              >
                Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="rounded-lg px-3 py-2 text-sm font-medium theme-text-muted ring-1 ring-zinc-800/80 hover:bg-zinc-800/60 disabled:opacity-50 disabled:pointer-events-none"
              >
                Siguiente
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Modal detalle */}
      {detailCall ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setDetailCall(null)}
            className="absolute inset-0 z-0"
            aria-label="Cerrar"
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border theme-border/80 theme-bg-card shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b theme-border/80 px-5 py-4 shrink-0">
              <div>
                <div className="text-base font-semibold theme-text-primary">
                  Detalle de la llamada
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span
                    className={
                      detailCall.tipo === 'outbound'
                        ? 'inline-flex items-center rounded-full bg-sky-500/20 px-2 py-0.5 text-xs font-medium text-sky-300'
                        : 'inline-flex items-center rounded-full bg-[#22c55e]/20 px-2 py-0.5 text-xs font-medium text-[#22c55e]'
                    }
                  >
                    {detailCall.tipo === 'outbound' ? '📞 Outbound' : '📲 Inbound'}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      DISPOSITION_COLOR[detailCall.disposition] ?? 'bg-zinc-700/30 theme-text-muted'
                    }`}
                  >
                    {DISPOSITION_LABEL[detailCall.disposition] ?? detailCall.disposition}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-zinc-700/40 px-2 py-0.5 text-xs font-medium theme-text-muted">
                    {detailCall.duracion_minutos != null
                      ? `${Math.round(detailCall.duracion_minutos)} min`
                      : '—'}
                  </span>
                  {detailCall.costo_usd != null ? (
                    <span className="inline-flex items-center rounded-full bg-zinc-700/40 px-2 py-0.5 text-xs font-medium theme-text-muted">
                      ${Number(detailCall.costo_usd).toFixed(2)}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailCall(null)}
                className="rounded-lg p-2 theme-text-muted hover:bg-zinc-800/80 hover:theme-text-primary transition"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Contacto</div>
                  <div className="mt-1 text-sm theme-text-primary">{detailCall.contacto}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Teléfono</div>
                  <div className="mt-1 text-sm theme-text-primary">{detailCall.telefono}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Fecha</div>
                  <div className="mt-1 text-sm theme-text-primary">
                    {new Date(detailCall.created_at).toLocaleString('es-ES', {
                      dateStyle: 'full',
                      timeStyle: 'medium',
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Duración</div>
                  <div className="mt-1 text-sm theme-text-primary">
                    {detailCall.duracion_minutos != null
                      ? `${Math.round(detailCall.duracion_minutos)} min`
                      : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-zinc-500">Costo</div>
                  <div className="mt-1 text-sm theme-text-primary">
                    {detailCall.costo_usd != null
                      ? `$${Number(detailCall.costo_usd).toFixed(2)}`
                      : '—'}
                  </div>
                </div>
                {detailCall.sentiment ? (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Sentimiento</div>
                    <div className="mt-1 text-sm theme-text-primary">{detailCall.sentiment}</div>
                  </div>
                ) : null}
              </div>

              {detailCall.transcripcion ? (
                <div>
                  <div className="text-sm font-semibold theme-text-primary mb-2">
                    Transcripción de la llamada
                  </div>
                  <div className="rounded-lg border theme-border/80 theme-bg-base p-4 max-h-64 overflow-y-auto text-sm theme-text-muted whitespace-pre-wrap">
                    {detailCall.transcripcion}
                  </div>
                </div>
              ) : null}

              {detailCall.resumen ? (
                <div>
                  <div className="text-sm font-semibold theme-text-primary mb-2">Resumen</div>
                  <div className="rounded-lg border theme-border/80 theme-bg-base p-4 text-sm theme-text-muted whitespace-pre-wrap">
                    {detailCall.resumen}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
