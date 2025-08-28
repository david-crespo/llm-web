import type { Chat, TokenCounts } from './types';
import type { Model } from './models';

export type ModelResponse = {
	content: string;
	tokens: TokenCounts;
	stop_reason: string;
	cost: number;
	reasoning?: string;
};

export type ChatInput = {
	chat: Chat;
	input: string;
	image_url?: string | undefined;
	model: Model;
	tools: string[];
};

// OpenAI API adapter
async function openaiCreateMessage({
	chat,
	input,
	model,
	tools
}: ChatInput): Promise<ModelResponse> {
	const apiKey = localStorage.getItem('openai_api_key');
	if (!apiKey) throw new Error('OpenAI API key not found');

	const systemMsg = chat.systemPrompt
		? [{ role: 'system' as const, content: chat.systemPrompt }]
		: [];

	const messages = [
		...systemMsg,
		...chat.messages.map((m) => ({ role: m.role, content: m.content })),
		{ role: 'user' as const, content: input }
	];

	const response = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: model.key,
			messages,
			tools: tools.includes('search') ? [{ type: 'web_search_preview' }] : undefined,
			reasoning_effort:
				tools.includes('think') || model.id === 'gpt-5-thinking' ? 'medium' : 'minimal'
		})
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
	}

	const data = await response.json();
	const message = data.choices[0].message;

	let reasoning = '';
	let content = message.content || '';

	// Extract reasoning from think tags
	const thinkMatch = /(<think>)?(.+)<\/think>\s+(.+)/ms.exec(content);
	if (thinkMatch) {
		reasoning = thinkMatch[2];
		content = thinkMatch[3];
	}

	const tokens = {
		input: data.usage?.prompt_tokens || 0,
		output: data.usage?.completion_tokens || 0,
		input_cache_hit: data.usage?.prompt_tokens_details?.cached_tokens || 0
	};

	return {
		content,
		reasoning,
		tokens,
		cost: 0, // Will be calculated by caller
		stop_reason: data.choices[0].finish_reason
	};
}

// Anthropic API adapter
async function anthropicCreateMessage({
	chat,
	input,
	image_url,
	model,
	tools
}: ChatInput): Promise<ModelResponse> {
	const apiKey = localStorage.getItem('anthropic_api_key');
	if (!apiKey) throw new Error('Anthropic API key not found');

	const messages = [
		...chat.messages.map((m) => ({
			role: m.role,
			content: m.content
		})),
		{
			role: 'user' as const,
			content: image_url
				? [
						{ type: 'image', source: { type: 'url', url: image_url } },
						{ type: 'text', text: input }
					]
				: input
		}
	];

	const think = tools.includes('think');

	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: model.key,
			system: chat.systemPrompt,
			messages,
			max_tokens: 4096,
			thinking: think ? { type: 'enabled', budget_tokens: 1024 } : undefined
		})
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
	}

	const data = await response.json();

	const content = data.content
		.filter((msg: any) => msg.type === 'text')
		.map((msg: any) => msg.text)
		.join('\n\n');

	const reasoning = data.content
		.filter((msg: any) => msg.type === 'thinking')
		.map((msg: any) => msg.thinking)
		.join('\n\n');

	const tokens = {
		input: data.usage.input_tokens || 0,
		output: data.usage.output_tokens || 0,
		input_cache_hit: data.usage.cache_read_input_tokens || 0
	};

	return {
		content,
		reasoning,
		tokens,
		cost: 0, // Will be calculated by caller
		stop_reason: data.stop_reason
	};
}

// Google Gemini API adapter
async function geminiCreateMessage({
	chat,
	input,
	model,
	tools
}: ChatInput): Promise<ModelResponse> {
	const apiKey = localStorage.getItem('google_api_key');
	if (!apiKey) throw new Error('Google AI API key not found');

	const think = model.id.includes('pro') || tools.includes('think');

	const contents = [
		...chat.messages.map((msg) => ({
			role: msg.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: msg.content }]
		})),
		{ role: 'user', parts: [{ text: input }] }
	];

	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${model.key}:generateContent?key=${apiKey}`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				contents,
				systemInstruction: chat.systemPrompt,
				generationConfig: {
					thinkingConfig: {
						thinkingBudget: think ? undefined : 0,
						includeThoughts: true
					}
				},
				tools: [
					{ urlContext: {} },
					...(tools.includes('search') ? [{ googleSearch: {} }] : []),
					...(tools.includes('code') ? [{ codeExecution: {} }] : [])
				]
			})
		}
	);

	if (!response.ok) {
		const error = await response.json();
		throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
	}

	const data = await response.json();

	const parts = data.candidates?.[0].content?.parts ?? [];
	const reasoning = parts
		.filter((p: any) => p.text && p.thought)
		.map((p: any) => p.text)
		.join('\n\n');
	let content = parts
		.filter((p: any) => p.text && !p.thought)
		.map((p: any) => p.text)
		.join('\n\n');

	const searchResults = data.candidates?.[0].groundingMetadata?.groundingChunks;
	const searchResultsMd = searchResults
		? '\n\n### Sources\n\n' +
			searchResults
				.filter((chunk: any) => chunk.web)
				.map((chunk: any) => `- [${chunk.web.title}](${chunk.web.uri})`)
				.join('\n')
		: '';

	content += searchResultsMd;

	const tokens = {
		input: data.usageMetadata?.promptTokenCount || 0,
		output:
			(data.usageMetadata?.candidatesTokenCount || 0) +
			(data.usageMetadata?.thoughtsTokenCount || 0),
		input_cache_hit: data.usageMetadata?.cachedContentTokenCount || 0
	};

	return {
		content,
		reasoning,
		tokens,
		cost: 0, // Will be calculated by caller
		stop_reason: data.candidates?.[0].finishReason || ''
	};
}

export async function createMessage(provider: string, input: ChatInput): Promise<ModelResponse> {
	switch (provider) {
		case 'openai':
			return openaiCreateMessage(input);
		case 'anthropic':
			return anthropicCreateMessage(input);
		case 'google':
			return geminiCreateMessage(input);
		default:
			throw new Error(`Unsupported provider: ${provider}`);
	}
}
