<script lang="ts">
  import { models, type Model } from '$lib/models'

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
</script>

<div class="fixed right-0 bottom-0 left-0 z-20 max-w-full border-t border-gray-300 bg-gray-50 p-3">
  <!-- Text input at top -->
  <div class="mb-2">
    <textarea
      bind:value={message}
      oninput={function (e) {
        // Resize on input up to 200px high
        const target = e.target
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
      class="size-10 rounded border border-gray-300 hover:bg-gray-50"
      aria-label="Toggle sidebar"
    >
      {sidebarOpen ? '✕' : '☰'}
    </button>

    <div class="flex-1"></div>

    <div class="flex items-center gap-2">
      <!-- Model selector -->
      <select
        bind:value={selectedModel}
        class="h-10 w-36 rounded border border-gray-300 px-2 py-2 text-sm"
        aria-label="Select model"
      >
        {#each models as model}
          <option value={model}>{model.id}</option>
        {/each}
      </select>

      <!-- Web Search Toggle Button -->
      <button
        onclick={() => (webSearchEnabled = !webSearchEnabled)}
        class="flex size-10 items-center justify-center rounded border p-0 text-base {webSearchEnabled
          ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
          : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'}"
        title="Web Search"
        aria-pressed={webSearchEnabled}
      >
        🌐
      </button>

      <!-- Reasoning Toggle Button -->
      <button
        onclick={() => {
          if (selectedModel.provider !== 'google') {
            reasoningEnabled = !reasoningEnabled
          }
        }}
        class="flex h-10 w-10 items-center justify-center rounded border p-0 text-base {selectedModel.provider ===
        'google'
          ? 'border-blue-300 bg-blue-300 text-white'
          : reasoningEnabled
            ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600'
            : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'}"
        title={selectedModel.provider === 'google'
          ? 'Reasoning (always enabled for Gemini)'
          : 'Reasoning'}
        disabled={selectedModel.provider === 'google'}
        aria-pressed={selectedModel.provider === 'google' ? true : reasoningEnabled}
      >
        🤔
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
