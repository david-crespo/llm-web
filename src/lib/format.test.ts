import { describe, expect, test } from 'vitest'
import { formatTokens, shortModel } from './format'

describe('shortModel', () => {
  test('strips a brand prefix', () => expect(shortModel('Claude Opus 5')).toBe('Opus 5'))
  test('leaves other names alone', () => expect(shortModel('GPT-5.6')).toBe('GPT-5.6'))
  // A stored message from an older version of the app may be missing the field
  // the types promise. Rendering it must not throw. See format.ts.
  test('missing name', () => expect(shortModel(undefined)).toBe('?'))
})

describe('formatTokens', () => {
  test('input and output', () =>
    expect(formatTokens({ input: 1200, output: 34 })).toBe('1,200 → 34'))
  test('cache hit', () =>
    expect(formatTokens({ input: 1200, output: 34, input_cache_hit: 900 })).toBe(
      '1,200 (900) → 34',
    ))
  test('missing counts', () => expect(formatTokens(undefined)).toBe('? → ?'))
  test('partial counts', () => expect(formatTokens({ input: 1200 } as never)).toBe('1,200 → ?'))
})
