<script lang="ts">
  import type { Chat, ChatMessage } from '$lib/types'
  import { chatState } from '$lib/chat.svelte'
  import { formatTime, formatMoney, formatTokens } from '$lib/format'
  import { DropdownMenu } from 'bits-ui'
  import CloseIcon from './icons/CloseIcon.svelte'
  import SunIcon from './icons/SunIcon.svelte'
  import MoonIcon from './icons/MoonIcon.svelte'
  import MonitorIcon from './icons/MonitorIcon.svelte'
  import PlusIcon from './icons/PlusIcon.svelte'
  import SettingsIcon from './icons/SettingsIcon.svelte'
  import InfoIcon from './icons/InfoIcon.svelte'

  interface Props {
    onRequestDelete: (id: number) => void
    onOpenAbout: () => void
  }

  let { onRequestDelete, onOpenAbout }: Props = $props()

  function getChatPreview(chat: Chat): string {
    const firstUserMessage = chat.messages.find((m) => m.role === 'user')
    if (!firstUserMessage) return 'New Chat'
    return firstUserMessage.content
  }

  function formatChatAsMarkdown(chat: Chat): string {
    const total = chat.messages.length
    return chat.messages
      .map((msg: ChatMessage, i: number) => {
        const num = i + 1
        const header = `# ${msg.role} (${num}/${total})`
        if (msg.role === 'user') {
          return `${header}\n\n${msg.content}`
        } else {
          const searches = msg.search ? ' | 🌐' : ''
          const meta = `\`${msg.model}\` | ${formatTime(msg.timeMs)} | ${formatMoney(msg.cost)} | ${formatTokens(msg.tokens)}${searches}`
          return `${header}\n${meta}\n\n${msg.content}`
        }
      })
      .join('\n\n---\n\n')
  }

  async function copyMarkdown(chat: Chat) {
    const markdown = formatChatAsMarkdown(chat)
    await navigator.clipboard.writeText(markdown)
  }

  import { getThemeMode, cycleThemeMode } from '$lib/theme.svelte'

  // Conditionally render desktop vs mobile sidebar to avoid creating
  // duplicate DOM (especially DropdownMenu portals) for the hidden variant
  let isDesktop = $state(false)
  $effect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    isDesktop = mq.matches
    const handler = (e: MediaQueryListEvent) => {
      isDesktop = e.matches
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  })
</script>

