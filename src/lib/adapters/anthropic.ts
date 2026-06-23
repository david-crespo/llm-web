import Anthropic from '@anthropic-ai/sdk'
import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type {
  ThinkingBlock,
  CitationsWebSearchResultLocation,
} from '@anthropic-ai/sdk/resources/messages'
import type { Adapter, ChatInput, ModelResponse, PollResult, StartResult } from './index'
import type { JobHandle } from '$lib/types'
import { settings } from '$lib/settings.svelte'

// Anthropic has no server-side background mode, so it fakes the async shape
// locally: start() fires messages.create and stashes the in-flight promise in a
// map keyed by a client-generated id; poll() reports whether that promise has
// settled. The handle is NOT durable — after a reload the map is empty and
// poll() returns `unrecoverable`, which the driver turns into an interrupted
// message (matching the pre-async behavior exactly). This keeps the call site
// branchless: Anthropic flows through the same submit→poll driver.

/** A fired request whose settled state poll() can inspect without blocking. */
type Tracked = {
  settled: boolean
  value?: ModelResponse
  error?: unknown
}

function getClient(): Anthropic {
  const apiKey = settings.getKey('anthropic')
  if (!apiKey) throw new Error('Anthropic API key not found')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

export class AnthropicAdapter implements Adapter {
  private inflight = new Map<string, Tracked>()

  async start({ chat, model, search, think, signal }: ChatInput): Promise<StartResult> {
    const client = getClient()
    const id = crypto.randomUUID()
    const tracked: Tracked = { settled: false }

    // Fire the request but don't await it here; poll() resolves it. The promise
    // is tracked so poll() can tell pending from settled without blocking.
    client.beta.messages
      .create(
        {
          model: model.key,
          cache_control: { type: 'ephemeral' },
          system: chat.systemPrompt,
          messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
          // SDK's non-streaming guard throws when max_tokens > ~21_333 (it assumes
          // 128k tokens/hour and refuses requests estimated to take >10 min).
          max_tokens: 20_000,
          // Force display: "summarized" so reasoning is returned; Opus 4.7
          // otherwise defaults to "omitted" and blanks the thinking text.
          thinking: { type: 'adaptive', display: 'summarized' },
          output_config: { effort: think ? 'high' : 'low' },
          tools: search
            ? [
                { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
                { type: 'web_fetch_20260209', name: 'web_fetch' },
                { type: 'code_execution_20260120', name: 'code_execution' },
              ]
            : undefined,
          betas: ['code-execution-web-tools-2026-02-09'],
        },
        { signal },
      )
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
    return { job: { provider: 'anthropic', id } }
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

function parseResponse(response: BetaMessage): ModelResponse {
  const content = response.content
    .map((block): string | null => {
      if (block.type === 'text') {
        let text = block.text

        // Add citations as inline links if they exist
        if (block.citations && block.citations.length > 0) {
          const links = block.citations
            .filter(
              (citation): citation is CitationsWebSearchResultLocation =>
                citation.type === 'web_search_result_location',
            )
            .map((citation) => {
              try {
                const domain = new URL(citation.url).hostname.replace(/^www\./, '')
                return `[${domain}](${citation.url})`
              } catch {
                return null
              }
            })
            .filter((link): link is string => link !== null)
            .join(', ')

          if (links) {
            text += ` (${links})`
          }
        }

        return text
      }

      // Handle web search tool uses
      if (block.type === 'tool_use' || block.type === 'server_tool_use') {
        if (block.name === 'web_search') {
          return `🔍 **Search:** ${(block.input as { query: string }).query}\n\n`
        }
        if (block.name === 'web_fetch') {
          return `🌐 **Fetch:** ${(block.input as { url: string }).url}\n\n`
        }
      }

      return ''
    })
    .join('')

  const reasoning = response.content
    .filter((block): block is ThinkingBlock => block.type === 'thinking')
    .map((block) => block.thinking)
    .join('\n\n')

  const searches = response.usage.server_tool_use?.web_search_requests ?? 0

  // input_tokens is only tokens after the last cache breakpoint, so add in
  // cache hits and writes for total. See:
  // https://platform.claude.com/docs/en/build-with-claude/prompt-caching#tracking-cache-performance
  const cache_hit = response.usage.cache_read_input_tokens ?? 0
  const cache_write = response.usage.cache_creation_input_tokens ?? 0
  const tokens = {
    input: (response.usage.input_tokens || 0) + cache_hit + cache_write,
    output: response.usage.output_tokens || 0,
    input_cache_hit: cache_hit,
  }

  return {
    content,
    reasoning,
    tokens,
    stop_reason: response.stop_reason || 'unknown',
    searches: searches || undefined,
  }
}
