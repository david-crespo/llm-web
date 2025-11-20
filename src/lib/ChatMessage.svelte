<script lang="ts">
  import Markdown from './Markdown.svelte'
  import type { ChatMessage } from './types'

  interface Props {
    message: ChatMessage
    messageIndex?: number
    onRegen: (index: number) => void
    onFork: (index: number) => void
  }

  import { clickOutside } from '$lib/actions/clickOutside'

  let { message, messageIndex = -1, onRegen, onFork }: Props = $props()

  let showMenu = $state(false)

  function formatTime(ms: number): string {
    return `${(ms / 1000).toFixed(2)}s`
  }

  function formatCost(cost: number): string {
    return `$${cost.toFixed(5)}`
  }

  function formatTokens(tokens: {
    input: number
    input_cache_hit?: number
    output: number
  }): string {
    const cacheHit = tokens.input_cache_hit ? ` (${tokens.input_cache_hit})` : ''
    return `${tokens.input}${cacheHit} → ${tokens.output}`
  }
</script>

<div class="mb-6" data-message>
  {#if message.role === 'assistant'}
    <!-- Assistant message header -->
    <div class="mb-2 flex items-center gap-2 text-xs text-gray-600">
      <span class="font-medium">{message.model}</span>
      <span>•</span>
      <span>{formatTime(message.timeMs)}</span>
      <span>•</span>
      <span>{formatCost(message.cost)}</span>
      <span>•</span>
      <span title="Input → Output">{formatTokens(message.tokens)}</span>
      {#if message.stop_reason && !['stop', 'end_turn', 'completed'].includes(message.stop_reason.toLowerCase())}
        <span>•</span>
        <span class="text-red-600">Stop: {message.stop_reason}</span>
      {/if}
      {#if message.search}
        <span>•</span>
        <span title="Search enabled">🌐</span>
      {/if}
    </div>

    <!-- Reasoning (if present) -->
    {#if message.reasoning}
      <details class="mb-3">
        <summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
          Reasoning
        </summary>
        <div class="mt-2 rounded border-l-4 border-gray-300 bg-gray-50 p-3">
          <Markdown content={message.reasoning} />
        </div>
      </details>
    {/if}
  {/if}

  <!-- Message content -->
  {#if message.role === 'user'}
    <!-- User message bubble -->
    <div class="flex justify-end">
      <div
        class="relative max-w-[87%] rounded-lg bg-gray-200 px-4 py-3 pr-8"
        use:clickOutside={{ onOut: () => (showMenu = false) }}
      >
        <!-- Kebab menu inside bubble -->
        <div class="absolute top-2 right-2">
          <button
            onclick={() => (showMenu = !showMenu)}
            class="flex size-6 items-center justify-center rounded-full text-lg font-bold text-gray-600 hover:bg-gray-300 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-zinc-600 dark:hover:text-gray-200"
            aria-label="Message options"
          >
            ⋮
          </button>
        </div>

        {#if showMenu}
          <div
            class="absolute top-8 right-2 z-10 w-20 rounded border border-gray-300 bg-white py-1 shadow-lg"
          >
            <button
              onclick={async () => {
                showMenu = false
                await navigator.clipboard.writeText(message.content)
              }}
              class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Copy
            </button>
            <button
              onclick={() => {
                showMenu = false
                onFork(messageIndex)
              }}
              class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Fork
            </button>
            <button
              onclick={() => {
                showMenu = false
                onRegen(messageIndex)
              }}
              class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Regen
            </button>
          </div>
        {/if}

        <Markdown content={message.content} />
      </div>
    </div>
  {:else}
    <!-- Assistant message -->
    <div>
      <Markdown content={message.content} />
    </div>
  {/if}
</div>
