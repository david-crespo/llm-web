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
    provider: 'google',
    key: 'gemini-3.5-flash',
    id: 'Gemini 3.5 Flash',
    input: 1.5,
    input_cached: 0.15,
    output: 9.0,
    // 5,000 search queries per month free, then $14/1000
    search_cost: 0,
  },
  {
    provider: 'openai',
    key: 'gpt-5.5',
    id: 'GPT-5.5',
    input: 5,
    input_cached: 0.5,
    output: 30,
    search_cost: 0.01,
  },
  {
    provider: 'anthropic',
    key: 'claude-opus-4-8',
    id: 'Claude Opus 4.8',
    input: 5,
    input_cached: 0.5,
    output: 25,
    search_cost: 0.01,
  },
  {
    provider: 'anthropic',
    key: 'claude-fable-5',
    id: 'Claude Fable 5',
    input: 10,
    input_cached: 1,
    output: 50,
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
- For inline math, use \\(...\\), not $...$. For block math, $$...$$ or \\[...\\]. \\(...\\) is parsed as math anywhere it appears, so don't write \\( or \\) in prose; for a literal "\\(" use a code span.
- Don't wrap dollar amounts in math just to display them — write "$300", "$300-$500", "~$300" plainly. (Inside an actual equation, \\$ is fine.)
- Today's date is ${new Date().toISOString().slice(0, 10)}`
/* eslint-enable svelte/prefer-svelte-reactivity */
