import { SvelteDate, SvelteMap } from 'svelte/reactivity'
import { storage } from '$lib/storage'
import { models, getCost, systemBase, getAvailableModels, type Model } from '$lib/models.svelte'
import { createMessage } from '$lib/adapters'
import { scrollToBottom } from '$lib/actions/autoScroll'
import type { Chat, NewChat, ChatMessage } from '$lib/types'

/**
 * ChatManager: Centralized state management for chat functionality
 *
 * This class uses Svelte 5 runes ($state, $effect) to manage reactive state
 * and business logic, separating concerns from the UI layer.
 *
 * Key patterns:
 * - $state() creates reactive state that triggers UI updates
 * - Class properties with $state are automatically reactive
 * - Methods can be called directly from components
 * - Effects ($effect) run when dependencies change
 */
export class ChatManager {
  // UI State
  sidebarOpen = $state(false)

  // Initialization state
  initError = $state<string | null>(null)

  // Chat Data
  current = $state<Chat | null>(null)
  history = $state<Chat[]>([])

  // Settings
  selectedModel = $state<Model | undefined>(getAvailableModels().at(0))
  webSearch = $state(true)
  reasoning = $state(false)

  // Per-chat in-flight requests so switching chats doesn't block, cancel, or mis-attribute replies.
  private pendingRequests = new SvelteMap<number, AbortController>()

  get isCurrentLoading(): boolean {
    return this.current != null && this.pendingRequests.has(this.current.id)
  }

  /** True when the last message is an error/stopped response — the user should regen or fork, not send a new message. */
  get lastMessageIsError(): boolean {
    const last = this.current?.messages.at(-1)
    return (
      last?.role === 'assistant' && ['stopped', 'interrupted', 'error'].includes(last.stop_reason)
    )
  }

  constructor() {
    // Automatically initialize when created
    this.init()
  }

  /**
   * Initialize storage and load initial chat
   */
  async init() {
    this.initError = null

    try {
      await storage.init()
      await this.loadHistory()

      // Reuse existing empty chat or create new one
      if (this.history.length > 0 && this.history[0].messages.length === 0) {
        this.current = this.history[0]
      } else {
        await this.createNew()
      }
    } catch (error) {
      console.error('Failed to initialize chat storage:', error)
      this.initError = error instanceof Error ? error.message : 'Failed to initialize storage'
    }
  }

  /**
   * Reload chat history from storage
   */
  async loadHistory() {
    this.history = await storage.getAllChats()
  }

  /**
   * Create a new chat, saving the current one if needed
   */
  async createNew() {
    await this.saveCurrentIfDirty()

    const newChat: NewChat = {
      createdAt: new SvelteDate(),
      systemPrompt: systemBase,
      messages: [],
    }

    const id = await storage.createChat(newChat)
    this.current = { ...newChat, id }
    await this.loadHistory()
    this.sidebarOpen = false
  }

  /**
   * Switch to a different chat by ID
   */
  async selectChat(id: number) {
    const chat = this.history.find((c) => c.id === id)
    if (!chat) return

    this.current = chat
    this.sidebarOpen = false

    // Auto-select model from last assistant message
    const lastAssistant = chat.messages
      .slice()
      .reverse()
      .find((m) => m.role === 'assistant')

    if (lastAssistant) {
      const found = models.find((m) => m.id === lastAssistant.model)
      if (found) this.selectedModel = found
    }
  }

  /**
   * Delete a chat by ID
   */
  async deleteChat(id: number) {
    await storage.deleteChat(id)
    await this.loadHistory()

    // If we deleted the current chat, switch to another or create new
    if (this.current?.id === id) {
      if (this.history.length > 0) {
        this.current = this.history[0]
      } else {
        await this.createNew()
      }
    }
  }

  /**
   * Send a user message and get AI response
   */
  async sendMessage(content: string) {
    if (!content.trim() || !this.current || this.isCurrentLoading || this.lastMessageIsError) return

    // Capture before any await: the user can switch chats while the request is in-flight.
    const chat = this.current

    const userMessage: ChatMessage = {
      role: 'user',
      content: content.trim(),
    }

    chat.messages.push(userMessage)
    scrollToBottom()

    // Save immediately so the question is preserved even if the request is interrupted
    await this.saveCurrentIfDirty()

    await this.processResponse(chat, content.trim())
  }

