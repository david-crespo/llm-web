// prices are per million tokens
export type Model = {
	provider: string;
	/** Key provided to API call */
	key: string;
	/** ID for display and usability purposes */
	id: string;
	default?: true;
	// prices
	input: number;
	output: number;
	input_cached?: number;
};

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
		provider: 'openai',
		key: 'gpt-5',
		id: 'GPT-5',
		input: 1.25,
		input_cached: 0.125,
		output: 10,
		default: true
	},
	{
		provider: 'anthropic',
		key: 'claude-opus-4-1-20250805',
		id: 'Opus 4.1',
		input: 15,
		input_cached: 1.5,
		output: 75
	},
	{
		provider: 'anthropic',
		key: 'claude-sonnet-4-20250514',
		id: 'Sonnet 4',
		input: 3,
		input_cached: 0.3,
		output: 15
	},
	{
		provider: 'google',
		key: 'gemini-2.5-pro',
		id: 'Gemini 2.5 Pro',
		input: 1.25,
		input_cached: 0.31,
		output: 10.0
	}
];

const M = 1_000_000;

export function getCost(
	model: Model,
	tokens: { input: number; input_cache_hit?: number; output: number }
): number {
	const { input, output, input_cached } = model;

	// when there is caching and we have cache pricing, take it into account
	const cost =
		input_cached && tokens.input_cache_hit
			? input_cached * tokens.input_cache_hit +
				input * (tokens.input - tokens.input_cache_hit) +
				output * tokens.output
			: input * tokens.input + output * tokens.output;

	return cost / M;
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
- Today's date is ${new Date().toISOString().slice(0, 10)}`;
