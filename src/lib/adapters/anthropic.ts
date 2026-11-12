import Anthropic from '@anthropic-ai/sdk'
import type {
  BetaMessage,
  BetaThinkingBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { ChatInput, ModelResponse } from './index'
import { SourceCollector, normalizeUrl, type RawSourceInput } from '#lib/citations.ts'
import { settings } from '#lib/settings.svelte.ts'
import { NonDurableAdapter } from './non-durable'
import { withEffortChanges } from './anthropic-effort'

// Anthropic has no server-side background mode, so it uses NonDurableAdapter to
// fit the shared submit-then-poll driver while preserving the old reload
// behavior: after reload, the local promise is gone and the turn is interrupted.

function getClient(): Anthropic {
  const apiKey = settings.getKey('anthropic')
  if (!apiKey) throw new Error('Anthropic API key not found')
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

export class AnthropicAdapter extends NonDurableAdapter {
  constructor() {
    super('anthropic')
  }

  protected create({ chat, model, search, think, signal }: ChatInput): Promise<ModelResponse> {
    const client = getClient()
    const { effort, messages } = withEffortChanges(chat.messages, think)

    return client.beta.messages
      .create(
        {
          model: model.key,
          cache_control: { type: 'ephemeral' },
          system: chat.systemPrompt,
          messages,
          // SDK's non-streaming guard throws when max_tokens > ~21_333 (it assumes
          // 128k tokens/hour and refuses requests estimated to take >10 min).
          max_tokens: 20_000,
          // Force display: "summarized" so reasoning is returned; Opus 4.7
          // otherwise defaults to "omitted" and blanks the thinking text.
          thinking: { type: 'adaptive', display: 'summarized' },
          // Low/high bracket Opus 5.5's medium default; on Fable 5.2, high is
          // already the default. Avoid xhigh/max so thinking leaves room for
          // the answer within the shared 20k max_tokens cap.
          // https://platform.claude.com/docs/en/build-with-claude/effort
          output_config: { effort },
          tools: search
            ? [
                {
                  type: 'web_search_20260318',
                  name: 'web_search',
                  max_uses: 5,
                  // Allow direct calls alongside code execution: web_search_20260209+
                  // defaults to code_execution only, which strips inline citations.
                  allowed_callers: ['direct', 'code_execution_20260120'],
                },
                {
                  type: 'web_fetch_20260318',
                  name: 'web_fetch',
                  citations: { enabled: true },
                  allowed_callers: ['direct', 'code_execution_20260120'],
                },
                { type: 'code_execution_20260120', name: 'code_execution' },
              ]
            : undefined,
          betas: ['mid-conversation-output-config-2026-07-01'],
        },
        { signal },
      )
      .then(parseResponse)
  }
}

function parseResponse(response: BetaMessage): ModelResponse {
  const querySet = new Set<string>()
  const metaByUrl = new Map<string, { title?: string | null; age?: string | null }>()
  const discoveredResults: RawSourceInput[] = []
  const fetchedDocs: { url: string; title?: string | null }[] = []

  for (const block of response.content) {
    if (
      (block.type === 'tool_use' || block.type === 'server_tool_use') &&
      block.name === 'web_search'
    ) {
      const query = (block.input as { query?: string } | null)?.query?.trim()
      if (query) querySet.add(query)
    } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const item of block.content) {
        if (item.type !== 'web_search_result') continue
        const key = normalizeUrl(item.url)
        if (key) metaByUrl.set(key, { title: item.title, age: item.page_age })
        discoveredResults.push({ url: item.url, title: item.title, age: item.page_age })
      }
    } else if (
      block.type === 'web_fetch_tool_result' &&
      block.content.type === 'web_fetch_result'
    ) {
      const fetched = block.content
      const title = fetched.content?.title
      const key = normalizeUrl(fetched.url)
      if (key && !metaByUrl.has(key)) metaByUrl.set(key, { title })
      fetchedDocs.push({ url: fetched.url, title })
      discoveredResults.push({ url: fetched.url, title })
    }
  }

  const collector = new SourceCollector()
  let content = ''
  let sawToolSinceText = false

  for (const block of response.content) {
    if (block.type === 'thinking' || block.type === 'redacted_thinking') continue
    if (block.type !== 'text') {
      if (content) sawToolSinceText = true
      continue
    }

    if (sawToolSinceText && content && !/\s$/.test(content) && !/^\s/.test(block.text)) {
      content += '\n\n'
    }
    sawToolSinceText = false
    content += block.text

    for (const citation of block.citations ?? []) {
      if (citation.type === 'web_search_result_location') {
        const meta = metaByUrl.get(normalizeUrl(citation.url) ?? '')
        collector.cite(content.length, {
          url: citation.url,
          title: citation.title ?? meta?.title,
          age: meta?.age,
          snippet: citation.cited_text,
        })
      } else if (
        citation.type === 'char_location' &&
        typeof citation.document_index === 'number' &&
        fetchedDocs[citation.document_index]
      ) {
        const doc = fetchedDocs[citation.document_index]
        collector.cite(content.length, {
          url: doc.url,
          title: citation.document_title ?? doc.title,
          snippet: citation.cited_text,
        })
      }
    }
  }

  for (const item of discoveredResults) collector.add(item)
  const { sources, citations } = collector.build()
  const searchQueries = querySet.size > 0 ? [...querySet] : undefined

  const reasoning = response.content
    .filter((block): block is BetaThinkingBlock => block.type === 'thinking')
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
    sources,
    citations,
    searchQueries,
  }
}
