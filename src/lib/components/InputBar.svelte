<script lang="ts">
  import { getAvailableModels } from '$lib/models.svelte'
  import { chatState } from '$lib/chat.svelte'
  import { PASTE_COLLAPSE_CHARS, joinComposer, pasteLabel, splitComposer } from '$lib/paste'
  import ChevronDownIcon from './icons/ChevronDownIcon.svelte'
  import CloseIcon from './icons/CloseIcon.svelte'
  import MenuIcon from './icons/MenuIcon.svelte'
  import SearchIcon from './icons/SearchIcon.svelte'
  import ThinkingIcon from './icons/ThinkingIcon.svelte'

  interface Props {
    message: string
    onHeightChange?: (height: number) => void
    onSend: () => void
  }

  let { message = $bindable(), onHeightChange, onSend }: Props = $props()

  const availableModels = $derived(getAvailableModels())
  const hasAnyKeys = $derived(availableModels.length > 0)

  // Auto-select first model when available models change
  $effect(() => {
    if (
      availableModels.length > 0 &&
      !availableModels.some((m) => m.key === chatState.selectedModel?.key)
    ) {
      chatState.selectedModel = availableModels[0]
    }
  })

  function getToggleClasses(isActive: boolean, extra = '') {
    const base =
      'h-10 w-10 md:w-auto flex items-center justify-center rounded border p-0'
    const active =
      'border-toggle-active-border bg-toggle-active text-toggle-active-fg hover:bg-toggle-active-hover'
    const inactive = 'border-edge bg-surface-alt text-fg-muted hover:bg-surface-hover'

    return `${base} ${extra} ${isActive ? active : inactive}`
  }

  let textarea: HTMLTextAreaElement | undefined = $state()
  let height = $state(0)

  // `message` is the full string that will be sent. Large pastes live in it as
  // <pasted> blocks; the textarea shows only the typed part and each block is a
  // chip. Deriving both from `message` means edit/fork repopulate correctly.
  const composer = $derived(splitComposer(message))

  function handlePaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text/plain') ?? ''
    if (text.length < PASTE_COLLAPSE_CHARS) return
    e.preventDefault()
    message = joinComposer(composer.text, [...composer.pastes, text])
  }

  function removePaste(index: number) {
    message = joinComposer(
      composer.text,
      composer.pastes.filter((_, i) => i !== index),
    )
  }

  $effect(() => {
    onHeightChange?.(height)
  })

  function resize(currentMessage = message) {
    if (!textarea) return
    textarea.style.height = 'auto'
    if (currentMessage) textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }

  export function focusInput() {
    textarea?.focus()
  }

  // Resize on any `message` change, including programmatic ones (edit/fork),
  // not just keystrokes — so the textarea expands to fit content put in by code.
  $effect(() => {
    resize(composer.text)
  })
</script>

<div
  bind:clientHeight={height}
  class="fixed inset-x-0 bottom-0 z-10 w-full border-t border-edge bg-surface-alt p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static"
>
  <div class="mx-auto md:max-w-2xl">
    <!-- Collapsed pastes -->
    {#if composer.pastes.length > 0}
      <div class="mb-2 flex flex-wrap gap-1.5">
        {#each composer.pastes as paste, i (i)}
          <span
            class="inline-flex items-center gap-1 rounded border border-edge bg-surface py-1 pr-1 pl-2 text-xs text-fg-muted"
            data-pasted-chip
          >
            {pasteLabel(paste)}
            <button
              onclick={() => removePaste(i)}
              class="flex size-5 items-center justify-center rounded-full hover:bg-surface-hover hover:text-fg"
              aria-label="Remove pasted content"
            >
              <CloseIcon width={12} height={12} />
            </button>
          </span>
        {/each}
      </div>
    {/if}

    <!-- Text input at top -->
    <div class="mb-2">
      <textarea
        bind:this={textarea}
        value={composer.text}
        oninput={(e) => {
          const target = e.currentTarget
          message = joinComposer(target.value, composer.pastes)
          target.style.height = 'auto'
          target.style.height = `${Math.min(target.scrollHeight, 200)}px`
        }}
        onpaste={handlePaste}
        onkeydown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSend()}
        placeholder={chatState.isCurrentLoading
          ? 'Waiting for response…'
          : chatState.lastMessageIsError
            ? 'Regen or fork to continue after error'
            : 'Type a message (⌘+Enter to send)'}
        class="w-full resize-none overflow-y-auto rounded border border-edge px-3 py-2"
        style="min-height: 42px; max-height: 200px;"
        rows="1"
        aria-label="Message"
        disabled={chatState.isCurrentLoading || chatState.lastMessageIsError}
      ></textarea>
    </div>

    <!-- Button row -->
    <div class="flex items-center gap-1">
      <button
        onclick={() => (chatState.sidebarOpen = !chatState.sidebarOpen)}
        class="size-10 rounded border border-edge bg-surface-alt hover:bg-surface-hover md:hidden"
        aria-label="Toggle sidebar"
        aria-expanded={chatState.sidebarOpen}
        aria-controls="mobile-sidebar"
      >
        {#if chatState.sidebarOpen}
          <CloseIcon class="mx-auto" />
        {:else}
          <MenuIcon class="mx-auto" />
        {/if}
      </button>

      <div class="flex-1"></div>

      <div class="flex items-center gap-2">
        <!-- Model selector -->
        <div class="relative">
          <select
            value={hasAnyKeys ? chatState.selectedModel : undefined}
            onchange={(e) => {
              if (hasAnyKeys) {
                const index = e.currentTarget.selectedIndex
                chatState.selectedModel = availableModels[index]
              }
            }}
            disabled={!hasAnyKeys}
            class="h-10 w-32 appearance-none rounded border border-edge bg-surface-alt bg-none px-2 py-2 text-sm text-fg disabled:text-fg-faint sm:w-44 sm:pr-8"
            aria-label="Select model"
          >
            {#if !hasAnyKeys}
              <option selected>No API keys</option>
            {:else}
              {#each availableModels as model (model.key)}
                <option value={model}>{model.id}</option>
              {/each}
            {/if}
          </select>
          <ChevronDownIcon
            class="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 text-fg-faint sm:block"
          />
        </div>

        <!-- Web Search Toggle Button -->
        <button
          onclick={() => (chatState.webSearch = !chatState.webSearch)}
          class={getToggleClasses(chatState.webSearch, 'md:gap-2 md:pl-2.5 md:pr-3')}
          title="Web Search"
          aria-label="Search"
          aria-pressed={chatState.webSearch}
        >
          <SearchIcon />
          <span class="hidden text-sm md:inline">Search</span>
        </button>

        <!-- Reasoning Toggle Button -->
        <button
          onclick={() => (chatState.reasoning = !chatState.reasoning)}
          class={getToggleClasses(chatState.reasoning, 'md:gap-1 md:pl-2 md:pr-3')}
          title="Reasoning"
          aria-label="Think"
          aria-pressed={chatState.reasoning}
        >
          <ThinkingIcon />
          <span class="hidden text-sm md:inline">Think</span>
        </button>

        <button
          onclick={onSend}
          disabled={chatState.isCurrentLoading || !message.trim() || chatState.lastMessageIsError}
          class="rounded bg-btn-primary px-4 py-2 text-white hover:bg-btn-primary-hover disabled:bg-btn-disabled"
        >
          Send
        </button>
      </div>
    </div>
  </div>
</div>
