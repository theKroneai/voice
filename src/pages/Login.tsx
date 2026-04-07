import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { ensureUserRow, isOnboardingDone } from '../lib/onboardingGate'
import { KRONE_BRAND_ICON } from '../utils/logos'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const isRegister = useMemo(() => {
    if (location.pathname === '/register') return true
    return new URLSearchParams(location.search).get('mode') === 'register'
  }, [location.pathname, location.search])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [registerNote, setRegisterNote] = useState<string | null>(null)

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    if (ref) sessionStorage.setItem('krone_ref', ref)
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!mounted) return
      if (!session?.user?.id) return

      const user = session.user
      await ensureUserRow(user.id, session.user.email)
      const { data, error } = await supabase
        .from('users')
        .select('id, es_admin, onboarding_completado, nombre')
        .eq('id', user.id)
        .maybeSingle()
      // eslint-disable-next-line no-console
      console.log('users data:', data)
      // eslint-disable-next-line no-console
      console.log('users error:', error)
      const { data: userRow } = await supabase
        .from('users')
        .select('onboarding_completado, nicho')
        .eq('id', user.id)
        .maybeSingle()

      if (!mounted) return
      if (isOnboardingDone(userRow)) {
        navigate('/dashboard', { replace: true })
      } else {
        const ref = new URLSearchParams(window.location.search).get('ref') || sessionStorage.getItem('krone_ref')
        navigate(ref ? `/onboarding?ref=${encodeURIComponent(ref)}` : '/onboarding', { replace: true })
      }
    })()
    return () => {
      mounted = false
    }
  }, [navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) {
        void logActivity({
          accion: 'login_fallido',
          categoria: 'auth',
          detalle: { error: signInError.message },
        })
        setError(signInError.message)
        return
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()
      if (sessionError) {
        navigate('/dashboard', { replace: true })
        return
      }
      const userId = session?.user?.id
      if (!userId) {
        navigate('/dashboard', { replace: true })
        return
      }

      const user = session.user
      await ensureUserRow(userId, session?.user?.email)
      const { data, error: rowErr } = await supabase
        .from('users')
        .select('id, es_admin, onboarding_completado, nombre')
        .eq('id', user.id)
        .maybeSingle()
      // eslint-disable-next-line no-console
      console.log('users data:', data)
      // eslint-disable-next-line no-console
      console.log('users error:', rowErr)
      const { data: userRow } = await supabase
        .from('users')
        .select('onboarding_completado, nicho')
        .eq('id', user.id)
        .maybeSingle()

      void logActivity({ accion: 'login_exitoso', categoria: 'auth' })
      if (isOnboardingDone(userRow)) {
        navigate('/dashboard', { replace: true })
      } else {
        const ref = new URLSearchParams(window.location.search).get('ref') || sessionStorage.getItem('krone_ref')
        navigate(ref ? `/onboarding?ref=${encodeURIComponent(ref)}` : '/onboarding', { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }

  async function onRegisterSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setRegisterNote(null)
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })
      if (signUpError) {
        setError(signUpError.message)
        return
      }

      const session = data.session

      if (session?.user) {
        await ensureUserRow(session.user.id, session.user.email)
        void logActivity({ accion: 'registro_nuevo_usuario', categoria: 'auth' })
        const ref = new URLSearchParams(window.location.search).get('ref') || sessionStorage.getItem('krone_ref')
        navigate(ref ? `/onboarding?ref=${encodeURIComponent(ref)}` : '/onboarding', { replace: true })
        return
      }

      const {
        data: { session: s2 },
      } = await supabase.auth.getSession()
      if (s2?.user) {
        await ensureUserRow(s2.user.id, s2.user.email)
        void logActivity({ accion: 'registro_nuevo_usuario', categoria: 'auth' })
        const ref = new URLSearchParams(window.location.search).get('ref') || sessionStorage.getItem('krone_ref')
        navigate(ref ? `/onboarding?ref=${encodeURIComponent(ref)}` : '/onboarding', { replace: true })
        return
      }

      setRegisterNote(
        'Revisa tu correo para confirmar tu cuenta (si aplica). Después, inicia sesión y te llevamos al onboarding.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full bg-[#0b0b0b] text-zinc-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-lg">
        <div className="mb-6">
          <div className="mb-4 flex justify-center">
            <img
              src={KRONE_BRAND_ICON}
              alt="Krone"
              width={56}
              height={56}
              className="h-14 w-14 rounded-2xl object-cover ring-1 ring-zinc-700/60"
            />
          </div>
          <div className="text-lg font-semibold tracking-tight text-zinc-50">
            {isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            {isRegister ? (
              <>
                Regístrate en <span className="text-[#22c55e]">Krone Agent AI</span>
              </>
            ) : (
              <>
                Accede a <span className="text-[#22c55e]">Krone Agent AI</span>
              </>
            )}
          </div>
        </div>

        <form
          onSubmit={isRegister ? onRegisterSubmit : onSubmit}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label className="text-sm text-zinc-400" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-[#111111] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="tu@empresa.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-zinc-400" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-[#111111] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
              placeholder="••••••••"
              required
              minLength={isRegister ? 6 : undefined}
            />
          </div>

          {isRegister ? (
            <div className="space-y-2">
              <label className="text-sm text-zinc-400" htmlFor="confirmPassword">
                Confirmar contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg bg-[#111111] px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {registerNote ? (
            <div className="rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-2 text-sm text-[#86efac]">
              {registerNote}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#22c55e] px-3 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] disabled:cursor-not-allowed disabled:opacity-60 transition"
          >
            {loading
              ? isRegister
                ? 'Creando cuenta...'
                : 'Entrando...'
              : isRegister
                ? 'Crear cuenta gratis'
                : 'Entrar'}
          </button>

          {isRegister ? (
            <p className="text-center text-sm text-zinc-500">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="font-medium text-[#22c55e] hover:underline">
                Iniciar sesión
              </Link>
            </p>
          ) : (
            <p className="text-center text-sm text-zinc-500">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="font-medium text-[#22c55e] hover:underline">
                Crear cuenta gratis
              </Link>
            </p>
          )}

          <div className="text-xs text-zinc-600">Email y contraseña (Supabase Auth).</div>
        </form>
      </div>
    </div>
  )
}
