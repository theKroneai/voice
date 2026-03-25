import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { Layout } from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Campaigns from './pages/Campaigns'
import InboundAgents from './pages/InboundAgents'
import Contacts from './pages/Contacts'
import Sequences from './pages/Sequences'
import Calls from './pages/Calls'
import SMS from './pages/SMS'
import Credits from './pages/Credits'
import Referrals from './pages/Referrals'
import Appointments from './pages/Appointments'
import Onboarding from './pages/Onboarding'
import Settings from './pages/Settings'
import Integrations from './pages/Integrations'
import Admin from './pages/Admin'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-full bg-[#0f0f0f] text-zinc-100 flex items-center justify-center">
        <div className="text-sm text-zinc-400">Cargando...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id
      if (!uid) {
        if (mounted) setAllowed(false)
        return
      }
      const { data: row } = await supabase
        .from('users')
        .select('es_admin')
        .eq('id', uid)
        .maybeSingle()
      if (mounted) setAllowed(row?.es_admin === true)
    })
    return () => {
      mounted = false
    }
  }, [])

  if (allowed === null) {
    return (
      <div className="min-h-full bg-[#0f0f0f] text-zinc-100 flex items-center justify-center">
        <div className="text-sm text-zinc-400">Verificando acceso...</div>
      </div>
    )
  }
  if (!allowed) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      {/* Rutas públicas: "/" y "/login" como hijos de path="/" para que "/*" no capture la raíz */}
      <Route path="/" element={<Outlet />}>
        <Route index element={<Landing />} />
        <Route path="login" element={<Login />} />
        <Route
          path="onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="campaigns" element={<Campaigns />} />
          <Route path="inbound" element={<InboundAgents />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="sequences" element={<Sequences />} />
          <Route path="calls" element={<Calls />} />
          <Route path="sms" element={<SMS />} />
          <Route path="credits" element={<Credits />} />
          <Route path="referrals" element={<Referrals />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="settings" element={<Settings />} />
          <Route path="integrations" element={<Integrations />} />
          <Route
            path="admin"
            element={
              <RequireAdmin>
                <Admin />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
