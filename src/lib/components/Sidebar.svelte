<script lang="ts">
  import type { Chat } from '$lib/types';

  interface Props {
    open: boolean;
    chatHistory: (Chat & { id: number })[];
    currentChatId?: number;
    onClose: () => void;
    onNewChat: () => void | Promise<void>;
    onSelectChat: (id: number) => void | Promise<void>;
    onRequestDelete: (id: number) => void;
    onOpenAbout: () => void;
  }

  let {
    open,
    chatHistory,
    currentChatId,
    onClose,
    onNewChat,
    onSelectChat,
    onRequestDelete,
    onOpenAbout
  }: Props = $props();

  function getChatPreview(chat: Chat): { line1: string; line2: string } {
    const firstUserMessage = chat.messages.find((m) => m.role === 'user');
    if (!firstUserMessage) return { line1: 'New Chat', line2: '' };
    const content = firstUserMessage.content;
    const words = content.split(' ');
    let line1 = '';
    let line2 = '';
    let charCount = 0;
    let wordIndex = 0;
    while (wordIndex < words.length && charCount < 40 && wordIndex < 6) {
      const word = words[wordIndex];
      if (charCount + word.length + 1 > 40) break;
      line1 += (line1 ? ' ' : '') + word;
      charCount += word.length + 1;
      wordIndex++;
    }
    if (wordIndex < words.length) {
      line2 = words.slice(wordIndex).join(' ');
      if (line2.length > 40) line2 = line2.slice(0, 37) + '...';
    }
    return { line1: line1 || content.slice(0, 40), line2 };
  }
</script>

{#if open}
  <!-- Scrim -->
  <div
    class="fixed inset-0 z-40 bg-black/20"
    role="button"
    tabindex="0"
    aria-label="Close sidebar overlay"
    onclick={onClose}
    onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && onClose()}
  ></div>

  <!-- Panel -->
  <div class="fixed top-0 left-0 z-50 flex w-4/5 flex-col overflow-hidden bg-gray-50" style="height: 100vh; height: 100dvh;">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-gray-300 p-4">
      <h3 class="text-sm font-medium">Chat History</h3>
      <button onclick={onClose} class="text-gray-500 hover:text-gray-700" aria-label="Close sidebar">✕</button>
    </div>

    <!-- New Chat button -->
    <div class="p-4">
      <button onclick={onNewChat} class="w-full rounded-lg bg-gray-200 px-4 py-3 text-center font-medium transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none">
        + New Chat
      </button>
    </div>

    <!-- Chat history -->
    <div class="flex-1 overflow-y-auto px-4 pb-4">
      {#if chatHistory.length === 0}
        <div class="p-4 text-sm text-gray-600">No chats yet</div>
      {:else}
        {#each chatHistory as chat}
          {@const isActive = chat.id === currentChatId}
          {@const preview = getChatPreview(chat)}
          <div class="mb-2 flex items-center gap-2">
            <button
              class="flex-1 rounded border px-3 py-2 text-left hover:bg-gray-50 {isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}"
              onclick={() => onSelectChat(chat.id!)}
            >
              <div class="flex items-center justify-between">
                <div class="text-xs text-gray-500">{chat.createdAt.toLocaleString()}</div>
              </div>
              <div class="truncate text-sm font-medium">{preview.line1}</div>
              {#if preview.line2}
                <div class="truncate text-xs text-gray-600">{preview.line2}</div>
              {/if}
            </button>
            <button
              class="rounded border border-gray-300 px-2 py-2 text-xs hover:bg-gray-50"
              aria-label="Delete chat"
              onclick={() => onRequestDelete(chat.id!)}
            >
              🗑
            </button>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Bottom section -->
    <div class="space-y-3 border-t border-gray-300 p-4">
      <a href="/settings" class="block text-sm text-blue-600 hover:text-blue-800">Configure API Keys</a>
      <button onclick={onOpenAbout} class="block w-full text-left text-sm text-blue-600 hover:text-blue-800">About</button>
    </div>
  </div>
{/if}
