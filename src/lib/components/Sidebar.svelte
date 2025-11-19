<script lang="ts">
  import type { Chat } from '$lib/types'
  import { fly, fade } from 'svelte/transition'
  import CloseIcon from './icons/CloseIcon.svelte'
  import SunIcon from './icons/SunIcon.svelte'
  import MoonIcon from './icons/MoonIcon.svelte'
  import MonitorIcon from './icons/MonitorIcon.svelte'
  import PlusIcon from './icons/PlusIcon.svelte'
  import SettingsIcon from './icons/SettingsIcon.svelte'
  import InfoIcon from './icons/InfoIcon.svelte'

  interface Props {
    open: boolean
    chatHistory: (Chat & { id: number })[]
    currentChatId?: number
    onClose: () => void
    onNewChat: () => void | Promise<void>
    onSelectChat: (id: number) => void | Promise<void>
    onRequestDelete: (id: number) => void
    onOpenAbout: () => void
  }

  let {
    open,
    chatHistory,
    currentChatId,
    onClose,
    onNewChat,
    onSelectChat,
    onRequestDelete,
    onOpenAbout,
  }: Props = $props()

  function getChatPreview(chat: Chat): string {
    const firstUserMessage = chat.messages.find((m) => m.role === 'user')
    if (!firstUserMessage) return 'New Chat'
    return firstUserMessage.content
  }

  // Theme toggle (Light / Dark / System)
  import { initTheme, getThemeMode, cycleThemeMode } from '$lib/theme'
  type ThemeMode = import('$lib/theme').ThemeMode
  let themeMode: ThemeMode = $state('system')

  $effect(() => {
    initTheme()
    themeMode = getThemeMode()
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ mode: ThemeMode }>).detail
      if (detail?.mode) themeMode = detail.mode
    }
    window.addEventListener('theme-change', onChange as EventListener)
    return () => window.removeEventListener('theme-change', onChange as EventListener)
  })

  function onCycleTheme() {
    themeMode = cycleThemeMode()
  }
</script>

{#if open}
  <!-- Scrim -->
  <div
    transition:fade|local={{ duration: 150 }}
    class="fixed inset-0 z-40 bg-black/20"
    role="button"
    tabindex="0"
    aria-label="Close sidebar overlay"
    onclick={onClose}
    onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && onClose()}
  ></div>

  <!-- Panel -->
  <div
    transition:fly|local={{ x: -320, duration: 150 }}
    class="fixed top-0 left-0 z-50 flex w-4/5 max-w-sm flex-col overflow-hidden border-r border-gray-400/60 bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900"
    style="height: 100dvh; will-change: transform;"
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-gray-300 p-3">
      <h3 class="text-sm font-medium">Chat History</h3>
    </div>

    <!-- Chat history -->
    <div class="flex-1 overflow-y-auto pt-2">
      {#if chatHistory.length === 0}
        <div class="p-4 text-sm text-gray-600">No chats yet</div>
      {:else}
        {#each chatHistory as chat (chat.id)}
          {@const isActive = chat.id === currentChatId}
          {@const preview = getChatPreview(chat)}
          <div
            role="button"
            tabindex="0"
            class="relative flex w-full border-b border-gray-200 py-3 pr-3 pl-3.5 hover:bg-gray-100 focus:ring-2 focus:ring-gray-500 focus:outline-none focus:ring-inset dark:border-white/5 dark:hover:!bg-zinc-700 {isActive
              ? 'bg-blue-100 dark:!bg-zinc-700'
              : ''}"
            onclick={() => onSelectChat(chat.id!)}
            onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectChat(chat.id!)}
          >
            <div class="min-w-0 pr-10">
              <div class="line-clamp-2 text-sm font-medium break-words">{preview}</div>
              <div class="mt-1 text-xs leading-4 text-gray-500">
                {chat.createdAt.toLocaleString()}
              </div>
            </div>
            <button
              class="absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-2 text-xs hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Delete chat"
              onclick={(e) => {
                e.stopPropagation()
                onRequestDelete(chat.id!)
              }}
            >
              🗑
            </button>
          </div>
        {/each}
      {/if}
    </div>

    <!-- Bottom section -->
    <div class="flex items-center gap-4 border-t border-gray-300 p-3">
      <!-- Close button (left) -->
      <button
        onclick={onClose}
        class="size-10 rounded border border-gray-300 bg-gray-50 hover:bg-gray-100 dark:border-gray-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        aria-label="Close sidebar"
      >
        <CloseIcon class="mx-auto" />
      </button>

      <div class="flex-1"></div>

      <!-- Settings button -->
      <div class="flex gap-2">
        <!-- About button -->
        <button
          onclick={onOpenAbout}
          class="flex size-10 items-center justify-center rounded border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-zinc-800 dark:text-gray-100 dark:hover:bg-zinc-700"
          title="About"
          aria-label="About"
        >
          <InfoIcon />
        </button>
        <a
          href="/settings"
          class="flex size-10 items-center justify-center rounded border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-zinc-800 dark:text-gray-100 dark:hover:bg-zinc-700"
          title="Settings"
          aria-label="Settings"
        >
          <SettingsIcon />
        </a>

        <!-- Theme toggle button -->
        <button
          class="flex size-10 items-center justify-center rounded border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-zinc-800 dark:text-gray-100 dark:hover:bg-zinc-700"
          title="Cycle theme (Light / Dark / System)"
          aria-label="Cycle theme"
          onclick={onCycleTheme}
        >
          {#if themeMode === 'light'}
            <SunIcon />
          {:else if themeMode === 'dark'}
            <MoonIcon />
          {:else}
            <MonitorIcon />
          {/if}
        </button>

        <!-- New Chat button -->
        <button
          class="flex size-10 items-center justify-center rounded border border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-zinc-800 dark:text-gray-100 dark:hover:bg-zinc-700"
          title="New Chat"
          aria-label="New Chat"
          onclick={onNewChat}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
