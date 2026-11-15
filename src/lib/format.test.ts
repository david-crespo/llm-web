import { describe, expect, test } from 'vitest'
import { formatTokens, formatTokensExact, fullModel, shortModel } from './format'

describe('model names', () => {
  test('fullModel keeps the brand prefix and handles missing names', () => {
    expect(fullModel('Gemini 4 Carbon')).toBe('Gemini 4 Carbon')
    expect(fullModel(undefined)).toBe('?')
    expect(fullModel('')).toBe('?')
  })
  test('shortModel strips a brand prefix', () => expect(shortModel('Claude Opus 5')).toBe('Opus 5'))
  test('shortModel leaves other names alone', () => expect(shortModel('GPT-5.6')).toBe('GPT-5.6'))
  // A stored message from an older version of the app may be missing the field.
  // Rendering it must not throw. See format.ts.
  test('shortModel missing name', () => expect(shortModel(undefined)).toBe('?'))
})

describe('formatTokens', () => {
  test('abbreviates 1,000+ with k (1 decimal under 10k, integer at 10k+)', () => {
    expect(formatTokens({ input: 890, output: 34 })).toBe('890 → 34')
    expect(formatTokens({ input: 1000, output: 1200 })).toBe('1k → 1.2k')
    expect(formatTokens({ input: 9950, output: 18450 })).toBe('10k → 18k')
    expect(formatTokens({ input: 1_250_000, output: 4096 })).toBe('1,250k → 4.1k')
  })
  test('cache hit', () => {
    expect(formatTokens({ input: 18450, output: 1240, input_cache_hit: 16200 })).toBe(
      '18k (16k) → 1.2k',
    )
    expect(formatTokens({ input: 1200, output: 34, input_cache_hit: 900 })).toBe('1.2k (900) → 34')
  })
  test('missing counts', () => expect(formatTokens(undefined)).toBe('? → ?'))
  test('partial counts', () => expect(formatTokens({ input: 1200 } as never)).toBe('1.2k → ?'))
})

describe('formatTokensExact', () => {
  test('preserves full comma-separated counts for tooltips', () => {
    expect(formatTokensExact({ input: 18450, output: 1240, input_cache_hit: 16200 })).toBe(
      '18,450 (16,200) → 1,240',
    )
    expect(formatTokensExact(undefined)).toBe('? → ?')
  })
})
