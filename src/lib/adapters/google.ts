import { GoogleGenAI, ThinkingLevel, type GenerateContentResponse } from '@google/genai'
import type { Adapter, ChatInput, ModelResponse, PollResult, StartResult } from './index'
import type { JobHandle } from '$lib/types'
import { settings } from '$lib/settings.svelte'

// Gemini's server-side background API (Interactions) is unusable from the
// browser: the SDK sends an `Api-Revision` request header that the CORS endpoint
// rejects, so every preflight fails. See:
// https://github.com/googleapis/js-genai/issues/1723
// So we use the synchronous generateContent call and fake the async shape
// locally, exactly like Anthropic: start() fires the request and stashes the
// in-flight promise in a map keyed by a client-generated id; poll() reports
// whether it has settled. The handle is NOT durable — after a reload the map is
// empty and poll() returns `unrecoverable`, which the driver turns into an
// interrupted message. This keeps the call site branchless: Gemini flows through
// the same submit→poll driver. Because the whole history is resent each turn,
// there's no chaining handle to store (no ProviderData), same as Anthropic.

/** A fired request whose settled state poll() can inspect without blocking. */
type Tracked = {
  settled: boolean
  value?: ModelResponse
  error?: unknown
}

function getClient(): GoogleGenAI {
  const apiKey = settings.getKey('google')
  if (!apiKey) throw new Error('Gemini API key not found')
  return new GoogleGenAI({ apiKey })
}

export class GoogleAdapter implements Adapter {
  private inflight = new Map<string, Tracked>()

  async start({ chat, model, search, think, signal }: ChatInput): Promise<StartResult> {
    const genAI = getClient()
    const id = crypto.randomUUID()
    const tracked: Tracked = { settled: false }

    // Fire the request but don't await it here; poll() resolves it. The promise
    // is tracked so poll() can tell pending from settled without blocking.
    genAI.models
      .generateContent({
        config: {
          thinkingConfig: {
            thinkingLevel: think ? ThinkingLevel.HIGH : ThinkingLevel.LOW,
          },
          systemInstruction: chat.systemPrompt,
          tools: [{ urlContext: {} }, ...(search ? [{ googleSearch: {} }] : [])],
          abortSignal: signal,
        },
        model: model.key,
        contents: chat.messages.map((msg) => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
      })
      .then(
        (response) => {
          tracked.value = parseResponse(response)
          tracked.settled = true
        },
        (error) => {
          tracked.error = error
          tracked.settled = true
        },
      )

    this.inflight.set(id, tracked)
    return { job: { provider: 'google', id } }
  }

  async poll(job: JobHandle): Promise<PollResult> {
    const tracked = this.inflight.get(job.id)
    // No live promise: we reloaded since submitting (or it was already consumed).
    if (!tracked) return { kind: 'unrecoverable' }
    if (!tracked.settled) return { kind: 'pending' }

    this.inflight.delete(job.id)
    if (tracked.error) {
      const message = tracked.error instanceof Error ? tracked.error.message : 'Unknown error'
      return { kind: 'failed', error: message }
    }
    return { kind: 'final', response: tracked.value! }
  }

  async cancel(job: JobHandle): Promise<void> {
    // No server-side job; drop the in-memory promise (the underlying fetch is
    // aborted via the request's AbortSignal by the driver).
    this.inflight.delete(job.id)
  }
}

function parseResponse(result: GenerateContentResponse): ModelResponse {
  const parts = result.candidates?.[0].content?.parts ?? []
  const reasoning = parts
    .filter((p) => p.text && p.thought)
    .map((p) => p.text!)
    .join('\n\n')
  let content = parts
    .filter((p) => p.text && !p.thought)
    .map((p) => p.text!)
    .join('\n\n')

  const searchResults = result.candidates?.[0]?.groundingMetadata?.groundingChunks
  const searches = searchResults && searchResults.length > 0 ? 1 : 0
  const searchResultsMd = searchResults
    ? '\n\n### Sources\n\n' +
      searchResults
        .filter((chunk) => chunk.web)
        .map((chunk) => `- [${chunk.web!.title}](${chunk.web!.uri})`)
        .join('\n')
    : ''

  content += searchResultsMd

  const tokens = {
    input: result.usageMetadata?.promptTokenCount || 0,
    output:
      (result.usageMetadata?.candidatesTokenCount || 0) +
      (result.usageMetadata?.thoughtsTokenCount || 0),
    input_cache_hit: result.usageMetadata?.cachedContentTokenCount || 0,
  }

  return {
    content,
    reasoning,
    tokens,
    stop_reason: result.candidates?.[0]?.finishReason || '',
    searches: searches || undefined,
  }
}
