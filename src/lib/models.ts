// prices are per million tokens
export type Model = {
  provider: string
  /** Key provided to API call */
  key: string
  /** ID for display and usability purposes */
  id: string
  default?: true
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
    default: true,
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

export const systemBase = `
- Answer the question precisely, without much elaboration
- Write natural prose for a sophisticated reader, without unnecessary bullets or headings
- Avoid referring to yourself in the first person. You are a computer program, not a person.
- When asked to write code, primarily output code, with minimal explanation unless requested
- When given code to modify, prefer diff output rather than rewriting the full input unless the input is short
- Your answers MUST be in markdown format
- Put code within a triple-backtick fence block with a language key (like \`\`\`rust)
- Never put markdown prose (or bullets or whatever) in a fenced code block

Tailor answers to the user:
- OS: macOS
- Terminal: Ghostty
- Text editor: Helix
- Shell: zsh
- Programming languages: TypeScript and Rust
- Today's date is ${new Date().toISOString().slice(0, 10)}`
