import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

type Appointment = {
  id: string
  user_id: string
  contact_name: string | null
  contact_phone: string | null
  contact_address: string | null
  contact_city: string | null
  tecnico_nombre: string | null
  start_time: string
  partner_present: boolean | null
  status: string | null
  door_hanger_code: string | null
  created_at?: string
}

const STATUS_FILTER = ['all', 'scheduled', 'cancelled'] as const
const DATE_FILTER = ['week', 'month', 'all'] as const

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getWeekBounds() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { start: monday, end: sunday }
}

function getMonthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTER)[number]>('all')
  const [dateFilter, setDateFilter] = useState<(typeof DATE_FILTER)[number]>('all')
  const [completingId, setCompletingId] = useState<string | null>(null)

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

        const { data, error } = await supabase
          .from('appointments')
          .select(
            'id, user_id, contact_name, contact_phone, contact_address, contact_city, tecnico_nombre, start_time, partner_present, status, door_hanger_code, created_at',
          )
          .eq('user_id', userId)
          .order('start_time', { ascending: false })

        if (error) throw error
        if (mounted) setAppointments((data ?? []) as Appointment[])
      } catch {
        if (mounted) setAppointments([])
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [])

  const filtered = useMemo(() => {
    let list = [...appointments]

    if (statusFilter === 'scheduled') {
      list = list.filter((a) => a.status === 'scheduled')
    } else if (statusFilter === 'cancelled') {
      list = list.filter((a) => a.status === 'cancelled')
    }

    if (dateFilter === 'week') {
      const { start, end } = getWeekBounds()
      list = list.filter((a) => {
        const t = new Date(a.start_time).getTime()
        return t >= start.getTime() && t <= end.getTime()
      })
    } else if (dateFilter === 'month') {
      const { start, end } = getMonthBounds()
      list = list.filter((a) => {
        const t = new Date(a.start_time).getTime()
        return t >= start.getTime() && t <= end.getTime()
      })
    }

    return list
  }, [appointments, statusFilter, dateFilter])

  const metrics = useMemo(() => {
    const now = new Date()
    const { start: weekStart, end: weekEnd } = getWeekBounds()
    const total = appointments.length
    const thisWeek = appointments.filter((a) => {
      const t = new Date(a.start_time).getTime()
      return t >= weekStart.getTime() && t <= weekEnd.getTime()
    }).length
    const pending = appointments.filter((a) => a.status === 'scheduled').length
    return { total, thisWeek, pending }
  }, [appointments])

  async function markCompleted(id: string) {
    setCompletingId(id)
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'completed' })
        .eq('id', id)
      if (error) throw error
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'completed' } : a)),
      )
    } catch {
      // opcional: toast o setError
    } finally {
      setCompletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm theme-text-muted">Cargando citas...</span>
      </div>
    )
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">
          Citas agendadas
        </h1>
        <p className="mt-1 text-sm theme-text-muted">
          Gestiona y filtra tus citas por estado y fecha.
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-4">
          <div className="text-xs theme-text-muted">Total citas agendadas</div>
          <div className="mt-1 text-2xl font-semibold theme-text-primary">
            {metrics.total}
          </div>
        </div>
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-4">
          <div className="text-xs theme-text-muted">Citas esta semana</div>
          <div className="mt-1 text-2xl font-semibold theme-text-primary">
            {metrics.thisWeek}
          </div>
        </div>
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-4">
          <div className="text-xs theme-text-muted">Citas pendientes</div>
          <div className="mt-1 text-2xl font-semibold text-[#22c55e]">
            {metrics.pending}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border theme-border/80 theme-bg-card p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs theme-text-muted">Estado:</span>
          <div className="inline-flex rounded-lg theme-bg-base p-1 ring-1 ring-zinc-800/80">
            {STATUS_FILTER.map((s) => {
              const label =
                s === 'all'
                  ? 'Todos'
                  : s === 'scheduled'
                    ? 'Pendientes'
                    : 'Canceladas'
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={
                    'rounded-md px-3 py-1.5 text-xs font-medium transition ' +
                    (statusFilter === s
                      ? 'bg-[#22c55e] text-[#0b0b0b]'
                      : 'theme-text-muted hover:bg-zinc-800/60')
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs theme-text-muted">Fecha:</span>
          <div className="inline-flex rounded-lg theme-bg-base p-1 ring-1 ring-zinc-800/80">
            {DATE_FILTER.map((d) => {
              const label =
                d === 'week'
                  ? 'Esta semana'
                  : d === 'month'
                    ? 'Este mes'
                    : 'Todas'
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDateFilter(d)}
                  className={
                    'rounded-md px-3 py-1.5 text-xs font-medium transition ' +
                    (dateFilter === d
                      ? 'bg-[#22c55e] text-[#0b0b0b]'
                      : 'theme-text-muted hover:bg-zinc-800/60')
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b theme-border/80 theme-bg-base text-xs theme-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Dirección</th>
                <th className="px-4 py-3 font-medium">Técnico</th>
                <th className="px-4 py-3 font-medium">Fecha/Hora</th>
                <th className="px-4 py-3 font-medium">¿Pareja presente?</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Código door hanger</th>
                <th className="px-4 py-3 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-zinc-500"
                  >
                    No hay citas que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b theme-border/60 last:border-0 hover:bg-zinc-900/40 transition"
                  >
                    <td className="px-4 py-3 text-zinc-200">
                      {a.contact_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 theme-text-muted">
                      {a.contact_phone ?? '—'}
                    </td>
                    <td className="px-4 py-3 theme-text-muted max-w-[180px]">
                      {[a.contact_address, a.contact_city]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3 theme-text-muted">
                      {a.tecnico_nombre ?? '—'}
                    </td>
                    <td className="px-4 py-3 theme-text-muted whitespace-nowrap">
                      {formatDateTime(a.start_time)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ' +
                          (a.partner_present
                            ? 'bg-[#22c55e]/20 text-[#22c55e]'
                            : 'bg-zinc-700/40 theme-text-muted')
                        }
                      >
                        {a.partner_present ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ' +
                          (a.status === 'scheduled'
                            ? 'bg-amber-500/20 text-amber-300'
                            : a.status === 'completed'
                              ? 'bg-[#22c55e]/20 text-[#22c55e]'
                              : 'bg-red-500/20 text-red-300')
                        }
                      >
                        {a.status === 'scheduled'
                          ? 'Pendiente'
                          : a.status === 'completed'
                            ? 'Completada'
                            : a.status === 'cancelled'
                              ? 'Cancelada'
                              : a.status ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 theme-text-muted font-mono text-xs">
                      {a.door_hanger_code ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.status === 'scheduled' ? (
                        <button
                          type="button"
                          onClick={() => markCompleted(a.id)}
                          disabled={completingId === a.id}
                          className="rounded-lg bg-[#22c55e] px-3 py-1.5 text-xs font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:opacity-60 transition"
                        >
                          {completingId === a.id
                            ? 'Guardando...'
                            : 'Marcar como completada'}
                        </button>
                      ) : (
                        <span className="text-zinc-500 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
