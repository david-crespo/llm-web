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
    key: 'gpt-5.2',
    id: 'GPT-5.2',
    input: 1.75,
    input_cached: 0.175,
    output: 14,
    search_cost: 0.01,
  },
  {
    provider: 'google',
    key: 'gemini-3.1-pro-preview',
    id: 'Gemini 3.1 Pro',
    input: 2.0,
    input_cached: 0.5,
    output: 12.0,
    // 5,000 search queries per month free, then $14/1000
    search_cost: 0,
  },
  {
    provider: 'anthropic',
    key: 'claude-opus-4-6',
    id: 'Opus 4.6',
    input: 5,
    input_cached: 0.5,
    output: 25,
    search_cost: 0.01,
  },
]

const M = 1_000_000

export function getCost(
  model: Model,
  tokens: { input: number; input_cache_hit?: number; output: number },
  searches = 0,
): number {
  const { input, output, input_cached, search_cost } = model

  // when there is caching and we have cache pricing, take it into account
  const tokenCost =
    input_cached && tokens.input_cache_hit
      ? input_cached * tokens.input_cache_hit +
        input * (tokens.input - tokens.input_cache_hit) +
        output * tokens.output
      : input * tokens.input + output * tokens.output

  return tokenCost / M + (search_cost ?? 0) * searches
}

import { settings } from './settings.svelte'

export function getAvailableModels(): Model[] {
  return models.filter((model) => !!settings.getKey(model.provider))
}

/* eslint-disable svelte/prefer-svelte-reactivity -- static date string for system prompt */
export const systemBase = `
- Answer questions precisely, without much elaboration
- Write natural, clear prose for a sophisticated reader, without unnecessary
  bullets or headings. Avoid flowery or turgid or overly formal language.
- Avoid referring to yourself in the first person. You are a computer program, not a person.
- When asked to write code, primarily output code, with minimal explanation unless requested
- Your answers MUST be in markdown format
- Put code within a triple-backtick fence block with a language key (like \`\`\`rust)
- Never put markdown prose (or bullets or whatever) in a fenced code block
- For math, use LaTeX: $...$ or \\(...\\) for inline, $$...$$ or \\[...\\] for block
- Today's date is ${new Date().toISOString().slice(0, 10)}`
/* eslint-enable svelte/prefer-svelte-reactivity */
