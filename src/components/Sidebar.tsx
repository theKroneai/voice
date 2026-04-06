import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  CreditCard,
  LayoutDashboard,
  Megaphone,
  Settings,
  Users,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { parseEsAdmin } from '../lib/esAdmin'
import { KRONE_BRAND_ICON } from '../utils/logos'

const linkBase =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition'
const linkInactive = 'theme-text-muted hover:theme-bg-hover hover:theme-text-primary'
const linkActive = 'theme-bg-elevated theme-text-primary ring-1 theme-border-strong'

export function Sidebar() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadAdminFlag() {
      try {
        const {
          data: { user: authUser },
          error: authErr,
        } = await supabase.auth.getUser()
        const uid = authUser?.id
        if (authErr || !uid) {
          if (mounted) setIsAdmin(false)
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
          if (import.meta.env.DEV) {
            console.warn('[Sidebar] users/es_admin:', error.message)
          }
          setIsAdmin(false)
          return
        }
        setIsAdmin(parseEsAdmin(data?.es_admin))
      } catch {
        if (mounted) setIsAdmin(false)
      }
    }

    void loadAdminFlag()

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void loadAdminFlag()
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return (
    <aside className="w-64 shrink-0 theme-bg-card border-r theme-border flex flex-col">
      <div className="px-5 py-5">
        <div className="flex items-center gap-3">
          <img
            src={KRONE_BRAND_ICON}
            alt="Krone"
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-zinc-700/60"
          />
          <div className="theme-text-primary font-semibold tracking-tight">
            Krone <span className="theme-accent-text">Agent AI</span>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="inline-flex items-center rounded-full theme-bg-base px-2 py-0.5 text-[10px] font-semibold theme-accent-text ring-1 theme-border">
            Voice Agents
          </div>
        </div>
        <div className="mt-2 text-xs theme-text-muted">Voice Agents con IA</div>
      </div>

      <nav className="px-3 pb-4 flex-1">
        <div className="space-y-1">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </NavLink>

          <NavLink
            to="/campaigns"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <Megaphone className="h-4 w-4" />
            Campañas
          </NavLink>

          <NavLink
            to="/inbound"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <span className="text-base">📲</span>
            Recepcionista Virtual 24/7
          </NavLink>

          <NavLink
            to="/contacts"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <Users className="h-4 w-4" />
            Contactos
          </NavLink>

          <NavLink
            to="/sequences"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <span className="text-base">🔁</span>
            Secuencias
          </NavLink>

          <NavLink
            to="/calls"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <span className="text-base">📞</span>
            Llamadas
          </NavLink>

          <NavLink
            to="/sms"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <span className="text-base">💬</span>
            SMS
          </NavLink>

          <NavLink
            to="/appointments"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <span className="text-base">📅</span>
            Citas
          </NavLink>

          <NavLink
            to="/credits"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <CreditCard className="h-4 w-4" />
            Créditos
          </NavLink>

          <NavLink
            to="/referrals"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <span className="text-base">🤝</span>
            Referidos
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <Settings className="h-4 w-4" />
            Configuración
          </NavLink>

          <NavLink
            to="/integrations"
            className={({ isActive }) =>
              `${linkBase} ${isActive ? linkActive : linkInactive}`
            }
          >
            <span className="text-base">🔌</span>
            Integraciones
          </NavLink>
        </div>
      </nav>

      {isAdmin && (
        <div className="border-t theme-border mt-auto py-3 px-4">
          <NavLink
            to="/admin"
            className="text-red-500 text-xs font-semibold hover:underline"
          >
            ⚙️ Admin Panel
          </NavLink>
        </div>
      )}
    </aside>
  )
}

