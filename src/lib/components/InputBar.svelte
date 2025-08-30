<script lang="ts">
  import type { Model } from '$lib/models';

  interface Props {
    message: string;
    isLoading: boolean;
    models: Model[];
    selectedModel: Model;
    webSearchEnabled: boolean;
    reasoningEnabled: boolean;
    sidebarOpen: boolean;
    onToggleSidebar: () => void;
    onSend: () => void;
  }

  let {
    message = $bindable(),
    isLoading,
    models,
    selectedModel = $bindable(),
    webSearchEnabled = $bindable(),
    reasoningEnabled = $bindable(),
    sidebarOpen,
    onToggleSidebar,
    onSend
  }: Props = $props();
</script>

<div class="relative z-20 border-t border-gray-300 bg-white p-3">
  <!-- Text input at top -->
  <div class="mb-2">
    <textarea
      bind:value={message}
      onkeydown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
      placeholder="Type your message..."
      class="w-full resize-none rounded border border-gray-300 px-3 py-2 text-sm"
      rows="2"
      disabled={isLoading}
    ></textarea>
  </div>

  <!-- Button row -->
  <div class="flex items-center gap-1">
    <button onclick={onToggleSidebar} class="rounded border border-gray-300 px-3 py-2 hover:bg-gray-50" aria-label="Toggle sidebar">
      {sidebarOpen ? '✕' : '☰'}
    </button>

    <div class="flex-1"></div>

    <div class="flex items-center gap-2">
      <!-- Model selector -->
      <select bind:value={selectedModel} class="w-36 rounded border border-gray-300 px-2 py-2 text-sm" aria-label="Select model">
        {#each models as model}
          <option value={model}>{model.id}</option>
        {/each}
      </select>

      <!-- Web Search Toggle Button -->
      <button
        onclick={() => (webSearchEnabled = !webSearchEnabled)}
        class="flex h-10 w-10 items-center justify-center rounded border p-0 text-base transition-colors {webSearchEnabled ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'}"
        title="Web Search"
        aria-pressed={webSearchEnabled}
      >
        🌐
      </button>

      <!-- Reasoning Toggle Button -->
      <button
        onclick={() => {
          if (selectedModel.provider !== 'google') {
            reasoningEnabled = !reasoningEnabled;
          }
        }}
        class="flex h-10 w-10 items-center justify-center rounded border p-0 text-base transition-colors {selectedModel.provider === 'google' ? 'border-blue-300 bg-blue-300 text-white' : reasoningEnabled ? 'border-blue-500 bg-blue-500 text-white hover:bg-blue-600' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'}"
        title={selectedModel.provider === 'google' ? 'Reasoning (always enabled for Gemini)' : 'Reasoning'}
        disabled={selectedModel.provider === 'google'}
        aria-pressed={selectedModel.provider === 'google' ? true : reasoningEnabled}
      >
        🤔
      </button>

      <button onclick={onSend} disabled={isLoading || !message.trim()} class="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400">
        {isLoading ? 'Sending...' : 'Send'}
      </button>
    </div>
  </div>
</div>
