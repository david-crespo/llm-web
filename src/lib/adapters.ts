import type { Chat, TokenCounts } from './types';
import type { Model } from './models';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

// OpenAI API adapter using Responses API
async function openaiCreateMessage({
	chat,
	input,
	model,
	tools
}: ChatInput): Promise<ModelResponse> {
	const apiKey = localStorage.getItem('openai_api_key');
	if (!apiKey) throw new Error('OpenAI API key not found');

	const client = new OpenAI({
		apiKey,
		dangerouslyAllowBrowser: true
	});

	const response = await client.responses.create({
		model: model.key,
		input: [
			...chat.messages.map((m) => ({ role: m.role, content: m.content })),
			{ role: 'user' as const, content: input }
		],
		tools: tools.includes('search') ? [{ type: 'web_search_preview' as const }] : undefined,
		reasoning: {
			effort: tools.includes('think') ? 'medium' : 'low'
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
async function anthropicCreateMessage({ chat, input, model }: ChatInput): Promise<ModelResponse> {
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

	const response = await client.messages.create({
		model: model.key,
		system: chat.systemPrompt,
		messages,
		max_tokens: 4096
	});

	const content = response.content
		.filter((msg) => msg.type === 'text')
		.map((msg) => (msg.type === 'text' ? msg.text : ''))
		.join('\n\n');

	const reasoning = ''; // Anthropic doesn't have separate reasoning in the same way

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
async function geminiCreateMessage({ chat, input, model }: ChatInput): Promise<ModelResponse> {
	const apiKey = localStorage.getItem('google_api_key');
	if (!apiKey) throw new Error('Google AI API key not found');

	const genAI = new GoogleGenerativeAI(apiKey);
	const geminiModel = genAI.getGenerativeModel({
		model: model.key,
		systemInstruction: chat.systemPrompt
	});

	const chatSession = geminiModel.startChat({
		history: chat.messages.map((msg) => ({
			role: msg.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: msg.content }]
		}))
	});

	const result = await chatSession.sendMessage(input);
	const response = result.response;

	const content = response.text();
	const reasoning = ''; // Gemini SDK doesn't separate reasoning in the same way

	const tokens = {
		input: response.usageMetadata?.promptTokenCount || 0,
		output: response.usageMetadata?.candidatesTokenCount || 0,
		input_cache_hit: response.usageMetadata?.cachedContentTokenCount || 0
	};

	return {
		content,
		reasoning,
		tokens,
		cost: 0, // Will be calculated by caller
		stop_reason: 'stop' // Gemini SDK doesn't provide detailed stop reasons
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
