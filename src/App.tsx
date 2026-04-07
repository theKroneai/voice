import { useEffect, useState, lazy, Suspense } from 'react'
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
import { parseEsAdmin } from './lib/esAdmin'
import { Layout } from './components/Layout'
import { HelpChat } from './components/HelpChat'
import { ErrorBoundary } from './components/ErrorBoundary'

const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Campaigns = lazy(() => import('./pages/Campaigns'))
const InboundAgents = lazy(() => import('./pages/InboundAgents'))
const Contacts = lazy(() => import('./pages/Contacts'))
const Sequences = lazy(() => import('./pages/Sequences'))
const Calls = lazy(() => import('./pages/Calls'))
const SMS = lazy(() => import('./pages/SMS'))
const Credits = lazy(() => import('./pages/Credits'))
const Referrals = lazy(() => import('./pages/Referrals'))
const Appointments = lazy(() => import('./pages/Appointments'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Settings = lazy(() => import('./pages/Settings'))
const Integrations = lazy(() => import('./pages/Integrations'))
const Admin = lazy(() => import('./pages/Admin'))
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'))
const Terms = lazy(() => import('./pages/Terms'))
const Compliance = lazy(() => import('./pages/Compliance'))

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
    ;(async () => {
      const {
        data: { user: authUser },
        error: authErr,
      } = await supabase.auth.getUser()
      const uid = authUser?.id
      if (authErr || !uid) {
        if (mounted) setAllowed(false)
        return
      }
      const { data, error } = await supabase
        .from('users')
        .select('id, es_admin, onboarding_completado, nombre')
        .eq('id', uid)
        .maybeSingle()
      // eslint-disable-next-line no-console
      console.log('users data:', data)
      // eslint-disable-next-line no-console
      console.log('users error:', error)
      if (!mounted) return
      if (error) {
        if (import.meta.env.DEV) console.warn('[RequireAdmin]', error.message)
        setAllowed(false)
        return
      }
      setAllowed(parseEsAdmin(data?.es_admin))
    })()
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
    <Suspense fallback={<div>Cargando...</div>}>
      <Routes>
      {/* Rutas públicas: "/" y "/login" como hijos de path="/" para que "/*" no capture la raíz */}
      <Route path="/" element={<Outlet />}>
        <Route index element={<Landing />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Login />} />
        <Route path="privacy-policy" element={<PrivacyPolicy />} />
        <Route path="terms" element={<Terms />} />
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
          <Route path="compliance" element={<Compliance />} />
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
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppRoutes />
        <HelpChat />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
