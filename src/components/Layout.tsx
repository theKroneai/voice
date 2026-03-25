import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'

const SALDO_BAJO_MINUTOS = 7

export function Layout() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [voiceMinutes, setVoiceMinutes] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return
      if (error) setUser(null)
      else setUser(data.user ?? null)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      setVoiceMinutes(null)
      return
    }
    let mounted = true
    supabase
      .from('credits')
      .select('minutos_voz')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          setVoiceMinutes(0)
          return
        }
        setVoiceMinutes(typeof data?.minutos_voz === 'number' ? data.minutos_voz : 0)
      })
    return () => {
      mounted = false
    }
  }, [user?.id])

  const email = useMemo(() => user?.email ?? '', [user])
  const saldoBajo = voiceMinutes !== null && voiceMinutes < SALDO_BAJO_MINUTOS
  const approxCalls = voiceMinutes !== null ? Math.floor(voiceMinutes / 2) : 0

  async function onSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-full theme-bg-base theme-text-secondary flex">
      <Sidebar />

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 border-b theme-border theme-navbar-bg backdrop-blur">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="text-sm theme-text-muted">
              {email ? (
                <>
                  Sesión iniciada como{' '}
                  <span className="theme-text-secondary">{email}</span>
                </>
              ) : (
                'Cargando usuario...'
              )}
            </div>

            <div className="flex items-center gap-3">
              {voiceMinutes !== null && (
                <Link
                  to="/credits"
                  title={`${voiceMinutes.toFixed(0)} minutos disponibles. Equivale a ~${approxCalls} llamadas de 2 min. Recargar →`}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 transition hover:opacity-90 ${
                    saldoBajo
                      ? 'border-red-500/50 bg-red-500/10 text-red-200 ring-red-500/30'
                      : 'theme-bg-elevated theme-text-secondary theme-border'
                  }`}
                >
                  <span aria-hidden>🎙️</span>
                  <span>{voiceMinutes.toFixed(0)} min</span>
                  {saldoBajo && (
                    <span className="ml-1 text-[10px] font-semibold uppercase text-red-300">
                      Saldo bajo
                    </span>
                  )}
                </Link>
              )}
              <ThemeToggle />
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-2 rounded-lg theme-bg-elevated px-3 py-2 text-sm font-medium theme-text-secondary ring-1 theme-border hover:opacity-90 transition"
              >
                <LogOut className="h-4 w-4" />
                Salir
              </button>
            </div>
          </div>
        </header>

        <main className="px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

