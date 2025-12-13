import Anthropic from '@anthropic-ai/sdk'
import type {
  ThinkingBlock,
  CitationsWebSearchResultLocation,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages'
import type { ChatInput, ModelResponse } from './index'
import { settings } from '$lib/settings.svelte'

export async function anthropicCreateMessage({
  chat,
  model,
  search,
  think,
  signal,
}: ChatInput): Promise<ModelResponse> {
  const apiKey = settings.anthropicKey
  if (!apiKey) throw new Error('Anthropic API key not found')

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const response = await client.messages.create(
    {
      model: model.key,
      system: chat.systemPrompt,
      messages: chat.messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 8192,
      thinking: { type: 'enabled', budget_tokens: think ? 4096 : 1024 },
      tools: search
        ? [
            {
              type: 'web_search_20250305',
              name: 'web_search',
              max_uses: 5,
            },
          ]
        : undefined,
    },
    { signal },
  )

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
        const toolBlock = block as ToolUseBlock
        if (toolBlock.name === 'web_search') {
          return `🔍 **Search:** ${(toolBlock.input as { query: string }).query}\n\n`
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
    searches: searches || undefined,
  }
}
