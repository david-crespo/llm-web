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
    key: 'gpt-5.6',
    id: 'GPT-5.6',
    input: 4,
    input_cached: 0.4,
    output: 20,
    search_cost: 0.01,
  },
  {
    provider: 'anthropic',
    key: 'claude-fable-5-1',
    id: 'Claude Fable 5.1',
    input: 10,
    input_cached: 0.25,
    output: 50,
    search_cost: 0.01,
  },
  {
    provider: 'google',
    key: 'gemini-3.7-flash',
    id: 'Gemini 3.7 Flash',
    input: 0.75,
    input_cached: 0.075,
    output: 3.75,
    // 5,000 search queries per month free, then $14/1000
    search_cost: 0,
  },
]
