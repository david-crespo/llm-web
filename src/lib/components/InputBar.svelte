<script lang="ts">
  import { getAvailableModels } from '$lib/models.svelte'
  import { chatState } from '$lib/chat.svelte'
  import CloseIcon from './icons/CloseIcon.svelte'
  import MenuIcon from './icons/MenuIcon.svelte'
  import SearchIcon from './icons/SearchIcon.svelte'
  import ThinkingIcon from './icons/ThinkingIcon.svelte'

  interface Props {
    message: string
    onSend: () => void
  }

  let { message = $bindable(), onSend }: Props = $props()

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

  $effect(() => {
    if (message === '' && textarea) {
      textarea.style.height = 'auto'
    }
  })
</script>

<div class="w-full border-t border-edge bg-surface-alt p-3">
  <div class="mx-auto md:max-w-2xl">
    <!-- Text input at top -->
    <div class="mb-2">
      <textarea
        bind:this={textarea}
        bind:value={message}
        oninput={(e) => {
          const target = e.currentTarget
          target.style.height = 'auto'
          target.style.height = `${Math.min(target.scrollHeight, 200)}px`
        }}
        onkeydown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSend()}
        placeholder={chatState.isCurrentLoading
          ? 'Waiting for response…'
          : chatState.lastMessageIsError
            ? 'Regen or fork to continue after error'
            : 'Type a message (⌘+Enter to send)'}
        class="w-full resize-none overflow-y-auto rounded border border-edge px-3 py-2"
        style="min-height: 42px; max-height: 200px;"
        rows="1"
        disabled={chatState.isCurrentLoading || chatState.lastMessageIsError}
      ></textarea>
    </div>

    <!-- Button row -->
    <div class="flex items-center gap-1">
      <button
        onclick={() => (chatState.sidebarOpen = !chatState.sidebarOpen)}
        class="size-10 rounded border border-edge bg-surface-alt hover:bg-surface-hover md:hidden"
        aria-label="Toggle sidebar"
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
        <select
          value={hasAnyKeys ? chatState.selectedModel : undefined}
          onchange={(e) => {
            if (hasAnyKeys) {
              const index = e.currentTarget.selectedIndex
              chatState.selectedModel = availableModels[index]
            }
          }}
          disabled={!hasAnyKeys}
          class="h-10 w-32 rounded border border-edge bg-surface-alt px-2 py-2 text-sm text-fg disabled:text-fg-faint"
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

        <!-- Web Search Toggle Button -->
        <button
          onclick={() => (chatState.webSearch = !chatState.webSearch)}
          class={getToggleClasses(chatState.webSearch, 'md:gap-2 md:pl-2.5 md:pr-3')}
          title="Web Search"
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