  /**
   * Regenerate response from a specific message index
   */
  async regenerate(index: number) {
    if (!this.current || this.isCurrentLoading) return

    const chat = this.current
    const targetMessage = chat.messages[index]
    if (targetMessage.role !== 'user') return

    // Truncate messages after this point
    chat.messages = chat.messages.slice(0, index + 1)

    await this.processResponse(chat, targetMessage.content)
  }

  /**
   * Fork a new chat from a specific message index
   * Returns the content of the forked message
   */
  async fork(index: number): Promise<string | null> {
    if (!this.current) return null

    const targetMessage = this.current.messages[index]
    if (targetMessage.role !== 'user') return null

    // Save current chat first
    await this.saveCurrentIfDirty()

    // Create new chat with messages up to the fork point
    const messages = this.current.messages.slice(0, index)
    const newChat: NewChat = {
      createdAt: new SvelteDate(),
      systemPrompt: this.current.systemPrompt,
      messages,
    }

    const id = await storage.createChat(newChat)
    this.current = { ...newChat, id }
    await this.loadHistory()

    // Return the message content to populate input field
    return targetMessage.content
  }

  /**
   * Process AI response for a given input.
   * Operates on the specific `chat` reference so it remains correct even if
   * the user switches to a different chat while the request is in-flight.
   */
  private async processResponse(chat: Chat, input: string) {
    if (!this.selectedModel) return
    const chatId = chat.id
    const model = this.selectedModel
    const search = this.webSearch

    // Abort any prior request for this same chat
    this.pendingRequests.get(chatId)?.abort('replaced')
    const controller = new AbortController()
    this.pendingRequests.set(chatId, controller)

    // Prevent iOS from suspending the page while the request is in-flight
    let wakeLock: WakeLockSentinel | null = null
    try {
      wakeLock = await navigator.wakeLock?.request('screen')
    } catch {
      // Wake Lock not supported or failed (e.g. low battery) — proceed without it
    }

    try {
      const startTime = performance.now()

      const response = await createMessage(model.provider, {
        chat,
        input,
        model,
        search,
        think: this.reasoning,
        signal: controller.signal,
      })

      // Ignore stale results: only the most recent request for this chat is allowed to append.
      if (this.pendingRequests.get(chatId) !== controller) return

      const timeMs = performance.now() - startTime
      const cost = getCost(model, response.tokens, response.searches)

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        model: model.id,
        content: response.content,
        reasoning: response.reasoning,
        search,
        tokens: response.tokens,
        stop_reason: response.stop_reason,
        cost,
        timeMs,
      }

      chat.messages.push(assistantMessage)
      // Don't yank the viewport if the user is viewing a different chat.
      if (this.current?.id === chatId) scrollToBottom()

      await storage.updateChat(chatId, chat)
      await this.loadHistory()
    } catch (error) {
      // Stale error from a replaced request — ignore silently
      if (this.pendingRequests.get(chatId) !== controller) return

      const reason = controller.signal.reason as string | undefined
      if (reason === 'replaced') return

      console.error('Error sending message:', error)

      const isAbort =
        controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')
      const wasUserStopped = reason === 'user_stopped'

      let errorContent: string
      let stopReason: string
      if (wasUserStopped) {
        errorContent = 'Stopped by user'
        stopReason = 'stopped'
      } else if (isAbort) {
        errorContent = 'Request interrupted (connection lost or tab backgrounded)'
        stopReason = 'interrupted'
      } else {
        errorContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        stopReason = 'error'
      }

      const errorMessage: ChatMessage = {
        role: 'assistant',
        model: model.id,
        content: errorContent,
        tokens: { input: 0, output: 0 },
        stop_reason: stopReason,
        cost: 0,
        timeMs: 0,
      }

      chat.messages.push(errorMessage)
      if (this.current?.id === chatId) scrollToBottom()

      await storage.updateChat(chatId, chat)
      await this.loadHistory()
    } finally {
      wakeLock?.release()
      // Only clean up if we're still the active request for this chat
      if (this.pendingRequests.get(chatId) === controller) {
        this.pendingRequests.delete(chatId)
      }
    }
  }

  /**
   * Stop the in-flight request for the current chat
   */
  stop() {
    if (this.current) {
      this.pendingRequests.get(this.current.id)?.abort('user_stopped')
    }
  }

  /**
   * Save current chat if it has messages
   */
  private async saveCurrentIfDirty() {
    if (!this.current || this.current.messages.length === 0) return
    await storage.updateChat(this.current.id, this.current)
  }
}

/**
 * Singleton instance exported for use across components
 * This pattern ensures a single source of truth for chat state
 */
export const chatState = new ChatManager()
