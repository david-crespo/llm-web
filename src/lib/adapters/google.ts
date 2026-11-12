import { GoogleGenAI, type Interactions } from '@google/genai'
import type { Adapter, ChatInput, ModelResponse, PollResult } from './index'
import type { JobHandle } from '#lib/types.ts'
import { SourceCollector, utf8ByteOffsetMapper } from '#lib/citations.ts'
import { settings } from '#lib/settings.svelte.ts'

// Google adapter using the Interactions API in background mode: create with
// background+store, then poll interactions.get by id. The interaction id is
// server-side and durable, so a reload re-polls and recovers. Multi-turn
// chaining uses previous_interaction_id so prior context is retained server-side
// and only the new user message needs to be sent.

function getClient(): GoogleGenAI {
  const apiKey = settings.getKey('google')
  if (!apiKey) throw new Error('Gemini API key not found')
  return new GoogleGenAI({ apiKey })
}

export class GoogleAdapter implements Adapter {
  async start({ chat, model, search, think, signal }: ChatInput): Promise<JobHandle> {
    const genAI = getClient()

    const lastAssistant = chat.messages.filter((m) => m.role === 'assistant').at(-1)
    const previous_interaction_id =
      lastAssistant?.provider?.type === 'google' ? lastAssistant.provider.interactionId : undefined

    // When chaining, the server already has prior turns; send only the new
    // message. Otherwise send history in the steps format required by the
    // current Interactions API (fresh, provider-switched, or forked chat).
    const input = previous_interaction_id
      ? (chat.messages.at(-1)?.content ?? '')
      : chat.messages.map((m): Interactions.UserInputStep | Interactions.ModelOutputStep =>
          m.role === 'assistant'
            ? { type: 'model_output', content: [{ type: 'text', text: m.content }] }
            : { type: 'user_input', content: [{ type: 'text', text: m.content }] },
        )

    const interaction = await genAI.interactions.create(
      {
        model: model.key,
        background: true,
        store: true,
        system_instruction: chat.systemPrompt,
        previous_interaction_id,
        tools: [{ type: 'url_context' }, ...(search ? [{ type: 'google_search' as const }] : [])],
        generation_config: {
          // Low is the lowest level Gemini 4 models support; minimal is rejected.
          // https://ai.google.dev/gemini-api/docs/thinking
          thinking_level: think ? 'high' : 'low',
          // Ask for thought summaries so reasoning text comes back (analogous to
          // Anthropic's display: 'summarized').
          thinking_summaries: 'auto',
        },
        input,
      },
      { fetchOptions: { signal } },
    )

    return { provider: 'google', id: interaction.id, durable: true }
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
      case 'queued':
      case 'in_progress':
        return { kind: 'pending' }
      case 'requires_action':
        return { kind: 'failed', error: 'Interaction requires client action' }
      case 'failed':
      case 'budget_exceeded':
        return { kind: 'failed', error: `Interaction ${interaction.status}` }
      case 'cancelled':
        return { kind: 'unrecoverable' }
      // Both terminal states can carry useful output steps.
      case 'completed':
      case 'incomplete':
        return { kind: 'final', response: parseInteraction(interaction) }
      default:
        return { kind: 'failed', error: `Unsupported interaction status: ${interaction.status}` }
    }
  }

  async cancel(job: JobHandle): Promise<void> {
    await getClient().interactions.cancel(job.id)
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 404
}

function parseInteraction(interaction: Interactions.Interaction): ModelResponse {
  const steps = interaction.steps ?? []

  const reasoning = steps
    .filter((s): s is Interactions.ThoughtStep => s.type === 'thought')
    .flatMap((s) => s.summary ?? [])
    .filter((c): c is Interactions.TextContent => c.type === 'text')
    .map((c) => c.text)
    .join('\n\n')

  const querySet = new Set<string>()
  for (const step of steps) {
    if (step.type === 'google_search_call') {
      for (const q of step.arguments?.queries ?? []) {
        if (q.trim()) querySet.add(q.trim())
      }
    }
  }

  const textBlocks = steps
    .filter((s): s is Interactions.ModelOutputStep => s.type === 'model_output')
    .flatMap((s) => s.content ?? [])
    .filter((c): c is Interactions.TextContent => c.type === 'text')

  const collector = new SourceCollector()
  let content = ''

  // url_citation annotations carry UTF-8 byte start/end offsets into each text block.
  for (const block of textBlocks) {
    const baseOffset = content.length
    const toUtf16 = utf8ByteOffsetMapper(block.text)
    content += block.text

    const urlAnns = (block.annotations ?? [])
      .filter(
        (ann): ann is Interactions.Annotation & { type: 'url_citation' } =>
          ann.type === 'url_citation',
      )
      .sort((a, b) => (a.end_index ?? 0) - (b.end_index ?? 0))

    for (const ann of urlAnns) {
      if (!ann.url) continue
      const u16Start = ann.start_index != null ? toUtf16(ann.start_index) : 0
      const u16End = ann.end_index != null ? toUtf16(ann.end_index) : block.text.length
      const snippet = u16End > u16Start ? block.text.slice(u16Start, u16End) : undefined
      collector.cite(baseOffset + u16End, {
        url: ann.url,
        title: ann.title,
        snippet,
      })
    }
  }

  for (const step of steps) {
    if (step.type === 'url_context_result') {
      for (const res of step.result ?? []) {
        if (res.url && res.status === 'success') collector.add({ url: res.url })
      }
    }
  }

  const { sources, citations } = collector.build()
  const searchQueries = querySet.size > 0 ? [...querySet] : undefined
  const searches = querySet.size || steps.filter((s) => s.type === 'google_search_result').length

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
    sources,
    citations,
    searchQueries,
    provider: { type: 'google', interactionId: interaction.id },
  }
}
