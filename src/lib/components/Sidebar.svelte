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

  function getChatPreview(chat: Chat): string {
    const firstUserMessage = chat.messages.find((m) => m.role === 'user');
    if (!firstUserMessage) return 'New Chat';
    return firstUserMessage.content;
  }

  // Theme toggle (Light / Dark / System)
  import { initTheme, getThemeMode, cycleThemeMode, themeLabel } from '$lib/theme';
  type ThemeMode = import('$lib/theme').ThemeMode;
  let themeMode: ThemeMode = $state('system');

  $effect(() => {
    initTheme();
    themeMode = getThemeMode();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ mode: ThemeMode }>).detail;
      if (detail?.mode) themeMode = detail.mode;
    };
    window.addEventListener('theme-change', onChange as EventListener);
    return () => window.removeEventListener('theme-change', onChange as EventListener);
  });

  function onCycleTheme() {
    themeMode = cycleThemeMode();
  }
</script>
<style>
  .line-clamp-2 {
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>

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
      <button onclick={onNewChat} class="w-full rounded-lg bg-gray-200 px-4 py-3 text-center font-medium hover:bg-gray-300 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none">
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
          <div class="mb-2">
            <div
              role="button"
              tabindex="0"
              class="relative flex w-full rounded border px-3 py-2 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 {isActive ? 'border-gray-500 bg-gray-100' : 'border-gray-300'}"
              onclick={() => onSelectChat(chat.id!)}
              onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectChat(chat.id!)}
            >
              <div class="min-w-0 pr-10">
                <div class="text-sm font-medium break-words line-clamp-2">{preview}</div>
                <div class="mt-1 text-xs leading-4 text-gray-500">{chat.createdAt.toLocaleString()}</div>
              </div>
              <button
                class="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-2 text-xs hover:bg-gray-100"
                aria-label="Delete chat"
                onclick={(e) => { e.stopPropagation(); onRequestDelete(chat.id!); }}
              >
                🗑
              </button>
            </div>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Bottom section -->
    <div class="space-y-3 border-t border-gray-300 p-4">
      <a href="/settings" class="block text-sm text-blue-600 hover:text-blue-800">Configure API Keys</a>
      <button onclick={onOpenAbout} class="block w-full text-left text-sm text-blue-600 hover:text-blue-800">About</button>
    </div>

    <!-- Theme toggle button, bottom-right of sidebar -->
    <button
      class="absolute bottom-4 right-4 flex size-10 items-center justify-center rounded border border-gray-300 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
      title="Cycle theme (Light / Dark / System)"
      aria-label="Cycle theme"
      onclick={onCycleTheme}
    >
      {themeLabel(themeMode)}
    </button>
  </div>
{/if}
