import Anthropic from '@anthropic-ai/sdk'
import type { ChatInput, ModelResponse } from './index'

export async function anthropicCreateMessage({
  chat,
  model,
  search,
  think,
}: ChatInput): Promise<ModelResponse> {
  const apiKey = localStorage.getItem('anthropic_api_key')
  if (!apiKey) throw new Error('Anthropic API key not found')

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const response = await client.messages.create({
    model: model.key,
    system: chat.systemPrompt,
    messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: 4096,
    thinking: think ? { type: 'enabled', budget_tokens: 1024 } : undefined,
    tools: search
      ? [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 5,
          },
        ]
      : undefined,
  })

  const content = response.content
    .filter((msg) => msg.type === 'text')
    .map((msg) => (msg.type === 'text' ? msg.text : ''))
    .join('\n\n')

  const reasoning = response.content
    .filter((msg) => msg.type === 'thinking')
    .map((msg) => (msg.type === 'thinking' ? msg.thinking : ''))
    .join('\n\n')

  const tokens = {
    input: response.usage.input_tokens || 0,
    output: response.usage.output_tokens || 0,
    input_cache_hit: 0,
  }

  return {
    content,
    reasoning,
    tokens,
    stop_reason: response.stop_reason || 'unknown',
  }
}
