<script lang="ts">
  import { storage, type ApiKeys } from '$lib/storage'
  import { models, getCost, systemBase } from '$lib/models'
  import { createMessage } from '$lib/adapters'
  import type { Chat, ChatMessage as ChatMessageType } from '$lib/types'
  import Sidebar from '$lib/components/Sidebar.svelte'
  import MessageList from '$lib/components/MessageList.svelte'
  import InputBar from '$lib/components/InputBar.svelte'
  import AboutModal from '$lib/components/AboutModal.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import { initTheme } from '$lib/theme'

  let sidebarOpen = $state(false)
  let message = $state('')
  let currentChat = $state<Chat | null>(null)
  let chatHistory = $state<(Chat & { id: number })[]>([])
  let selectedModel = $state(models.find((m) => m.default) || models[0])
  let isLoading = $state(false)
  let webSearchEnabled = $state(false)
  let reasoningEnabled = $state(false)
  let chatToDelete = $state<number | null>(null)
  let showAboutModal = $state(false)

  const openaiKey = localStorage.getItem('openai_api_key') || ''
  const anthropicKey = localStorage.getItem('anthropic_api_key') || ''
  const googleKey = localStorage.getItem('google_api_key') || ''
  const hasApiKeys = !!(openaiKey || anthropicKey || googleKey)

  // Handle regeneration from a specific message
  async function handleRegen(messageIndex: number) {
    if (!currentChat || isLoading) return

    // Find the user message to regenerate from
    const targetMessage = currentChat.messages[messageIndex]
    if (targetMessage.role !== 'user') return

    // Create a new chat with messages up to the specified index
    const messagesUpToIndex = currentChat.messages.slice(0, messageIndex + 1)
    const truncatedChat: Chat = {
      ...currentChat,
      messages: messagesUpToIndex,
    }

    // Remove all messages after the specified index
    currentChat.messages = messagesUpToIndex

    await sendMessageWithInput(truncatedChat, targetMessage.content)
  }

  // Handle forking from a specific message
  async function handleFork(messageIndex: number) {
    if (!currentChat) return

    // Find the message to fork from
    const targetMessage = currentChat.messages[messageIndex]
    if (targetMessage.role !== 'user') return

    // Save current chat if it exists and has messages
    if (currentChat.messages.length > 0) {
      if (currentChat.id) {
        await storage.updateChat(currentChat.id, currentChat)
      } else {
        const id = await storage.saveChat(currentChat)
        currentChat = { ...currentChat, id }
      }
    }

    // Create a new chat with messages up to the specified index
    const messagesUpToIndex = currentChat.messages.slice(0, messageIndex)
    const newChat: Chat = {
      createdAt: new Date(),
      systemPrompt: currentChat.systemPrompt,
      messages: messagesUpToIndex,
    }

    const id = await storage.saveChat(newChat)
    currentChat = { ...newChat, id }

    // Put the selected message content into the input field
    message = targetMessage.content

    await loadChatHistory()
  }

  // Initialize storage and load chat history
  async function init() {
    await storage.init()
    await loadChatHistory()

    // Check if there's an empty chat at the top of the stack to reuse
    if (chatHistory.length > 0 && chatHistory[0].messages.length === 0) {
      // Reuse the existing empty chat
      currentChat = chatHistory[0]
    } else {
      // Create new chat if none exist or top chat has messages
      await createNewChat()
    }
  }

  async function loadChatHistory() {
    chatHistory = await storage.getAllChats()
  }

  async function createNewChat() {
    // Save current chat if it exists and has messages
    if (currentChat && currentChat.messages.length > 0) {
      if (currentChat.id) {
        await storage.updateChat(currentChat.id, currentChat)
      } else {
        const id = await storage.saveChat(currentChat)
        currentChat = { ...currentChat, id }
      }
    }

    const newChat: Chat = {
      createdAt: new Date(),
      systemPrompt: systemBase,
      messages: [],
    }

    const id = await storage.saveChat(newChat)
    currentChat = { ...newChat, id }
    await loadChatHistory()

    // Close the sidebar when creating a new chat
    sidebarOpen = false

    // Message list auto-scrolls itself
  }

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen
  }

  // Helper function to send a message and handle response
  async function sendMessageWithInput(chat: Chat, input: string) {
    isLoading = true

    try {
      const startTime = performance.now()

      const response = await createMessage(selectedModel.provider, {
        chat,
        input,
        model: selectedModel,
        search: webSearchEnabled,
        think: reasoningEnabled,
      })

      const timeMs = performance.now() - startTime
      const cost = getCost(selectedModel, response.tokens)

      const assistantMessage: ChatMessageType = {
        role: 'assistant',
        model: selectedModel.id,
        content: response.content,
        reasoning: response.reasoning,
        tokens: response.tokens,
        stop_reason: response.stop_reason,
        cost,
        timeMs,
      }

      chat.messages.push(assistantMessage)

      // Save updated chat
      if (chat.id) {
        await storage.updateChat(chat.id, chat)
      } else {
        const id = await storage.saveChat(chat)
        currentChat = { ...chat, id }
      }

      await loadChatHistory()
    } catch (error) {
      console.error('Error sending message:', error)
      // Add error message to chat
      const errorMessage: ChatMessageType = {
        role: 'assistant',
        model: selectedModel.id,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        tokens: { input: 0, output: 0 },
        stop_reason: 'error',
        cost: 0,
        timeMs: 0,
      }
      chat.messages.push(errorMessage)
    } finally {
      isLoading = false
    }
  }

  async function sendMessage() {
    if (!message.trim() || !currentChat || isLoading) return

    const userMessage: ChatMessageType = {
      role: 'user',
      content: message.trim(),
    }

    currentChat.messages.push(userMessage)
    const input = message
    message = ''

    // Message list auto-scrolls itself

    await sendMessageWithInput(currentChat, input)
  }

  async function selectChat(chatId: number) {
    const chat = chatHistory.find((c) => c.id === chatId)
    if (chat) {
      currentChat = chat

      // Close the sidebar
      sidebarOpen = false

      // Set model picker to the model from the last assistant message
      const lastAssistantMessage = chat.messages
        .slice()
        .reverse()
        .find((msg) => msg.role === 'assistant')
      if (lastAssistantMessage) {
        selectedModel = models.find((m) => m.id === lastAssistantMessage.model) || selectedModel
      }
      // Message list auto-scrolls itself
    }
  }

  async function deleteChat(chatId: number) {
    await storage.deleteChat(chatId)
    await loadChatHistory()

    // If we deleted the current chat, select another one or create new
    if (currentChat?.id === chatId) {
      if (chatHistory.length > 0) {
        currentChat = chatHistory[0]
      } else {
        await createNewChat()
      }
    }
  }

  // Handle Gemini reasoning (always enabled)
  $effect(() => {
    if (selectedModel.provider === 'google') {
      reasoningEnabled = true
    }
  })

  // Get excerpt of first user message for chat preview (two lines)
  function getChatPreview(chat: Chat): { line1: string; line2: string } {
    const firstUserMessage = chat.messages.find((msg) => msg.role === 'user')
    if (firstUserMessage) {
      const content = firstUserMessage.content
      const words = content.split(' ')
      let line1 = ''
      let line2 = ''

      // Build first line (up to ~40 chars or 6 words)
      let charCount = 0
      let wordIndex = 0
      while (wordIndex < words.length && charCount < 40 && wordIndex < 6) {
        const word = words[wordIndex]
        if (charCount + word.length + 1 > 40) break
        line1 += (line1 ? ' ' : '') + word
        charCount += word.length + 1
        wordIndex++
      }

      // Build second line with remaining content
      if (wordIndex < words.length) {
        line2 = words.slice(wordIndex).join(' ')
        // Truncate second line if too long
        if (line2.length > 40) {
          line2 = line2.slice(0, 37) + '...'
        }
      }

      return { line1: line1 || content.slice(0, 40), line2 }
    }
    return { line1: 'New Chat', line2: '' }
  }

  // Initialize on mount
  init()
  // Initialize theme early so it's applied regardless of sidebar state
  initTheme()
</script>

<div class="flex {sidebarOpen ? 'overflow-hidden' : ''}" style="height: 100vh; height: 100dvh;">
  <Sidebar
    open={sidebarOpen}
    {chatHistory}
    currentChatId={currentChat?.id}
    onClose={toggleSidebar}
    onNewChat={createNewChat}
    onSelectChat={selectChat}
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
        await deleteChat(chatToDelete)
        chatToDelete = null
      }
    }}
  />

  <AboutModal open={showAboutModal} onClose={() => (showAboutModal = false)} />

  <!-- Main chat area -->
  <div class="flex flex-1 flex-col overflow-x-hidden">
    <MessageList
      {currentChat}
      {isLoading}
      {selectedModel}
      {hasApiKeys}
      onRegen={handleRegen}
      onFork={handleFork}
      onOpenAbout={() => (showAboutModal = true)}
    />

    <InputBar
      bind:message
      {isLoading}
      {models}
      bind:selectedModel
      bind:webSearchEnabled
      bind:reasoningEnabled
      {sidebarOpen}
      onToggleSidebar={toggleSidebar}
      onSend={sendMessage}
    />
  </div>
</div>
