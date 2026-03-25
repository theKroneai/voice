import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { KRONE_BRAND_ICON } from '../utils/logos'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

      const userId = session.user.id
      const { data: userRow } = await supabase
        .from('users')
        .select('onboarding_completado, nicho')
        .eq('id', userId)
        .maybeSingle()

      if (!mounted) return
      if (userRow && (userRow.onboarding_completado || userRow.nicho)) {
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

      const { data: userRow } = await supabase
        .from('users')
        .select('onboarding_completado, nicho')
        .eq('id', userId)
        .maybeSingle()

      if (userRow && (userRow.onboarding_completado || userRow.nicho)) {
        navigate('/dashboard', { replace: true })
      } else {
        const ref = new URLSearchParams(window.location.search).get('ref') || sessionStorage.getItem('krone_ref')
        navigate(ref ? `/onboarding?ref=${encodeURIComponent(ref)}` : '/onboarding', { replace: true })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full theme-bg-base theme-text-secondary flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border theme-border theme-bg-card p-6 shadow-lg">
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
          <div className="text-lg font-semibold tracking-tight theme-text-primary">
            Iniciar sesión
          </div>
          <div className="mt-1 text-sm theme-text-muted">
            Accede a <span className="theme-accent-text">Krone Agent AI</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm theme-text-muted" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg theme-bg-input px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[var(--theme-ring)]"
              placeholder="tu@empresa.com"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm theme-text-muted" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg theme-bg-input px-3 py-2 text-sm theme-text-secondary ring-1 theme-border focus:outline-none focus:ring-2 focus:ring-[var(--theme-ring)]"
              placeholder="••••••••"
              required
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg theme-accent px-3 py-2 text-sm font-semibold theme-accent-contrast hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="text-xs theme-text-dim">
             (Email/Password).
          </div>
        </form>
      </div>
    </div>
  )
}

