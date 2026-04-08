import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/activityLogger'
import { ensureUserRow, isOnboardingDone } from '../lib/onboardingGate'
import { emailBienvenida, enviarCorreo } from '../lib/emails'
import { KRONE_BRAND_ICON } from '../utils/logos'

function welcomeDisplayName(user: { email?: string | null; user_metadata?: { full_name?: string } }) {
  const fromMeta = user.user_metadata?.full_name?.trim()
  if (fromMeta) return fromMeta
  const em = user.email?.trim()
  if (em) return em.split('@')[0] || em
  return 'Usuario'
}

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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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
        const userEmail = session.user.email?.trim()
        if (userEmail) {
          void enviarCorreo({
            to: userEmail,
            subject: '¡Bienvenido a Krone Agent AI!',
            html: emailBienvenida(welcomeDisplayName(session.user)),
          })
        }
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
        const userEmail = s2.user.email?.trim()
        if (userEmail) {
          void enviarCorreo({
            to: userEmail,
            subject: '¡Bienvenido a Krone Agent AI!',
            html: emailBienvenida(welcomeDisplayName(s2.user)),
          })
        }
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

  async function handleGoogleLogin() {
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (oauthError) {
      setError('Error al conectar con Google')
      void logActivity({
        accion: 'oauth_google_fallido',
        categoria: 'auth',
        detalle: { error: oauthError.message },
      })
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

        <button
          type="button"
          onClick={() => void handleGoogleLogin()}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: '#ffffff',
            color: '#000000',
            border: 'none',
            borderRadius: 8,
            padding: '12px 24px',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          <img
            src="https://www.google.com/favicon.ico"
            width={20}
            height={20}
            alt="Google"
          />
          Continuar con Google
        </button>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '16px 0',
          }}
        >
          <hr style={{ flex: 1, borderColor: '#1f1f1f' }} />
          <span style={{ color: '#555', fontSize: 13 }}>o continúa con email</span>
          <hr style={{ flex: 1, borderColor: '#1f1f1f' }} />
        </div>

        {error ? (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        ) : null}

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
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-[#111111] py-2 pl-3 pr-10 text-sm text-zinc-100 ring-1 ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                placeholder="••••••••"
                required
                minLength={isRegister ? 6 : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#888888',
                  padding: 0,
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {isRegister ? (
            <div className="space-y-2">
              <label className="text-sm text-zinc-400" htmlFor="confirmPassword">
                Confirmar contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg bg-[#111111] py-2 pl-3 pr-10 text-sm text-zinc-100 ring-1 ring-zinc-700 focus:outline-none focus:ring-2 focus:ring-[#22c55e]"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Ocultar confirmación' : 'Mostrar confirmación'}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#888888',
                    padding: 0,
                  }}
                >
                  {showConfirmPassword ? '🙈' : '👁️'}
                </button>
              </div>
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
            <p
              style={{
                fontSize: 12,
                color: '#555',
                textAlign: 'center',
                marginTop: 12,
              }}
            >
              Al registrarte aceptas nuestra{' '}
              <a href="/privacy-policy" style={{ color: '#22c55e' }}>
                Política de Privacidad
              </a>{' '}
              y{' '}
              <a href="/terms" style={{ color: '#22c55e' }}>
                Términos de Servicio
              </a>
            </p>
          ) : null}

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
        </form>
      </div>
    </div>
  )
}
