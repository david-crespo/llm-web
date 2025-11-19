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

  // Check for API keys (view-specific concern)
  const openaiKey = localStorage.getItem('openai_api_key') || ''
  const anthropicKey = localStorage.getItem('anthropic_api_key') || ''
  const googleKey = localStorage.getItem('google_api_key') || ''
  const hasApiKeys = !!(openaiKey || anthropicKey || googleKey)

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

  // Effect: Force reasoning on for Google models
  $effect(() => {
    if (chatState.selectedModel.provider === 'google') {
      chatState.reasoning = true
    }
  })
</script>

<div class="flex min-h-screen overflow-x-hidden {chatState.sidebarOpen ? 'overflow-y-hidden' : ''}">
  <Sidebar
    open={chatState.sidebarOpen}
    chatHistory={chatState.history}
    currentChatId={chatState.current?.id}
    onClose={() => (chatState.sidebarOpen = false)}
    onNewChat={() => chatState.createNew()}
    onSelectChat={(id) => chatState.selectChat(id)}
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

  <div class="min-w-0 flex-1">
    <MessageList
      currentChat={chatState.current}
      isLoading={chatState.isLoading}
      selectedModel={chatState.selectedModel}
      {hasApiKeys}
      onRegen={(i) => chatState.regenerate(i)}
      onFork={handleFork}
      onOpenAbout={() => (showAboutModal = true)}
    />
  </div>
</div>

<InputBar
  bind:message
  isLoading={chatState.isLoading}
  bind:selectedModel={chatState.selectedModel}
  bind:webSearchEnabled={chatState.webSearch}
  bind:reasoningEnabled={chatState.reasoning}
  sidebarOpen={chatState.sidebarOpen}
  onToggleSidebar={() => (chatState.sidebarOpen = !chatState.sidebarOpen)}
  onSend={handleSend}
/>
