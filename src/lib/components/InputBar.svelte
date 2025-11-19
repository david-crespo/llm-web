<script lang="ts">
  import { models, type Model } from '$lib/models'
  import CloseIcon from './icons/CloseIcon.svelte'
  import MenuIcon from './icons/MenuIcon.svelte'
  import SearchIcon from './icons/SearchIcon.svelte'
  import ThinkingIcon from './icons/ThinkingIcon.svelte'

  interface Props {
    message: string
    isLoading: boolean
    selectedModel: Model
    webSearchEnabled: boolean
    reasoningEnabled: boolean
    sidebarOpen: boolean
    onToggleSidebar: () => void
    onSend: () => void
  }

  let {
    message = $bindable(),
    isLoading,
    selectedModel = $bindable(),
    webSearchEnabled = $bindable(),
    reasoningEnabled = $bindable(),
    sidebarOpen,
    onToggleSidebar,
    onSend,
  }: Props = $props()

  let textarea: HTMLTextAreaElement | undefined = $state()

  // Check which API keys are available
  const hasOpenAI = $derived(!!localStorage.getItem('openai_api_key'))
  const hasAnthropic = $derived(!!localStorage.getItem('anthropic_api_key'))
  const hasGoogle = $derived(!!localStorage.getItem('google_api_key'))

  // Filter models based on available API keys
  const availableModels = $derived(
    models.filter((model) => {
      if (model.provider === 'openai') return hasOpenAI
      if (model.provider === 'anthropic') return hasAnthropic
      if (model.provider === 'google') return hasGoogle
      return false
    }),
  )

  const hasAnyKeys = $derived(hasOpenAI || hasAnthropic || hasGoogle)

  $effect(() => {
    if (message === '' && textarea) {
      textarea.style.height = 'auto'
    }
  })
</script>

<div class="w-full border-t border-gray-300 bg-gray-50 p-3">
  <!-- Text input at top -->
  <div class="mb-2">
    <textarea
      bind:this={textarea}
      bind:value={message}
      oninput={(e) => {
        // Resize on input up to 200px high
        const target = e.currentTarget
        target.style.height = 'auto'
        target.style.height = `${Math.min(target.scrollHeight, 200)}px`
      }}
      onkeydown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSend()}
      placeholder="Type your message..."
      class="w-full resize-none overflow-y-auto rounded border border-gray-300 px-3 py-2"
      style="min-height: 42px; max-height: 200px;"
      rows="1"
      disabled={isLoading}
    ></textarea>
  </div>

  <!-- Button row -->
  <div class="flex items-center gap-1">
    <button
      onclick={onToggleSidebar}
      class="size-10 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      aria-label="Toggle sidebar"
    >
      {#if sidebarOpen}
        <CloseIcon class="mx-auto" />
      {:else}
        <MenuIcon class="mx-auto" />
      {/if}
    </button>

    <div class="flex-1"></div>

    <div class="flex items-center gap-2">
      <!-- Model selector -->
      <select
        value={hasAnyKeys ? selectedModel : undefined}
        onchange={(e) => {
          if (hasAnyKeys) {
            const index = e.currentTarget.selectedIndex
            selectedModel = availableModels[index]
          }
        }}
        disabled={!hasAnyKeys}
        class="h-10 w-36 rounded border border-gray-300 bg-gray-50 px-2 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:text-gray-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-gray-100 dark:disabled:text-gray-500"
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
        onclick={() => (webSearchEnabled = !webSearchEnabled)}
        class="flex size-10 items-center justify-center rounded border p-0 {webSearchEnabled
          ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
          : 'border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:bg-zinc-800 dark:text-gray-100 dark:hover:bg-zinc-700'}"
        title="Web Search"
        aria-pressed={webSearchEnabled}
      >
        <SearchIcon />
      </button>

      <!-- Reasoning Toggle Button -->
      <button
        onclick={() => (reasoningEnabled = !reasoningEnabled)}
        class="flex h-10 w-10 items-center justify-center rounded border p-0 {reasoningEnabled
          ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
          : 'border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:bg-zinc-800 dark:text-gray-100 dark:hover:bg-zinc-700'}"
        title="Reasoning"
        aria-pressed={reasoningEnabled}
      >
        <ThinkingIcon />
      </button>

      <button
        onclick={onSend}
        disabled={isLoading || !message.trim()}
        class="send-btn rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
      >
        Send
      </button>
    </div>
  </div>
</div>
