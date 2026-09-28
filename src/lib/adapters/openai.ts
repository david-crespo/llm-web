import OpenAI from 'openai'
import type { Response } from 'openai/resources/responses/responses'
import type { Adapter, ChatInput, ModelResponse, PollResult } from './index'
import type { JobHandle } from '$lib/types'
import { settings } from '$lib/settings.svelte'
import { withEffortChanges } from './openai-effort'

// OpenAI API adapter using the Responses API in background mode: submit with
// background+store, then poll responses.retrieve by id. Because the id is
// server-side and durable, a reload re-polls and recovers the answer instead of
// losing it. https://developers.openai.com/api/docs/guides/background

function getClient(): OpenAI {
  const apiKey = settings.getKey('openai')
  if (!apiKey) throw new Error('OpenAI API key not found')
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true })
}

export class OpenAIAdapter implements Adapter {
  async start({ chat, model, search, think, signal }: ChatInput): Promise<JobHandle> {
    const client = getClient()

    // If the most recent assistant turn was an OpenAI Responses call we have its
    // response.id — chain via previous_response_id so the reasoning from that
    // turn carries over and we only need to send the new user message. Whether
    // it carries over is set by reasoning.context, which we leave unset: that
    // means 'auto', which gpt-5.6 resolves to 'all_turns'.
    // https://developers.openai.com/api/docs/guides/conversation-state
    const lastAssistant = chat.messages.filter((m) => m.role === 'assistant').at(-1)
    const previous = lastAssistant?.provider?.type === 'openai' ? lastAssistant.provider : undefined
    let initialEffort = previous?.initialEffort
    if (previous && initialEffort === undefined) {
      // Older chats have no saved baseline. Read the actual request setting so
      // we can keep chaining their reasoning/history without rewriting the prefix.
      const response = await client.responses.retrieve(previous.responseId, undefined, { signal })
      initialEffort = readEffort(response) ?? (think ? 'high' : 'low')
    }
    const { effort, input } = withEffortChanges(chat.messages, think, initialEffort)

    const response = await client.responses.create(
      {
        model: model.key,
        input,
        previous_response_id: previous?.responseId,
        // Submit as a background job and store it so we can poll by id (and
        // resume after a reload). The create call returns immediately, queued.
        background: true,
        store: true,
        // Separate cache accounting by chat; GPT-6 handles cache routing automatically.
        prompt_cache_key: String(chat.id),
        tools: search ? [{ type: 'web_search_preview' as const }] : undefined,
        // Low/high bracket Sol's medium default and both work on Astra, which
        // rejects none. Avoid xhigh/max to limit latency and cost on mobile.
        // https://developers.openai.com/api/docs/guides/reasoning
        reasoning: { effort },
        instructions: chat.systemPrompt,
      },
      { signal },
    )

    return { provider: 'openai', id: response.id, durable: true }
  }

  async poll(job: JobHandle, signal?: AbortSignal): Promise<PollResult> {
    const client = getClient()
    let response: Response
    try {
      response = await client.responses.retrieve(job.id, undefined, { signal })
    } catch (error) {
      // A stored response that the server has since GC'd / expired returns 404.
      // That's the shared not-recoverable arm — let the driver mark it interrupted.
      if (error instanceof OpenAI.NotFoundError) return { kind: 'unrecoverable' }
      throw error
    }

    switch (response.status) {
      case 'queued':
      case 'in_progress':
        return { kind: 'pending' }
      case 'failed':
        return { kind: 'failed', error: response.error?.message ?? 'Request failed' }
      case 'cancelled':
        return { kind: 'unrecoverable' }
      // Both terminal states can carry useful output.
      case 'completed':
      case 'incomplete':
        return { kind: 'final', response: parseResponse(response) }
      default:
        return { kind: 'failed', error: `Unsupported response status: ${response.status}` }
    }
  }

  async cancel(job: JobHandle): Promise<void> {
    await getClient().responses.cancel(job.id)
  }
}

function readEffort(response: Response): 'low' | 'high' | undefined {
  const effort = response.reasoning?.effort
  return effort === 'low' || effort === 'high' ? effort : undefined
}

function parseResponse(response: Response): ModelResponse {
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
    // The API reports request-level effort even after a configuration update.
    provider: { type: 'openai', responseId: response.id, initialEffort: readEffort(response) },
  }
}
