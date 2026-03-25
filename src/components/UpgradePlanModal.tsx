import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'

type UserPlan = 'prospectador' | 'vendedor' | 'cazador'

const PLAN_LABEL: Record<UserPlan, string> = {
  prospectador: 'El Prospectador 🎯',
  vendedor: 'El Vendedor ⚡',
  cazador: 'El Cazador 👑',
}

type Props = {
  open: boolean
  onClose: () => void
  userPlan: UserPlan
}

export function UpgradePlanModal({ open, onClose, userPlan }: Props) {
  const navigate = useNavigate()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <button type="button" onClick={onClose} className="absolute inset-0 bg-black/70" aria-label="Cerrar" />
      <div className="relative w-full max-w-md rounded-2xl border theme-border/80 theme-bg-card shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b theme-border/80 px-5 py-4">
          <div>
            <div className="text-lg font-semibold theme-text-primary">🔒 Actualiza tu plan</div>
            <p className="mt-1 text-sm theme-text-muted">
              Esta estrategia combina llamadas automáticas y SMS. Para activarla necesitas el Plan Cazador que incluye ambos canales en un solo paquete.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 theme-text-muted hover:bg-zinc-900/40 transition"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="rounded-xl border theme-border/80 theme-bg-base overflow-hidden">
            <div className="px-4 py-3 border-b theme-border/80">
              <div className="text-xs font-medium theme-text-muted uppercase tracking-wide">Tu plan actual</div>
              <div className="mt-1 font-medium theme-text-primary">{PLAN_LABEL[userPlan] ?? userPlan}</div>
            </div>
            <div className="px-4 py-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="theme-text-secondary">📞 Llamadas automáticas</span>
                <span className="text-[#22c55e]">✅</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="theme-text-secondary">💬 SMS automático</span>
                <span className={userPlan === 'cazador' ? 'text-[#22c55e]' : 'text-zinc-500'}>{userPlan === 'cazador' ? '✅' : '❌'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="theme-text-secondary">📞+💬 Secuencias mixtas</span>
                <span className={userPlan === 'cazador' ? 'text-[#22c55e]' : 'text-zinc-500'}>{userPlan === 'cazador' ? '✅' : '❌'}</span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#22c55e]/20">
              <div className="text-xs font-medium text-[#22c55e] uppercase tracking-wide">Plan Cazador</div>
              <div className="mt-1 font-semibold theme-text-primary">Plan Cazador 👑 $0.90/min</div>
            </div>
            <div className="px-4 py-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="theme-text-secondary">📞 Llamadas automáticas</span>
                <span className="text-[#22c55e]">✅</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="theme-text-secondary">💬 SMS automático</span>
                <span className="text-[#22c55e]">✅</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="theme-text-secondary">📞+💬 Secuencias mixtas</span>
                <span className="text-[#22c55e]">✅</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 border-t theme-border/80 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-medium theme-text-muted hover:theme-text-primary ring-1 theme-border transition"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              navigate('/credits')
            }}
            className="flex-1 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455] transition"
          >
            Ver planes
          </button>
        </div>
      </div>
    </div>
  )
}
