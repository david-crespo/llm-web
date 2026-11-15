<script lang="ts">
  import Markdown from './Markdown.svelte'
  import SearchSources from './components/SearchSources.svelte'
  import type { ChatMessage } from './types'
  import { formatTime, formatMoney, formatTokens, shortModel } from '#lib/format.ts'
  import { DropdownMenu } from 'bits-ui'
  import { pasteLabel, splitSegments } from '#lib/paste.ts'

  interface Props {
    message: ChatMessage
    messageIndex?: number
    onRegen: (index: number) => void
    onFork: (index: number) => void
    onEdit: (index: number) => void
    canEdit?: boolean
  }

  let { message, messageIndex = -1, onRegen, onFork, onEdit, canEdit = false }: Props = $props()

  const menuItems = $derived([
    { label: 'Copy', onSelect: () => navigator.clipboard.writeText(message.content) },
    { label: 'Fork', onSelect: () => onFork(messageIndex) },
    ...(canEdit ? [{ label: 'Edit', onSelect: () => onEdit(messageIndex) }] : []),
    { label: 'Regen', onSelect: () => onRegen(messageIndex) },
  ])
</script>

<div
  class="mb-6 scroll-mt-3"
  data-message
  role="article"
  aria-label={`${message.role} message`}
>
  {#if message.role === 'assistant'}
    <!-- Assistant message header -->
    <div class="mb-2 flex items-center gap-1.5 text-xs text-fg-muted">
      <span class="font-medium">{shortModel(message.model)}</span>
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
      <div class="relative max-w-[87%] rounded-lg bg-surface-user px-4 py-3 pr-8 md:max-w-[70%]">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            class="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full text-lg font-bold text-fg-muted hover:bg-surface-hover hover:text-fg"
            aria-label="Message options"
          >
            ⋮
          </DropdownMenu.Trigger>
          <!-- Portaled so the scrolling message list can't clip it; flips up
               when there's no room below. -->
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              class="z-50 w-24 rounded border border-edge bg-surface-elevated py-1 shadow-lg"
              sideOffset={4}
              align="end"
            >
              {#each menuItems as item (item.label)}
                <DropdownMenu.Item
                  class="w-full cursor-pointer px-3 py-2 text-left text-sm outline-none hover:bg-surface-hover data-[highlighted]:bg-surface-hover"
                  onSelect={item.onSelect}
                >
                  {item.label}
                </DropdownMenu.Item>
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {#each splitSegments(message.content) as segment, i (i)}
          {#if segment.kind === 'pasted'}
            <details class="my-1" data-pasted>
              <summary class="cursor-pointer text-sm text-fg-muted hover:text-fg">
                {pasteLabel(segment.text)}
              </summary>
              <pre
                class="mt-2 max-h-64 overflow-auto rounded border border-edge bg-code-block-bg p-2 text-xs whitespace-pre-wrap"
              >{segment.text}</pre>
            </details>
          {:else}
            <Markdown content={segment.text} />
          {/if}
        {/each}
      </div>
    </div>
  {:else}
    <!-- Assistant message -->
    <div>
      <Markdown
        content={message.content}
        citations={message.citations}
        sources={message.sources}
      />
      <SearchSources sources={message.sources} searchQueries={message.searchQueries} />
    </div>
  {/if}
</div>