{#snippet sidebarContent(isDesktop: boolean)}
  <!-- Header -->
  <div class="flex items-center justify-between border-b border-edge py-3 pr-3 pl-3.5">
    <h3 class="text-md font-medium">History</h3>
  </div>

  <!-- Chat history -->
  <div class="flex-1 overflow-y-auto pt-2">
    {#if chatState.history.length === 0}
      <div class="p-4 text-sm text-fg-muted">No chats yet</div>
    {:else}
      {#each chatState.history as chat (chat.id)}
        {@const isActive = chat.id === chatState.current?.id}
        {@const preview = getChatPreview(chat)}
        <div
          role="button"
          tabindex="0"
          class="chat-row relative flex w-full border-b border-edge-muted py-3 pr-3 pl-3.5 focus:ring-2 focus:ring-gray-500 focus:outline-none focus:ring-inset {isActive
            ? 'bg-surface-active'
            : ''}"
          onclick={() => chatState.selectChat(chat.id!)}
          onkeydown={(e) =>
            (e.key === 'Enter' || e.key === ' ') && chatState.selectChat(chat.id!)}
        >
          <div class="min-w-0 pr-10">
            <div class="line-clamp-2 text-sm font-medium break-words">{preview}</div>
            <div class="mt-1 text-xs leading-4 text-fg-muted">
              {chat.createdAt.toLocaleString()}
            </div>
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              class="chat-kebab absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-2 text-lg font-bold hover:bg-surface-hover"
              aria-label="Chat menu"
              onclick={(e: MouseEvent) => e.stopPropagation()}
            >
              ⋮
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                class="z-50 w-40 rounded border border-edge bg-surface-elevated shadow-lg"
                sideOffset={4}
                align="end"
              >
                <DropdownMenu.Item
                  class="w-full cursor-pointer px-3 py-2 text-left text-sm outline-none hover:bg-surface-hover data-[highlighted]:bg-surface-hover"
                  onSelect={() => copyMarkdown(chat)}
                >
                  Copy as Markdown
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  class="w-full cursor-pointer px-3 py-2 text-left text-sm text-danger outline-none hover:bg-surface-hover data-[highlighted]:bg-surface-hover"
                  onSelect={() => onRequestDelete(chat.id!)}
                >
                  Delete
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Bottom section -->
  <div class="flex items-center justify-center gap-2 border-t border-edge p-3">
    {#if !isDesktop}
      <!-- Close button (mobile only) -->
      <button
        onclick={() => (chatState.sidebarOpen = false)}
        class="size-10 rounded border border-edge bg-surface-alt hover:bg-surface-hover"
        aria-label="Close sidebar"
      >
        <CloseIcon class="mx-auto" />
      </button>
      <div class="flex-1"></div>
    {/if}

    <div class="flex gap-2">
      <!-- About button -->
      <button
        onclick={onOpenAbout}
        class="flex size-10 items-center justify-center rounded border border-edge bg-surface-alt text-fg hover:bg-surface-hover"
        title="About"
        aria-label="About"
      >
        <InfoIcon />
      </button>
      <a
        href="/settings"
        class="flex size-10 items-center justify-center rounded border border-edge bg-surface-alt text-fg hover:bg-surface-hover"
        title="Settings"
        aria-label="Settings"
      >
        <SettingsIcon />
      </a>

      <!-- Theme toggle button -->
      <button
        class="flex size-10 items-center justify-center rounded border border-edge bg-surface-alt text-fg hover:bg-surface-hover"
        title="Cycle theme (Light / Dark / System)"
        aria-label="Cycle theme"
        onclick={() => cycleThemeMode()}
      >
        {#if getThemeMode() === 'light'}
          <SunIcon />
        {:else if getThemeMode() === 'dark'}
          <MoonIcon />
        {:else}
          <MonitorIcon />
        {/if}
      </button>

      <!-- New Chat button -->
      <button
        class="flex size-10 items-center justify-center rounded border border-edge bg-surface-alt text-fg hover:bg-surface-hover"
        title="New Chat"
        aria-label="New Chat"
        onclick={() => chatState.createNew()}
      >
        <PlusIcon />
      </button>
    </div>
  </div>
{/snippet}

{#if isDesktop}
  <!-- Desktop sidebar: always visible -->
  <div class="flex h-dvh w-64 flex-col border-r border-edge bg-surface-alt">
    {@render sidebarContent(true)}
  </div>
{:else}
  <!-- Mobile sidebar: always in DOM, animated with CSS transforms -->
  <!-- Scrim -->
  <div
    class="fixed inset-0 z-40 bg-black/20 transition-opacity duration-150
      {chatState.sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}"
    role="button"
    tabindex="0"
    aria-label="Close sidebar overlay"
    onclick={() => (chatState.sidebarOpen = false)}
    onkeydown={(e) => (e.key === 'Escape' || e.key === 'Enter') && (chatState.sidebarOpen = false)}
  ></div>

  <!-- Panel -->
  <div
    class="fixed top-0 left-0 z-50 flex w-4/5 max-w-sm flex-col overflow-hidden border-r border-edge bg-surface-alt transition-transform duration-150
      {chatState.sidebarOpen ? 'translate-x-0' : '-translate-x-full'}"
    style="height: 100dvh;"
  >
    {@render sidebarContent(false)}
  </div>
{/if}

<style>
  .chat-row:hover:not(:has(.chat-kebab:hover)) {
    background-color: var(--color-surface-hover);
  }

  .line-clamp-2 {
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
