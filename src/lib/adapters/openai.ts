import OpenAI from 'openai'
import type { ChatInput, ModelResponse } from './index'
import { settings } from '$lib/settings.svelte'

// OpenAI API adapter using Responses API
export async function openaiCreateMessage({
  chat,
  model,
  search,
  think,
  signal,
}: ChatInput): Promise<ModelResponse> {
  const apiKey = settings.getKey('openai')
  if (!apiKey) throw new Error('OpenAI API key not found')

  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })

  // If the most recent assistant turn was an OpenAI Responses call we have its
  // response.id — chain via previous_response_id so encrypted reasoning items
  // carry over and we only need to send the new user message.
  // https://developers.openai.com/api/docs/guides/conversation-state
  const lastAssistant = chat.messages.filter((m) => m.role === 'assistant').at(-1)
  const previous_response_id =
    lastAssistant?.provider?.type === 'openai' ? lastAssistant.provider.responseId : undefined
  const inputMessages = previous_response_id ? chat.messages.slice(-1) : chat.messages

  const response = await client.responses.create(
    {
      model: model.key,
      input: inputMessages.map((m) => ({ role: m.role, content: m.content })),
      previous_response_id,
      // Stable per-chat key so multi-turn requests route to the same backend
      // and hit the prompt cache reliably.
      prompt_cache_key: String(chat.id),
      tools: search ? [{ type: 'web_search_preview' as const }] : undefined,
      reasoning: { effort: think ? 'high' : 'low' },
      instructions: chat.systemPrompt,
    },
    { signal },
  )

  const searches = response.output.filter((item) => item.type === 'web_search_call').length

  const tokens = {
    input: response.usage?.input_tokens || 0,
    output: response.usage?.output_tokens || 0,
    input_cache_hit: response.usage?.input_tokens_details?.cached_tokens || 0,
  }

  return {
    content: response.output_text,
    reasoning: '', // Responses API integrates reasoning into output_text
    tokens,
    stop_reason: response.status || 'completed',
    searches: searches || undefined,
    provider: { type: 'openai', responseId: response.id },
  }
}
