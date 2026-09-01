export { models, type Model } from './models'
import { models, type Model } from './models'

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
