import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logError } from '../lib/activityLogger'

type Props = { children: ReactNode }

type State = { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    void logError(error, 'error_boundary', {
      componentStack: info.componentStack,
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0b0b] px-6 py-16 text-center text-zinc-100">
          <h2 className="text-xl font-semibold text-[#22c55e]">Algo salió mal</h2>
          <p className="mt-3 text-sm text-zinc-500">
            El error fue reportado automáticamente.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-8 rounded-xl bg-[#22c55e] px-6 py-3 text-sm font-semibold text-[#0b0b0b] hover:bg-[#1fb455]"
          >
            Recargar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
