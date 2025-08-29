import OpenAI from 'openai';
import type { ChatInput, ModelResponse } from './index';

// OpenAI API adapter using Responses API
export async function openaiCreateMessage({ chat, model, search, think }: ChatInput): Promise<ModelResponse> {
  const apiKey = localStorage.getItem('openai_api_key');
  if (!apiKey) throw new Error('OpenAI API key not found');

  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.responses.create({
    model: model.key,
    input: chat.messages.map((m) => ({ role: m.role, content: m.content })),
    tools: search ? [{ type: 'web_search_preview' as const }] : undefined,
    reasoning: { effort: think || search ? 'low' : 'minimal' },
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
    stop_reason: response.status || 'completed'
  };
}

