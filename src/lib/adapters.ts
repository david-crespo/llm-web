import type { Chat, TokenCounts } from './types';
import type { Model } from './models';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

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
	search: boolean;
	think: 'none' | 'low' | 'medium' | 'high';
};

// OpenAI API adapter using Responses API
async function openaiCreateMessage({
	chat,
	input,
	model,
	search,
	think
}: ChatInput): Promise<ModelResponse> {
	const apiKey = localStorage.getItem('openai_api_key');
	if (!apiKey) throw new Error('OpenAI API key not found');

	const client = new OpenAI({
		apiKey,
		dangerouslyAllowBrowser: true
	});

	// Map think levels to OpenAI reasoning effort
	const reasoningEffort =
		think === 'none' ? 'low' : think === 'low' ? 'low' : think === 'medium' ? 'medium' : 'high';

	const response = await client.responses.create({
		model: model.key,
		input: [
			...chat.messages.map((m) => ({ role: m.role, content: m.content })),
			{ role: 'user' as const, content: input }
		],
		tools: search ? [{ type: 'web_search_preview' as const }] : undefined,
		reasoning: {
			effort: reasoningEffort
		},
		instructions: chat.systemPrompt
	});

	const tokens = {
		input: response.usage?.input_tokens || 0,
		output: response.usage?.output_tokens || 0,
		input_cache_hit: response.usage?.input_tokens_details?.cached_tokens || 0
	};

	return {
		content: response.output_text,
		reasoning: '', // Responses API integrates reasoning into output_text
		tokens,
		cost: 0, // Will be calculated by caller
		stop_reason: response.status || 'completed'
	};
}

// Anthropic API adapter
async function anthropicCreateMessage({
	chat,
	input,
	model,
	search,
	think
}: ChatInput): Promise<ModelResponse> {
	const apiKey = localStorage.getItem('anthropic_api_key');
	if (!apiKey) throw new Error('Anthropic API key not found');

	const client = new Anthropic({
		apiKey,
		dangerouslyAllowBrowser: true
	});

	const messages = [
		...chat.messages.map((m) => ({
			role: m.role,
			content: m.content
		})),
		{
			role: 'user' as const,
			content: input
		}
	];

	// Map think levels to Anthropic thinking budget
	let thinking: { type: 'enabled'; budget_tokens: number } | undefined;
	if (think === 'low') {
		thinking = { type: 'enabled', budget_tokens: 1024 };
	} else if (think === 'medium') {
		thinking = { type: 'enabled', budget_tokens: 2048 };
	} else if (think === 'high') {
		thinking = { type: 'enabled', budget_tokens: 4096 };
	}

	const requestTools = search
		? [
				{
					type: 'web_search_20250305' as const,
					name: 'web_search' as const,
					max_uses: 5
				} as any
			]
		: undefined;

	const response = await client.messages.create({
		model: model.key,
		system: chat.systemPrompt,
		messages,
		max_tokens: 4096,
		thinking,
		tools: requestTools
	});

	const content = response.content
		.filter((msg) => msg.type === 'text')
		.map((msg) => (msg.type === 'text' ? msg.text : ''))
		.join('\n\n');

	const reasoning = response.content
		.filter((msg) => msg.type === 'thinking')
		.map((msg) => (msg.type === 'thinking' ? msg.thinking : ''))
		.join('\n\n');

	const tokens = {
		input: response.usage.input_tokens || 0,
		output: response.usage.output_tokens || 0,
		input_cache_hit: 0 // Anthropic SDK doesn't provide cache info in the same way
	};

	return {
		content,
		reasoning,
		tokens,
		cost: 0, // Will be calculated by caller
		stop_reason: response.stop_reason || 'unknown'
	};
}

// Google Gemini API adapter
async function geminiCreateMessage({
	chat,
	input,
	model,
	search
}: ChatInput): Promise<ModelResponse> {
	const apiKey = localStorage.getItem('google_api_key');
	if (!apiKey) throw new Error('Google AI API key not found');

	const genAI = new GoogleGenAI({ apiKey });

	const result = await genAI.models.generateContent({
		config: {
			thinkingConfig: {
				thinkingBudget: undefined,
				includeThoughts: true
			},
			systemInstruction: chat.systemPrompt,
			tools: [
				// always include URL context. it was designed to be used this way
				{ urlContext: {} },
				...(search ? [{ googleSearch: {} }] : [])
			]
		},
		model: model.key,
		contents: [
			...chat.messages.map((msg) => ({
				// gemini uses model instead of assistant
				role: msg.role === 'assistant' ? 'model' : 'user',
				parts: [{ text: msg.content }]
			})),
			{ role: 'user', parts: [{ text: input }] }
		]
	});

	const parts = result.candidates?.[0].content?.parts ?? [];
	const reasoning = parts
		.filter((p) => p.text && p.thought)
		.map((p) => p.text!)
		.join('\n\n');
	let content = parts
		.filter((p) => p.text && !p.thought)
		.map((p) => p.text!)
		.join('\n\n');

	const searchResults = result.candidates?.[0].groundingMetadata?.groundingChunks;
	const searchResultsMd = searchResults
		? '\n\n### Sources\n\n' +
			searchResults
				.filter((chunk) => chunk.web)
				.map((chunk) => `- [${chunk.web!.title}](${chunk.web!.uri})`)
				.join('\n')
		: '';

	content += searchResultsMd;

	const tokens = {
		input: result.usageMetadata?.promptTokenCount || 0,
		output:
			(result.usageMetadata?.candidatesTokenCount || 0) +
			(result.usageMetadata?.thoughtsTokenCount || 0),
		input_cache_hit: result.usageMetadata?.cachedContentTokenCount || 0
	};

	return {
		content,
		reasoning,
		tokens,
		cost: 0, // Will be calculated by caller
		stop_reason: result.candidates?.[0].finishReason || ''
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
