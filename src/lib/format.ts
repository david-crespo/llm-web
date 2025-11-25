import type { TokenCounts } from './types'

const timeFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

export function formatTime(ms: number): string {
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes === 0) return `${timeFmt.format(seconds)}s`
  return `${minutes}m${Math.floor(seconds)}s`
}

const moneyFmt = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
})

export function formatMoney(amount: number): string {
  return moneyFmt.format(amount)
}

const tokenFmt = new Intl.NumberFormat()

export function formatTokens(tokens: TokenCounts): string {
  const cacheHit = tokens.input_cache_hit ? ` (${tokenFmt.format(tokens.input_cache_hit)})` : ''
  return `${tokenFmt.format(tokens.input)}${cacheHit} → ${tokenFmt.format(tokens.output)}`
}
