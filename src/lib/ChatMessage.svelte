<script lang="ts">
  import Markdown from './Markdown.svelte'
  import type { ChatMessage } from './types'
  import { formatTime, formatMoney, formatTokens } from '$lib/format'
  import { clickOutside } from '$lib/actions/clickOutside'

  interface Props {
    message: ChatMessage
    messageIndex?: number
    onRegen: (index: number) => void
    onFork: (index: number) => void
  }

  let { message, messageIndex = -1, onRegen, onFork }: Props = $props()

  let showMenu = $state(false)
</script>

<div class="mb-6" data-message>
  {#if message.role === 'assistant'}
    <!-- Assistant message header -->
    <div class="mb-2 flex items-center gap-1.5 text-xs text-fg-muted">
      <span class="font-medium">{message.model}</span>
      <span>•</span>
      <span>{formatTime(message.timeMs)}</span>
      <span>•</span>
      <span>{formatMoney(message.cost)}</span>
      <span>•</span>
      <span title="Input → Output">{formatTokens(message.tokens)}</span>
      {#if message.stop_reason && !['stop', 'end_turn', 'completed'].includes(message.stop_reason.toLowerCase())}
        <span>•</span>
        <span class="text-danger">Stop: {message.stop_reason}</span>
      {/if}
      {#if message.search}
        <span>•</span>
        <span title="Web search">🌐</span>
      {/if}
    </div>

    <!-- Reasoning (if present) -->
    {#if message.reasoning}
      <details class="mb-3">
        <summary class="cursor-pointer text-sm text-fg-muted hover:text-fg"> Reasoning </summary>
        <div class="mt-2 rounded border-l-4 border-edge bg-surface-alt p-3">
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
        class="relative max-w-[87%] rounded-lg bg-surface-user px-4 py-3 pr-8"
        use:clickOutside={{ onOut: () => (showMenu = false) }}
      >
        <!-- Kebab menu inside bubble -->
        <div class="absolute top-2 right-2">
          <button
            onclick={() => (showMenu = !showMenu)}
            class="flex size-6 items-center justify-center rounded-full text-lg font-bold text-fg-muted hover:bg-surface-hover hover:text-fg"
            aria-label="Message options"
          >
            ⋮
          </button>
        </div>

        {#if showMenu}
          <div
            class="absolute top-8 right-2 z-10 w-20 rounded border border-edge bg-surface-elevated py-1 shadow-lg"
          >
            <button
              onclick={async () => {
                showMenu = false
                await navigator.clipboard.writeText(message.content)
              }}
              class="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover"
            >
              Copy
            </button>
            <button
              onclick={() => {
                showMenu = false
                onFork(messageIndex)
              }}
              class="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover"
            >
              Fork
            </button>
            <button
              onclick={() => {
                showMenu = false
                onRegen(messageIndex)
              }}
              class="w-full px-3 py-2 text-left text-sm hover:bg-surface-hover"
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
