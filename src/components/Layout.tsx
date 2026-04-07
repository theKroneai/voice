import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { calcularMinutosEstimados, smsEstimadosDesdeSaldo } from '../lib/creditUsd'
import { Sidebar } from './Sidebar'
import { ThemeToggle } from './ThemeToggle'

export function Layout() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [saldoUsd, setSaldoUsd] = useState<number | null>(null)
  const [planVoz, setPlanVoz] = useState<string | null>(null)

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
      setSaldoUsd(null)
      setPlanVoz(null)
      return
    }
    let mounted = true
    supabase
      .from('credits')
      .select('saldo_usd, plan_voz')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error) {
          setSaldoUsd(0)
          setPlanVoz(null)
          return
        }
        const raw = data?.saldo_usd
        const saldo =
          raw != null && Number.isFinite(Number(raw))
            ? Math.max(0, Number(raw))
            : 0
        setSaldoUsd(saldo)
        setPlanVoz(
          data?.plan_voz != null ? String(data.plan_voz) : 'prospectador',
        )
      })
    return () => {
      mounted = false
    }
  }, [user?.id])

  const email = useMemo(() => user?.email ?? '', [user])
  const minEstimados =
    saldoUsd != null && planVoz
      ? calcularMinutosEstimados(saldoUsd, planVoz)
      : 0
  const smsEstimados =
    saldoUsd != null ? smsEstimadosDesdeSaldo(saldoUsd) : 0
  const saldoColorClass =
    saldoUsd == null
      ? 'theme-bg-elevated theme-text-secondary theme-border'
      : saldoUsd < 5
        ? 'border-red-500/50 bg-red-500/10 text-red-200 ring-red-500/30'
        : saldoUsd <= 20
          ? 'border-amber-500/50 bg-amber-500/10 text-amber-100 ring-amber-500/30'
          : 'border-[#22c55e]/45 bg-[#22c55e]/10 text-[#86efac] ring-[#22c55e]/30'
  const tooltipSaldo =
    saldoUsd != null
      ? `$${saldoUsd.toFixed(2)} disponibles\n~${minEstimados} min de llamadas en tu plan\n~${smsEstimados} SMS disponibles\nRecargar →`
      : ''

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
              {saldoUsd !== null && (
                <Link
                  to="/credits"
                  title={tooltipSaldo}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ring-1 transition hover:opacity-90 ${saldoColorClass}`}
                >
                  <span aria-hidden>💳</span>
                  <span className="tabular-nums font-semibold">
                    ${saldoUsd.toFixed(2)}
                  </span>
                  {saldoUsd < 5 && (
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

