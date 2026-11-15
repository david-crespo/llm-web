<script lang="ts">
  import Markdown from './Markdown.svelte'
  import SearchSources from './components/SearchSources.svelte'
  import type { ChatMessage } from './types'
  import {
    formatTime,
    formatMoney,
    formatTokens,
    formatTokensExact,
    fullModel,
    shortModel,
  } from '#lib/format.ts'
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
  let metaEl = $state<HTMLDivElement>()

  function wraps(el: HTMLElement): boolean {
    const first = el.firstElementChild as HTMLElement | null
    const last = el.lastElementChild as HTMLElement | null
    if (!first || !last || first === last) return false
    return last.offsetTop - first.offsetTop > 8
  }

  // Keep the full model name whenever 1 line fits; drop the brand prefix only
  // when that avoids a wrap; restore the full name if wrapping onto 2 lines is
  // unavoidable anyway.
  $effect(() => {
    const el = metaEl
    if (!el || message.role !== 'assistant') return
    const full = fullModel(message.model)
    const short = shortModel(message.model)
    // Re-fit whenever any sibling metadata field changes on a reused row.
    void [
      formatTime(message.timeMs),
      formatMoney(message.cost),
      formatTokens(message.tokens),
      message.stop_reason,
      message.search,
    ]

    const fit = () => {
      const modelEl = el.firstElementChild as HTMLElement | null
      if (!modelEl) return
      modelEl.textContent = full
      if (full === short || el.clientWidth === 0) return
      if (wraps(el)) {
        modelEl.textContent = short
        if (wraps(el)) modelEl.textContent = full
      }
    }

    let lastWidth = el.clientWidth
    fit()
    if (full === short) return

    const observer = new ResizeObserver(() => {
      const width = el.clientWidth
      if (width === lastWidth) return
      lastWidth = width
      fit()
    })
    observer.observe(el)
    return () => observer.disconnect()
  })
</script>

<div
  class="mb-6 scroll-mt-3"
  data-message
  role="article"
  aria-label={`${message.role} message`}
>
  {#if message.role === 'assistant'}
    {@const abnormalStop =
      message.stop_reason &&
      !['stop', 'end_turn', 'completed'].includes(message.stop_reason.toLowerCase())}
    {#snippet searchBadge()}
      {#if message.search}<span class="meta-dot" aria-hidden="true">·</span><span
          title="Web search">🌐</span
        >{/if}
    {/snippet}
    <!-- Assistant message header -->
    <div class="meta-clip mb-2">
      <div bind:this={metaEl} class="meta-flow text-xs text-fg-muted tabular-nums">
        <span class="font-medium"></span>
        <span>{formatTime(message.timeMs)}</span>
        <span>{formatMoney(message.cost)}</span>
        {#if abnormalStop}
          <span title={`Input → Output: ${formatTokensExact(message.tokens)}`}
            >{formatTokens(message.tokens)}</span
          >
          <span
            ><span class="text-danger">Stop: {message.stop_reason}</span>{@render searchBadge()}</span
          >
        {:else}
          <span
            ><span title={`Input → Output: ${formatTokensExact(message.tokens)}`}
              >{formatTokens(message.tokens)}</span
            >{@render searchBadge()}</span
          >
        {/if}
      </div>
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

<style>
  /* Each item gets a leading dot. The row is shifted left by one dot width and
     clipped, so the dot that starts each line is hidden, including after a
     wrap. */
  .meta-clip {
    overflow: hidden;
  }
  .meta-flow {
    display: flex;
    flex-wrap: wrap;
    margin-left: -1em;
  }
  .meta-flow > * {
    white-space: nowrap;
  }
  .meta-flow > ::before,
  .meta-dot {
    display: inline-block;
    width: 1em;
    text-align: center;
  }
  .meta-flow > ::before {
    content: '·';
  }
</style>
