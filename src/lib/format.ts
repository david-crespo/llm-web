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

/** Strip the redundant brand/family word from a model name to keep the
 * message metadata line short on narrow screens. */
const brandPrefixes = ['Claude ', 'Gemini ']

export function shortModel(name: string | undefined): string {
  if (!name) return unknown
  const prefix = brandPrefixes.find((p) => name.startsWith(p))
  return prefix ? name.slice(prefix.length) : name
}

const tokenFmt = new Intl.NumberFormat()

/** Stand-in for a metadata field a stored message turns out not to have. The
 * types say it does, but a chat written by an older version of the app predates
 * the field, and a gap in the metadata line beats throwing partway through
 * rendering and taking the page down with it. */
const unknown = '?'

const count = (n: number | undefined) => (typeof n === 'number' ? tokenFmt.format(n) : unknown)

export function formatTokens(tokens: TokenCounts | undefined): string {
  const cacheHit = tokens?.input_cache_hit ? ` (${count(tokens.input_cache_hit)})` : ''
  return `${count(tokens?.input)}${cacheHit} → ${count(tokens?.output)}`
}
