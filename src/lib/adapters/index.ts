import type { Chat, TokenCounts } from '$lib/types';
import type { Model } from '$lib/models';
import { openaiCreateMessage } from './openai';
import { anthropicCreateMessage } from './anthropic';
import { geminiCreateMessage } from './google';

export type ModelResponse = {
  content: string;
  tokens: TokenCounts;
  stop_reason: string;
  reasoning?: string;
};

export type ChatInput = {
  chat: Chat;
  input: string;
  image_url?: string | undefined;
  model: Model;
  search: boolean;
  think: boolean;
};

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

