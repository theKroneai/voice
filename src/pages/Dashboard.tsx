import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarCheck, Clock, Phone, TrendingUp } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

type RecentCall = {
  contacto: string
  telefono: string
  estado: string
  duracion: string
  fecha: string
  disposition: string
  tipo: 'outbound' | 'inbound'
}

type ActiveCampaign = {
  nombre: string
  tipoAgente: string
  contactosTotales: number
  progreso: number
}

type HourData = { hora: string; llamadas: number }
type DayData = { dia: string; llamadas: number }

const dispositionColor: Record<string, string> = {
  user_hangup: 'bg-sky-500/20 text-sky-300',
  agent_hangup: 'bg-green-500/20 text-green-300',
  voicemail: 'bg-yellow-500/20 text-yellow-300',
  no_answer: 'bg-zinc-500/20 theme-text-muted',
  dial_no_answer: 'bg-zinc-500/20 theme-text-muted',
  appointed: 'bg-fuchsia-500/20 text-fuchsia-300',
  inbound: 'bg-[#22c55e]/20 text-[#22c55e]',
}

const dispositionLabel: Record<string, string> = {
  user_hangup: 'Contestó',
  agent_hangup: 'Completada',
  voicemail: 'Buzón',
  no_answer: 'Sin respuesta',
  dial_no_answer: 'Sin respuesta',
  appointed: 'Cita agendada',
  inbound: 'Entrante',
}

const META_LLAMADAS_DIA = 50

function getSaludoByHora(): string {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return 'Buenos días'
  if (h >= 12 && h < 18) return 'Buenas tardes'
  if (h >= 18 && h < 23) return 'Buenas noches'
  return 'Buenos días'
}

