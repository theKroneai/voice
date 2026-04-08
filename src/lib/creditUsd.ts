export const SMS_USD_POR_MENSAJE = 0.08

const PRECIO_MIN_OUTBOUND: Record<string, number> = {
  prospectador: 0.45,
  vendedor: 0.75,
  cazador: 0.9,
}

export function calcularMinutosEstimados(saldoUSD: number, plan: string): number {
  const p = plan.toLowerCase()
  const precio = PRECIO_MIN_OUTBOUND[p] ?? 0.45
  if (precio <= 0) return 0
  return Math.floor(saldoUSD / precio)
}

export function smsEstimadosDesdeSaldo(saldoUSD: number): number {
  if (SMS_USD_POR_MENSAJE <= 0) return 0
  return Math.floor(saldoUSD / SMS_USD_POR_MENSAJE)
}

/** Texto unificado: saldo en USD + minutos estimados según plan de voz outbound. */
export function formatSaldoCreditoConMinutos(saldo: number, plan: string): string {
  const saldoNum = Number.isFinite(saldo) ? Math.max(0, saldo) : 0
  if (saldoNum <= 0) return '$0.00'
  const minutos = calcularMinutosEstimados(saldoNum, plan || 'prospectador')
  return `$${saldoNum.toFixed(2)} en créditos (~${minutos} min)`
}
