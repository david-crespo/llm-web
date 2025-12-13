<script lang="ts">
  import Sidebar from '$lib/components/Sidebar.svelte'
  import MessageList from '$lib/components/MessageList.svelte'
  import InputBar from '$lib/components/InputBar.svelte'
  import AboutModal from '$lib/components/AboutModal.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import { initTheme } from '$lib/theme'
  import { chatState } from '$lib/chat.svelte'

  // Local UI state (not managed by ChatManager)
  let message = $state('')
  let chatToDelete = $state<number | null>(null)
  let showAboutModal = $state(false)

  /**
   * Send message handler - clears input and delegates to ChatManager
   */
  async function handleSend() {
    const content = message
    message = '' // Clear input immediately for better UX
    await chatState.sendMessage(content)
  }

  /**
   * Fork handler - populates input with forked message content
   */
  async function handleFork(index: number) {
    const content = await chatState.fork(index)
    if (content) {
      message = content
    }
  }

  // Initialize theme on mount
  initTheme()
</script>

{#if chatState.initError}
  <div class="flex h-dvh items-center justify-center p-4">
    <div class="max-w-md space-y-4 text-center">
      <h1 class="text-lg font-medium text-danger">Failed to load</h1>
      <p class="text-sm text-fg-muted">{chatState.initError}</p>
      <p class="text-sm text-fg-muted">
        This can happen in private browsing mode or if storage is unavailable.
      </p>
      <button
        class="rounded bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
        onclick={() => chatState.init()}
      >
        Retry
      </button>
    </div>
  </div>
{:else}
  <div class="flex h-dvh overflow-x-hidden overflow-y-hidden">
    <Sidebar
      onRequestDelete={(id) => (chatToDelete = id)}
      onOpenAbout={() => (showAboutModal = true)}
    />

    <ConfirmDialog
      open={chatToDelete !== null}
      title="Delete Chat"
      message="Are you sure you want to delete this chat? This action cannot be undone."
      cancelLabel="Cancel"
      confirmLabel="Delete"
      onCancel={() => (chatToDelete = null)}
      onConfirm={async () => {
        if (chatToDelete !== null) {
          await chatState.deleteChat(chatToDelete)
          chatToDelete = null
        }
      }}
    />

    <AboutModal open={showAboutModal} onClose={() => (showAboutModal = false)} />

    <div class="flex min-w-0 flex-1 flex-col">
      <MessageList onFork={handleFork} onOpenAbout={() => (showAboutModal = true)} />

      <InputBar bind:message onSend={handleSend} />
    </div>
  </div>
{/if}
