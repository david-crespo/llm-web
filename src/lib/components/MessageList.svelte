<script lang="ts">
  import type { Chat } from '$lib/types'
  import type { Model } from '$lib/models'
  import ChatMessage from '$lib/ChatMessage.svelte'
  interface Props {
    currentChat: Chat | null
    isLoading: boolean
    selectedModel: Model
    hasApiKeys: boolean
    onRegen: (index: number) => void
    onFork: (index: number) => void
    onOpenAbout: () => void
  }

  let { currentChat, isLoading, selectedModel, hasApiKeys, onRegen, onFork, onOpenAbout }: Props =
    $props()
</script>

<div class="flex-1 overflow-x-hidden p-4">
  {#if currentChat && currentChat.messages.length > 0}
    {#each currentChat.messages as msg, index}
      <ChatMessage message={msg} messageIndex={index} {onRegen} {onFork} />
    {/each}
    {#if isLoading}
      <div class="mb-6" data-message>
        <div class="mb-2 flex items-center gap-2 text-xs text-gray-600">
          <span class="font-medium">{selectedModel.id}</span>
          <span>•</span>
          <span>Thinking...</span>
        </div>
        <div>
          <div class="mb-2 h-3.5 w-3/4 animate-pulse rounded bg-gray-200"></div>
          <div class="h-3.5 w-1/2 animate-pulse rounded bg-gray-200"></div>
        </div>
      </div>
    {/if}
  {:else}
    <div class="flex h-full items-center justify-center">
      <div class="flex max-w-xs flex-col gap-2 rounded-lg p-4 text-center">
        <p class="text-lg">Start a chat below</p>
        {#if !hasApiKeys}
          <p class="text-balance text-gray-700">
            Go to <a href="/settings" class="text-blue-600 underline hover:text-blue-800"
              >settings</a
            >
            to set an OpenAI, Anthropic, or Gemini API key. Keys are stored only in the browser.
          </p>
        {/if}
        <button onclick={onOpenAbout} class="text-sm text-blue-600 underline hover:text-blue-800"
          >About this app</button
        >
      </div>
    </div>
  {/if}
</div>