export default function Dashboard() {
  const [companyName, setCompanyName] = useState('')
  const [minutosDisponibles, setMinutosDisponibles] = useState(0)
  const [llamadasHoy, setLlamadasHoy] = useState(0)
  const [llamadasSemana, setLlamadasSemana] = useState(0)
  const [citasAgendadas, setCitasAgendadas] = useState(0)
  const [citasAgendadasHoy, setCitasAgendadasHoy] = useState(0)
  const [tasaContacto, setTasaContacto] = useState(0)
  const [tasaContactoHoy, setTasaContactoHoy] = useState(0)
  const [costoDia, setCostoDia] = useState(0)
  const [callbacksPendientes, setCallbacksPendientes] = useState(0)
  const [llamadasRecientes, setLlamadasRecientes] = useState<RecentCall[]>([])
  const [campanas, setCampanas] = useState<ActiveCampaign[]>([])
  const [campanasActivas, setCampanasActivas] = useState(0)
  const [horasData, setHorasData] = useState<HourData[]>([])
  const [diasData, setDiasData] = useState<DayData[]>([])
  const [referidosActivos, setReferidosActivos] = useState(0)
  const [totalGanadoReferidos, setTotalGanadoReferidos] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboard()
  }, [])

  async function fetchDashboard() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('users')
        .select('id, es_admin, onboarding_completado, nombre')
        .eq('id', user.id)
        .maybeSingle()
      // eslint-disable-next-line no-console
      console.log('users data:', data)
      // eslint-disable-next-line no-console
      console.log('users error:', error)

      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const manana = new Date(hoy)
      manana.setDate(manana.getDate() + 1)
      const inicioSemana = new Date(hoy)
      inicioSemana.setDate(hoy.getDate() - 6)

      // Nombre de empresa (para saludo)
      const { data: userRow, error: userRowErr } = await supabase
        .from('users')
        .select('company_name')
        .eq('id', user.id)
        .maybeSingle()
      // eslint-disable-next-line no-console
      console.log('users data:', userRow)
      // eslint-disable-next-line no-console
      console.log('users error:', userRowErr)
      setCompanyName(userRow?.company_name?.trim() ?? '')

      const { data: credits } = await supabase
        .from('credits')
        .select('minutos_voz')
        .eq('user_id', user.id)
        .maybeSingle()
      if (credits) setMinutosDisponibles(credits.minutos_voz ?? 0)

      // Referidos: activos y total ganado
      const [
        { data: referralsData },
        { data: refTransactions },
      ] = await Promise.all([
        supabase.from('referrals').select('id, status').eq('referrer_id', user.id),
        supabase.from('referral_transactions').select('comision_usd').eq('referrer_id', user.id),
      ])
      const refList = referralsData ?? []
      setReferidosActivos(refList.filter((r: { status: string }) => r.status === 'active').length)
      const totalRef = (refTransactions ?? []).reduce((s: number, t: { comision_usd?: number | null }) => s + (Number(t.comision_usd) || 0), 0)
      setTotalGanadoReferidos(totalRef)

      // Call logs del usuario (via campaigns)
      const { data: userCampaigns } = await supabase
        .from('campaigns')
        .select('id')
        .eq('user_id', user.id)

      const campaignIds = userCampaigns?.map((c) => c.id) ?? []
      const hasCampaigns = campaignIds.length > 0

      // Llamadas hoy (outbound + inbound). Si no hay campañas, no usar .in() con array vacío.
      const [
        outboundHoyRes,
        { count: countInboundHoy },
      ] = await Promise.all([
        hasCampaigns
          ? supabase
              .from('call_logs')
              .select('*', { count: 'exact', head: true })
              .in('campaign_id', campaignIds)
              .gte('created_at', hoy.toISOString())
          : Promise.resolve({ count: 0 }),
        supabase
          .from('call_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('disposition', 'inbound')
          .gte('created_at', hoy.toISOString()),
      ])
      const countOutboundHoy = hasCampaigns ? (outboundHoyRes as { count?: number }).count : 0
      setLlamadasHoy((countOutboundHoy ?? 0) + (countInboundHoy ?? 0))

      // Llamadas semana (outbound + inbound)
      const [
        outboundSemanaRes,
        { count: countInboundSemana },
      ] = await Promise.all([
        hasCampaigns
          ? supabase
              .from('call_logs')
              .select('*', { count: 'exact', head: true })
              .in('campaign_id', campaignIds)
              .gte('created_at', inicioSemana.toISOString())
          : Promise.resolve({ count: 0 }),
        supabase
          .from('call_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('disposition', 'inbound')
          .gte('created_at', inicioSemana.toISOString()),
      ])
      const countOutboundSemana = hasCampaigns ? (outboundSemanaRes as { count?: number }).count : 0
      setLlamadasSemana((countOutboundSemana ?? 0) + (countInboundSemana ?? 0))

      // Citas agendadas (contacts appointed + appointments scheduled)
      const [
        contactsCitasRes,
        appointmentsRes,
      ] = await Promise.all([
        hasCampaigns
          ? supabase
              .from('contacts')
              .select('*', { count: 'exact', head: true })
              .in('campaign_id', campaignIds)
              .eq('disposition', 'appointed')
          : Promise.resolve({ count: 0 }),
        supabase
          .from('appointments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'scheduled'),
      ])
      const countContactsCitas = hasCampaigns ? (contactsCitasRes as { count?: number }).count : 0
      const countAppointments = (appointmentsRes as { count?: number }).count
      setCitasAgendadas((countContactsCitas ?? 0) + (countAppointments ?? 0))

      // Citas agendadas hoy (appointments creados hoy)
      const { count: citasHoyCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .gte('created_at', hoy.toISOString())
        .lt('created_at', manana.toISOString())
      setCitasAgendadasHoy(citasHoyCount ?? 0)

      // Tasa de contacto (contactados / total llamadas semana; inbound cuenta como contactado)
      const totalSemana = (countOutboundSemana ?? 0) + (countInboundSemana ?? 0)
      const contactadosRes = hasCampaigns
        ? await supabase
            .from('call_logs')
            .select('*', { count: 'exact', head: true })
            .in('campaign_id', campaignIds)
            .gte('created_at', inicioSemana.toISOString())
            .in('disposition', ['user_hangup', 'agent_hangup'])
        : { count: 0 }
      const countContactadosNum = (contactadosRes as { count?: number })?.count ?? 0
      const contactadosTotal = countContactadosNum + (countInboundSemana ?? 0)
      const tasa =
        totalSemana > 0
          ? Math.round((contactadosTotal / totalSemana) * 100)
          : 0
      setTasaContacto(tasa)

      // Tasa de contacto hoy (para rendimiento)
      const [
        contactadosOutboundHoyRes,
        { data: inboundLogsHoy },
      ] = await Promise.all([
        hasCampaigns
          ? supabase
              .from('call_logs')
              .select('*', { count: 'exact', head: true })
              .in('campaign_id', campaignIds)
              .gte('created_at', hoy.toISOString())
              .in('disposition', ['user_hangup', 'agent_hangup'])
          : Promise.resolve({ count: 0 }),
        supabase
          .from('call_logs')
          .select('id')
          .eq('user_id', user.id)
          .eq('disposition', 'inbound')
          .gte('created_at', hoy.toISOString()),
      ])
      const contactadosOutboundHoy = hasCampaigns ? (contactadosOutboundHoyRes as { count?: number }).count ?? 0 : 0
      const contactadosHoyTotal = contactadosOutboundHoy + (inboundLogsHoy?.length ?? 0)
      const totalLlamadasHoy = (countOutboundHoy ?? 0) + (countInboundHoy ?? 0)
      const tasaHoy = totalLlamadasHoy > 0 ? Math.round((contactadosHoyTotal / totalLlamadasHoy) * 100) : 0
      setTasaContactoHoy(tasaHoy)

      // Costo del día (suma costo de call_logs de hoy)
      const [
        { data: outboundLogsCosto },
        { data: inboundLogsCosto },
      ] = await Promise.all([
        hasCampaigns
          ? supabase
              .from('call_logs')
              .select('costo')
              .in('campaign_id', campaignIds)
              .gte('created_at', hoy.toISOString())
          : Promise.resolve({ data: [] }),
        supabase
          .from('call_logs')
          .select('costo')
          .eq('user_id', user.id)
          .eq('disposition', 'inbound')
          .gte('created_at', hoy.toISOString()),
      ])
      const sumCosto = (arr: { costo?: number | null }[] | null) =>
        (arr ?? []).reduce((s, r) => s + (Number(r.costo) || 0), 0)
      setCostoDia(sumCosto(outboundLogsCosto ?? null) + sumCosto(inboundLogsCosto ?? null))

      // Callbacks pendientes (contacts status = callback)
      const { count: callbacksCount } = hasCampaigns
        ? await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .in('campaign_id', campaignIds)
            .eq('status', 'callback')
        : { count: 0 }
      setCallbacksPendientes(callbacksCount ?? 0)

      // Campañas activas
      const { data: activeCampaigns, count: countCampanas } = await supabase
        .from('campaigns')
        .select('id, nombre, agente_tipo', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('status', 'active')
      setCampanasActivas(countCampanas ?? 0)

      // Progreso campañas
      if (activeCampaigns && activeCampaigns.length > 0) {
        const campanaData: ActiveCampaign[] = await Promise.all(
          activeCampaigns.map(async (camp) => {
            const { count: total } = await supabase
              .from('contacts')
              .select('*', { count: 'exact', head: true })
              .eq('campaign_id', camp.id)
            const { count: procesados } = await supabase
              .from('contacts')
              .select('*', { count: 'exact', head: true })
              .eq('campaign_id', camp.id)
              .in('status', ['completed', 'appointed', 'calling'])
            const progreso =
              total && total > 0
                ? Math.round(((procesados ?? 0) / total) * 100)
                : 0
            return {
              nombre: camp.nombre,
              tipoAgente: camp.agente_tipo,
              contactosTotales: total ?? 0,
              progreso,
            }
          })
        )
        setCampanas(campanaData)
      }

      // Llamadas recientes (outbound + inbound, combinadas y ordenadas)
      const [
        outboundRecentRes,
        { data: recentInbound },
      ] = await Promise.all([
        hasCampaigns
          ? supabase
              .from('call_logs')
              .select(`
                created_at,
                duracion_minutos,
                disposition,
                campaign_id,
                contacts (nombre, telefono)
              `)
              .in('campaign_id', campaignIds)
              .order('created_at', { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [] }),
        supabase
          .from('call_logs')
          .select('created_at, duracion_minutos, disposition, notas')
          .eq('user_id', user.id)
          .eq('disposition', 'inbound')
          .order('created_at', { ascending: false })
          .limit(10),
      ])
      const recentOutbound = (outboundRecentRes as { data?: unknown[] }).data ?? []

      const parseNotas = (notas: string | null): { contacto: string; telefono: string } => {
        if (!notas || typeof notas !== 'string') return { contacto: 'Llamada Inbound', telefono: '-' }
        try {
          const parsed = JSON.parse(notas) as Record<string, unknown>
          const from = (parsed.from ?? parsed.telefono ?? parsed.phone ?? '') as string
          const name = (parsed.nombre ?? parsed.contacto ?? parsed.name ?? 'Llamada Inbound') as string
          return { contacto: name || 'Llamada Inbound', telefono: from || '-' }
        } catch {
          return { contacto: 'Llamada Inbound', telefono: '-' }
        }
      }
      const outboundRows: (RecentCall & { _ts: number })[] = (recentOutbound ?? []).map((log: any) => ({
        contacto: log.contacts?.nombre ?? 'Desconocido',
        telefono: log.contacts?.telefono ?? '-',
        estado: log.disposition ?? '-',
        duracion: log.duracion_minutos
          ? `${Math.round(log.duracion_minutos)} min`
          : '-',
        fecha: new Date(log.created_at).toLocaleString('es-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        disposition: log.disposition ?? '',
        tipo: 'outbound' as const,
        _ts: new Date(log.created_at).getTime(),
      }))
      const inboundRows: (RecentCall & { _ts: number })[] = (recentInbound ?? []).map((log: any) => {
        const { contacto, telefono } = parseNotas(log.notas)
        return {
          contacto,
          telefono,
          estado: log.disposition ?? 'inbound',
          duracion: log.duracion_minutos
            ? `${Math.round(log.duracion_minutos)} min`
            : '-',
          fecha: new Date(log.created_at).toLocaleString('es-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          disposition: log.disposition ?? 'inbound',
          tipo: 'inbound' as const,
          _ts: new Date(log.created_at).getTime(),
        }
      })
      const combined: RecentCall[] = [...outboundRows, ...inboundRows]
        .sort((a, b) => b._ts - a._ts)
        .slice(0, 10)
        .map(({ _ts, ...r }) => r)
      setLlamadasRecientes(combined)

      // Gráfica por hora (hoy — outbound + inbound)
      const [
        horaOutboundRes,
        { data: horaLogsInbound },
      ] = await Promise.all([
        hasCampaigns
          ? supabase
              .from('call_logs')
              .select('created_at')
              .in('campaign_id', campaignIds)
              .gte('created_at', hoy.toISOString())
          : Promise.resolve({ data: [] }),
        supabase
          .from('call_logs')
          .select('created_at')
          .eq('user_id', user.id)
          .eq('disposition', 'inbound')
          .gte('created_at', hoy.toISOString()),
      ])
      const horaLogsOutbound = (horaOutboundRes as { data?: unknown[] }).data ?? []
      const horaLogs = [...(horaLogsOutbound ?? []), ...(horaLogsInbound ?? [])]
      if (horaLogs.length > 0) {
        const porHora: Record<number, number> = {}
        horaLogs.forEach((log: any) => {
          const h = new Date(log.created_at).getHours()
          porHora[h] = (porHora[h] ?? 0) + 1
        })
        const horas: HourData[] = Array.from({ length: 24 }, (_, i) => ({
          hora: `${i}h`,
          llamadas: porHora[i] ?? 0,
        })).filter((_, i) => i >= 8 && i <= 20)
        setHorasData(horas)
      } else {
        setHorasData(Array.from({ length: 13 }, (_, i) => ({ hora: `${i + 8}h`, llamadas: 0 })))
      }

      // Gráfica por día (últimos 7 días — outbound + inbound)
      const [
        diaOutboundRes,
        { data: diaLogsInbound },
      ] = await Promise.all([
        hasCampaigns
          ? supabase
              .from('call_logs')
              .select('created_at')
              .in('campaign_id', campaignIds)
              .gte('created_at', inicioSemana.toISOString())
          : Promise.resolve({ data: [] }),
        supabase
          .from('call_logs')
          .select('created_at')
          .eq('user_id', user.id)
          .eq('disposition', 'inbound')
          .gte('created_at', inicioSemana.toISOString()),
      ])
      const diaLogsOutbound = (diaOutboundRes as { data?: unknown[] }).data ?? []
      const diaLogs = [...(diaLogsOutbound ?? []), ...(diaLogsInbound ?? [])]
      if (diaLogs.length >= 0) {
        const porDia: Record<string, number> = {}
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
        diaLogs.forEach((log: any) => {
          const d = diasSemana[new Date(log.created_at).getDay()]
          porDia[d] = (porDia[d] ?? 0) + 1
        })
        const dias: DayData[] = []
        for (let i = 6; i >= 0; i--) {
          const d = new Date()
          d.setDate(d.getDate() - i)
          const label = diasSemana[d.getDay()]
          dias.push({ dia: label, llamadas: porDia[label] ?? 0 })
        }
        setDiasData(dias)
      }
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const saludo = getSaludoByHora()
  const displayName = companyName || 'Usuario'

  // Recomendaciones dinámicas
  const recomendaciones: { emoji: string; text: string }[] = []
  if (tasaContactoHoy < 15 && llamadasHoy > 0) {
    recomendaciones.push({
      emoji: '📞',
      text: 'Revisa el horario de tus llamadas. El mejor horario es entre 10AM-12PM y 5PM-7PM',
    })
  }
  if (callbacksPendientes > 0) {
    recomendaciones.push({
      emoji: '🔔',
      text: `Tienes ${callbacksPendientes} callbacks pendientes para hoy. ¡No los olvides!`,
    })
  }
  if (campanasActivas === 0) {
    recomendaciones.push({
      emoji: '🚀',
      text: 'No tienes campañas activas. Activa una campaña para empezar a generar leads',
    })
  }
  if (citasAgendadasHoy === 0 && llamadasHoy > 20) {
    recomendaciones.push({
      emoji: '💡',
      text: `Llevas ${llamadasHoy} llamadas sin citas. Considera revisar tu pitch o el buyer persona`,
    })
  }
  if (tasaContactoHoy >= 30 && llamadasHoy > 0) {
    recomendaciones.push({
      emoji: '🔥',
      text: '¡Excelente día! Tu tasa de contacto está por encima del promedio',
    })
  }

  const tasaRendimientoLabel = tasaContactoHoy >= 30 ? 'Excelente' : tasaContactoHoy >= 15 ? 'Regular' : 'Mejorar'
  const tasaRendimientoColor = tasaContactoHoy >= 30 ? 'bg-[#22c55e]/20 text-[#22c55e]' : tasaContactoHoy >= 15 ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'

  return (
    <section className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight theme-text-primary">
          {saludo}, {displayName} 👋
        </h1>
        <p className="text-sm theme-text-muted">
          {saludo.toLowerCase()}. Aquí está tu resumen del día.
        </p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="Minutos Disponibles"
          value={minutosDisponibles}
          icon={<Clock className="h-4 w-4" />}
          color="green"
          loading={loading}
        />
        <MetricCard
          label="Llamadas Hoy"
          value={llamadasHoy}
          sub={`${llamadasSemana} esta semana`}
          icon={<Phone className="h-4 w-4" />}
          color="sky"
          loading={loading}
        />
        <MetricCard
          label="Tasa de Contacto"
          value={`${tasaContacto}%`}
          sub="últimos 7 días"
          icon={<TrendingUp className="h-4 w-4" />}
          color="yellow"
          loading={loading}
        />
        <MetricCard
          label="Citas Agendadas"
          value={citasAgendadas}
          sub="total"
          icon={<CalendarCheck className="h-4 w-4" />}
          color="fuchsia"
          loading={loading}
        />
        <MetricCard
          label="Citas Agendadas Hoy"
          value={citasAgendadasHoy}
          icon={<CalendarCheck className="h-4 w-4" />}
          color="fuchsia"
          loading={loading}
        />
        <MetricCard
          label="Costo del día"
          value={costoDia > 0 ? `$${costoDia.toFixed(2)}` : '$0.00'}
          icon={<span className="text-lg">💰</span>}
          color="orange"
          loading={loading}
        />
      </div>

      {/* Widget Referidos */}
      <Link
        to="/referrals"
        className="block rounded-2xl border theme-border/80 theme-bg-card p-4 hover:border-[#22c55e]/40 transition"
      >
        <div className="flex items-center gap-2 text-sm font-semibold theme-text-primary">
          <span>🤝</span> Programa de Referidos
        </div>
        <p className="mt-1 text-sm theme-text-muted">
          Tienes {referidosActivos} referidos activos. Has ganado ${totalGanadoReferidos.toFixed(2)} en créditos.
        </p>
        <span className="mt-2 inline-block text-sm font-medium text-[#22c55e]">Ver mis referidos →</span>
      </Link>

      {/* Tu rendimiento hoy */}
      <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
        <h2 className="text-base font-semibold theme-text-primary">Tu rendimiento hoy</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="theme-text-muted">Llamadas vs meta</span>
              <span className="text-zinc-200">{llamadasHoy} / {META_LLAMADAS_DIA}</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-[#22c55e] transition-all"
                style={{ width: `${Math.min(100, (llamadasHoy / META_LLAMADAS_DIA) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="text-sm theme-text-muted">Tasa de contacto hoy</div>
            <div className="mt-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${tasaRendimientoColor}`}>
                {tasaContactoHoy}% — {tasaRendimientoLabel}
              </span>
            </div>
          </div>
          <div>
            <div className="text-sm theme-text-muted">Citas agendadas hoy</div>
            <div className="mt-2 text-3xl font-bold text-[#22c55e]">
              {loading ? '—' : citasAgendadasHoy}
            </div>
          </div>
        </div>
      </div>

      {/* Recomendaciones */}
      {recomendaciones.length > 0 && (
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
          <h2 className="text-base font-semibold theme-text-primary">Recomendaciones</h2>
          <p className="mt-1 text-sm theme-text-muted">Acciones sugeridas para mejorar tus resultados.</p>
          <div className="mt-4 space-y-3">
            {recomendaciones.map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border theme-border/80 bg-[#0f0f0f] px-4 py-3"
              >
                <span className="text-xl">{r.emoji}</span>
                <p className="text-sm text-zinc-200">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráficas */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Por hora */}
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
          <div className="mb-4">
            <div className="text-base font-semibold theme-text-primary">Llamadas por Hora</div>
            <div className="text-sm theme-text-muted">Hoy — horario 8AM a 8PM</div>
          </div>
          {horasData.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
              Sin llamadas hoy
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={horasData} barSize={18}>
                <XAxis dataKey="hora" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#fff', fontSize: 12 }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="llamadas" radius={[4, 4, 0, 0]}>
                  {horasData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.llamadas > 0 ? '#22c55e' : '#27272a'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Por día */}
        <div className="rounded-2xl border theme-border/80 theme-bg-card p-5">
          <div className="mb-4">
            <div className="text-base font-semibold theme-text-primary">Llamadas por Día</div>
            <div className="text-sm theme-text-muted">Últimos 7 días</div>
          </div>
          {diasData.every(d => d.llamadas === 0) ? (
            <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
              Sin llamadas esta semana
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={diasData} barSize={28}>
                <XAxis dataKey="dia" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, color: '#fff', fontSize: 12 }}
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                />
                <Bar dataKey="llamadas" radius={[4, 4, 0, 0]}>
                  {diasData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.llamadas > 0 ? '#38bdf8' : '#27272a'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tabla + Campañas */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Tabla reciente */}
        <div className="xl:col-span-2 rounded-2xl border theme-border/80 theme-bg-card">
          <div className="flex items-center justify-between px-5 py-4 border-b theme-border/80">
            <div>
              <div className="text-base font-semibold theme-text-primary">Actividad Reciente</div>
              <div className="text-sm theme-text-muted">Últimas llamadas registradas.</div>
            </div>
            <button
              onClick={fetchDashboard}
              className="text-xs theme-text-muted hover:theme-text-primary transition"
            >
              ↻ Actualizar
            </button>
          </div>
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide theme-text-muted">
                <tr className="border-b theme-border/80">
                  <th className="px-5 py-3 font-medium">Tipo</th>
                  <th className="px-5 py-3 font-medium">Contacto</th>
                  <th className="px-5 py-3 font-medium">Teléfono</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Duración</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-zinc-500 text-sm">
                      Cargando...
                    </td>
                  </tr>
                ) : llamadasRecientes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center theme-text-muted">
                      No hay llamadas recientes
                    </td>
                  </tr>
                ) : (
                  llamadasRecientes.map((row, idx) => (
                    <tr
                      key={idx}
                      className="border-b theme-border/80 last:border-b-0 hover:bg-zinc-900/30 transition"
                    >
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${row.tipo === 'outbound' ? 'bg-sky-500/20 text-sky-300' : 'bg-[#22c55e]/20 text-[#22c55e]'}`}>
                          {row.tipo === 'outbound' ? '📞 Out' : '📲 In'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-zinc-100">{row.contacto}</td>
                      <td className="px-5 py-3 theme-text-muted">{row.telefono}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${dispositionColor[row.disposition] ?? 'bg-zinc-700/30 theme-text-muted'}`}>
                          {dispositionLabel[row.disposition] ?? row.estado}
                        </span>
                      </td>
                      <td className="px-5 py-3 theme-text-muted">{row.duracion}</td>
                      <td className="px-5 py-3 theme-text-muted">{row.fecha}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Campañas activas */}
        <div className="rounded-2xl border theme-border/80 theme-bg-card">
          <div className="px-5 py-4 border-b theme-border/80">
            <div className="text-base font-semibold theme-text-primary">Campañas Activas</div>
            <div className="text-sm theme-text-muted">Progreso de ejecución.</div>
          </div>
          <div className="p-5">
            {loading ? (
              <div className="text-sm text-zinc-500 text-center py-4">Cargando...</div>
            ) : campanas.length === 0 ? (
              <div className="rounded-xl border theme-border/80 bg-[#0f0f0f] px-4 py-4 text-sm theme-text-muted">
                No hay campañas activas.{' '}
                <span className="theme-text-muted">Crea tu primera campaña.</span>
              </div>
            ) : (
              <div className="space-y-3">
                {campanas.map((c) => (
                  <div
                    key={c.nombre}
                    className="rounded-xl border theme-border/80 bg-[#0f0f0f] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold theme-text-primary">{c.nombre}</div>
                        <div className="mt-1 text-xs theme-text-muted">
                          Agente: <span className="text-zinc-200">{c.tipoAgente}</span>
                        </div>
                      </div>
                      <div className="text-xs theme-text-muted shrink-0">
                        {c.contactosTotales} contactos
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs theme-text-muted">
                        <span>Progreso</span>
                        <span className="text-zinc-200">{c.progreso}%</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-[#22c55e] transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, c.progreso))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// Componente métrica
function MetricCard({
  label, value, sub, icon, color, loading,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color: 'green' | 'sky' | 'yellow' | 'fuchsia' | 'orange'
  loading: boolean
}) {
  const colors = {
    green: 'bg-[#22c55e]/15 text-[#22c55e] ring-[#22c55e]/20',
    sky: 'bg-sky-400/15 text-sky-300 ring-sky-300/20',
    yellow: 'bg-yellow-400/15 text-yellow-300 ring-yellow-300/20',
    fuchsia: 'bg-fuchsia-400/15 text-fuchsia-300 ring-fuchsia-300/20',
    orange: 'bg-orange-400/15 text-orange-300 ring-orange-300/20',
  }
  return (
    <div className="rounded-2xl border theme-border/80 theme-bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm theme-text-muted">{label}</div>
        <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${colors[color]}`}>
          {icon}
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight theme-text-primary">
        {loading ? <span className="text-zinc-600">—</span> : value}
      </div>
      {sub && (
        <div className="mt-1 text-xs text-zinc-500">{sub}</div>
      )}
    </div>
  )
}
