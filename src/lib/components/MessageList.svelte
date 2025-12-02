<script lang="ts">
  import ChatMessage from '$lib/ChatMessage.svelte'
  import { chatState } from '$lib/chat.svelte'
  import { getAvailableModels } from '$lib/models.svelte'

  interface Props {
    onFork: (index: number) => void
    onOpenAbout: () => void
  }

  let { onFork, onOpenAbout }: Props = $props()
  const hasApiKeys = getAvailableModels().length > 0
</script>

<div class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
  {#if chatState.current && chatState.current.messages.length > 0}
    {#each chatState.current.messages as msg, index (index)}
      <ChatMessage
        message={msg}
        messageIndex={index}
        onRegen={(i) => chatState.regenerate(i)}
        {onFork}
      />
    {/each}
    {#if chatState.isLoading}
      <div class="mb-6" data-message>
        <div class="mb-2 flex items-center gap-2 text-xs text-fg-muted">
          <span class="font-medium">{chatState.selectedModel?.id || 'Unknown model'}</span>
          <span>•</span>
          <span>Thinking...</span>
        </div>
        <div>
          <div class="mb-2 h-3.5 w-3/4 animate-pulse rounded bg-edge"></div>
          <div class="h-3.5 w-1/2 animate-pulse rounded bg-edge"></div>
        </div>
      </div>
    {/if}
  {:else}
    <div class="flex h-full items-center justify-center">
      <div class="flex max-w-xs flex-col gap-2 rounded-lg p-4 text-center">
        <p class="text-lg">Start a chat below</p>
        {#if !hasApiKeys}
          <p class="text-balance text-fg-muted">
            Go to <a href="/settings" class="text-link underline hover:text-link-hover">settings</a>
            to set an OpenAI, Anthropic, or Gemini API key. Keys are stored only in the browser.
          </p>
        {/if}
        <button onclick={onOpenAbout} class="text-sm text-link underline hover:text-link-hover"
          >About this app</button
        >
      </div>
    </div>
  {/if}
</div>
