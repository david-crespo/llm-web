// prices are per million tokens
import type { Provider } from './settings.svelte'

export type Model = {
  provider: Provider
  /** Key provided to API call */
  key: string
  /** ID for display and usability purposes */
  id: string
  // prices
  input: number
  output: number
  input_cached?: number
  /** Cost per web search in dollars */
  search_cost?: number
}

export const models: Model[] = [
  {
    provider: 'openai',
    key: 'gpt-6.1-sol',
    id: 'GPT-6.1 Sol',
    input: 2,
    input_cached: 0.1,
    output: 10,
    search_cost: 0.01,
  },
  {
    provider: 'anthropic',
    key: 'claude-opus-5-5',
    id: 'Claude Opus 5.5',
    input: 4,
    input_cached: 0.2,
    output: 20,
    search_cost: 0.01,
  },
  {
    provider: 'google',
    key: 'gemini-4-argon',
    id: 'Gemini 4 Argon',
    input: 2,
    input_cached: 0.1,
    output: 10,
    // Introductory pricing through November 30, 2026; doubles to 4/20/0.20
    // starting December 1, 2026.
    // 5,000 search queries per month free, then $14/1000
    search_cost: 0,
  },
  {
    provider: 'google',
    key: 'gemini-3.8-flash',
    id: 'Gemini 3.8 Flash',
    input: 0.75,
    input_cached: 0.075,
    output: 3.75,
    // 5,000 search queries per month free, then $14/1000
    search_cost: 0,
  },
]
