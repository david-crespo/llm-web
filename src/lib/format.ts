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

/** Strip the redundant brand/family word from a model name when the metadata
 * line is too narrow to fit the full name on one line. */
const brandPrefixes = ['Claude ', 'Gemini ']

export function fullModel(name: string | undefined): string {
  return name || unknown
}

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

const exactCount = (n: number | undefined) => (typeof n === 'number' ? tokenFmt.format(n) : unknown)

function compactCount(n: number | undefined): string {
  if (typeof n !== 'number') return unknown
  if (n < 1000) return String(n)
  const tenthK = Math.round(n / 100) / 10
  if (tenthK < 10) return `${Number.isInteger(tenthK) ? tenthK : tenthK.toFixed(1)}k`
  return `${tokenFmt.format(Math.round(n / 1000))}k`
}

function formatPair(
  tokens: TokenCounts | undefined,
  fmt: (n: number | undefined) => string,
): string {
  const cacheHit = tokens?.input_cache_hit ? ` (${fmt(tokens.input_cache_hit)})` : ''
  return `${fmt(tokens?.input)}${cacheHit} → ${fmt(tokens?.output)}`
}

export const formatTokens = (tokens: TokenCounts | undefined): string =>
  formatPair(tokens, compactCount)

export const formatTokensExact = (tokens: TokenCounts | undefined): string =>
  formatPair(tokens, exactCount)
