import { expect, test, vi } from 'vitest'
import { getCost } from './models.svelte'
import type { Model } from './models'

vi.mock('#lib/settings.svelte.ts', () => ({ settings: { getKey: () => '' } }))

const M = 1_000_000
const model: Model = {
  provider: 'openai',
  key: 'k',
  id: 'Model',
  input: 2,
  output: 10,
  search_cost: 0.01,
}

test('prices are per million tokens, plus a charge per search', () => {
  expect(getCost(model, { input: M, output: M })).toBe(12)
  expect(getCost(model, { input: M, output: M }, 3)).toBeCloseTo(12.03)
})

test('cached input is billed at the cached rate when the model has one', () => {
  const tokens = { input: M, input_cache_hit: M / 2, output: 0 }
  expect(getCost({ ...model, input_cached: 0.2 }, tokens)).toBeCloseTo(1.1)
  expect(getCost(model, tokens)).toBe(2)
})
