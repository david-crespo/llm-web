// prices are per million tokens
export type Model = {
  provider: string
  /** Key provided to API call */
  key: string
  /** ID for display and usability purposes */
  id: string
  // prices
  input: number
  output: number
  input_cached?: number
}

/**
 * The order matters: preferred models go first.
 *
 * We pick a model by finding the first one containing the specified string.
 * But the same string can be in multiple model names. For example, "mini" is
 * in both gpt-4o-mini and the gemini models. By putting gpt-4o-mini earlier, we
 * ensure "mini" matches that. By putting gpt-4o first, we ensure "4o" matches
 * that.
 *
 * id is doing double duty as both a human-readable nickname and a unique ID.
 */
export const models: Model[] = [
  {
    provider: 'google',
    key: 'gemini-3-pro-preview',
    id: 'Gemini 3 Pro',
    input: 2.0,
    input_cached: 0.5,
    output: 12.0,
  },
  {
    provider: 'openai',
    key: 'gpt-5.1',
    id: 'GPT-5.1',
    input: 1.25,
    input_cached: 0.125,
    output: 10,
  },
  {
    provider: 'anthropic',
    key: 'claude-sonnet-4-5',
    id: 'Sonnet 4.5',
    input: 3,
    input_cached: 0.3,
    output: 15,
  },
  {
    provider: 'anthropic',
    key: 'claude-opus-4-5',
    id: 'Opus 4.5',
    input: 5,
    input_cached: 0.5,
    output: 25,
  },
]

const M = 1_000_000

export function getCost(
  model: Model,
  tokens: { input: number; input_cache_hit?: number; output: number },
): number {
  const { input, output, input_cached } = model

  // when there is caching and we have cache pricing, take it into account
  const cost =
    input_cached && tokens.input_cache_hit
      ? input_cached * tokens.input_cache_hit +
        input * (tokens.input - tokens.input_cache_hit) +
        output * tokens.output
      : input * tokens.input + output * tokens.output

  return cost / M
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
- Today's date is ${new Date().toISOString().slice(0, 10)}`
/* eslint-enable svelte/prefer-svelte-reactivity */
