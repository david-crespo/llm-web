import { GoogleGenAI, type Interactions } from '@google/genai'
import type { Adapter, ChatInput, ModelResponse, PollResult, StartResult } from './index'
import type { JobHandle } from '$lib/types'
import { settings } from '$lib/settings.svelte'

// Google adapter using the Interactions API in background mode: create with
// background+store, then poll interactions.get by id. The interaction id is
// server-side and durable, so a reload re-polls and recovers — unlike the older
// generateContent call, which was lost if the connection dropped.
// Multi-turn chaining uses previous_interaction_id so prior context is retained
// server-side and we only send the new user message.

function getClient(): GoogleGenAI {
  const apiKey = settings.getKey('google')
  if (!apiKey) throw new Error('Gemini API key not found')
  return new GoogleGenAI({ apiKey })
}

export class GoogleAdapter implements Adapter {
  async start({ chat, model, search, think, signal }: ChatInput): Promise<StartResult> {
    const genAI = getClient()

    const lastAssistant = chat.messages.filter((m) => m.role === 'assistant').at(-1)
    const previous_interaction_id =
      lastAssistant?.provider?.type === 'google' ? lastAssistant.provider.interactionId : undefined

    // When chaining, the server already has prior turns; send only the new
    // message. Otherwise send the whole history as turns (fresh or forked chat).
    const input = previous_interaction_id
      ? (chat.messages.at(-1)?.content ?? '')
      : chat.messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          content: m.content,
        }))

    const interaction = await genAI.interactions.create(
      {
        model: model.key,
        background: true,
        store: true,
        system_instruction: chat.systemPrompt,
        previous_interaction_id,
        tools: [{ type: 'url_context' }, ...(search ? [{ type: 'google_search' as const }] : [])],
        generation_config: {
          thinking_level: think ? 'high' : 'low',
          // Ask for thought summaries so reasoning text comes back (analogous to
          // Anthropic's display: 'summarized').
          thinking_summaries: 'auto',
        },
        input,
      },
      { fetchOptions: { signal } },
    )

    return { job: { provider: 'google', id: interaction.id } }
  }

  async poll(job: JobHandle, signal?: AbortSignal): Promise<PollResult> {
    const genAI = getClient()
    let interaction: Interactions.Interaction
    try {
      interaction = await genAI.interactions.get(job.id, null, { fetchOptions: { signal } })
    } catch (error) {
      // A stored interaction the server has since expired returns 404 — the
      // shared not-recoverable arm. Other errors bubble up → driver marks failed.
      if (isNotFound(error)) return { kind: 'unrecoverable' }
      throw error
    }

    switch (interaction.status) {
      case 'in_progress':
      case 'requires_action':
        return { kind: 'pending' }
      case 'failed':
      case 'budget_exceeded':
        return { kind: 'failed', error: `Interaction ${interaction.status}` }
      case 'cancelled':
        return { kind: 'unrecoverable' }
      // 'completed' and 'incomplete' both carry steps; surface whatever we got.
      default:
        return { kind: 'final', response: parseInteraction(interaction) }
    }
  }

  async cancel(job: JobHandle): Promise<void> {
    await getClient().interactions.cancel(job.id)
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 404
  )
}

function parseInteraction(interaction: Interactions.Interaction): ModelResponse {
  const steps = interaction.steps ?? []

  const reasoning = steps
    .filter((s): s is Interactions.ThoughtStep => s.type === 'thought')
    .flatMap((s) => s.summary ?? [])
    .filter((c): c is Interactions.TextContent => c.type === 'text')
    .map((c) => c.text)
    .join('\n\n')

  const textBlocks = steps
    .filter((s): s is Interactions.ModelOutputStep => s.type === 'model_output')
    .flatMap((s) => s.content ?? [])
    .filter((c): c is Interactions.TextContent => c.type === 'text')

  let content = textBlocks.map((c) => c.text).join('')

  // Cited sources come back as url_citation annotations on the text blocks.
  // Dedupe by URL and append a Sources list, mirroring the old grounding output.
  const citations = new Map<string, string>()
  for (const block of textBlocks) {
    for (const ann of block.annotations ?? []) {
      if (ann.type === 'url_citation' && ann.url) {
        citations.set(ann.url, ann.title || ann.url)
      }
    }
  }
  if (citations.size > 0) {
    content +=
      '\n\n### Sources\n\n' +
      [...citations].map(([url, title]) => `- [${title}](${url})`).join('\n')
  }

  const searches = steps.filter((s) => s.type === 'google_search_result').length

  const usage = interaction.usage
  const tokens = {
    input: usage?.total_input_tokens || 0,
    output: usage?.total_output_tokens || 0,
    input_cache_hit: usage?.total_cached_tokens || 0,
  }

  return {
    content,
    reasoning,
    tokens,
    stop_reason: interaction.status || 'completed',
    searches: searches || undefined,
    provider: { type: 'google', interactionId: interaction.id },
  }
}
