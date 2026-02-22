import { SvelteDate, SvelteMap } from 'svelte/reactivity'
import { storage } from '$lib/storage'
import { models, getCost, systemBase, getAvailableModels, type Model } from '$lib/models.svelte'
import { createMessage } from '$lib/adapters'
import { scrollToBottom } from '$lib/actions/autoScroll'
import type { Chat, NewChat, ChatMessage } from '$lib/types'

// --- App init state (checked by the page component to gate rendering) ---

type BootState =
  | { status: 'loading'; error?: undefined }
  | { status: 'error'; error: string }
  | { status: 'ready'; error?: undefined }

let _boot = $state<BootState>({ status: 'loading' })

// Exported as a getter object because Svelte doesn't allow direct $state exports.
// bootState is the reactive signal that gates page rendering; chatState below is
// assigned before bootState flips to 'ready' and is only accessed by components
// rendered inside that gate. After mount, reactivity comes from ChatManager's
// internal $state fields (current, history, etc.).
export const bootState = {
  get current() {
    return _boot
  },
}
export let chatState: ChatManager

export class ChatManager {
  sidebarOpen = $state(false)
  current: Chat
  history: Chat[]

  selectedModel = $state<Model | undefined>(getAvailableModels().at(0))
  webSearch = $state(true)
  reasoning = $state(false)

  // Per-chat in-flight requests so switching chats doesn't block, cancel, or
  // mis-attribute replies.
  private pendingRequests = new SvelteMap<number, AbortController>()

  get isCurrentLoading(): boolean {
    return this.pendingRequests.has(this.current.id)
  }

  isLoading(chatId: number): boolean {
    return this.pendingRequests.has(chatId)
  }

  /**
   * True when the last message is an error/stopped response — the user should
   * regen or fork, not send a new message.
   */
  get lastMessageIsError(): boolean {
    const last = this.current.messages.at(-1)
    return (
      last?.role === 'assistant' && ['stopped', 'interrupted', 'error'].includes(last.stop_reason)
    )
  }

  constructor(current: Chat, history: Chat[]) {
    this.history = $state(history)
    // Read from the reactive history proxy so current and history[0] share
    // the same proxy — same pattern as createNew().
    this.current = $state(this.history[history.indexOf(current)])
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
    // Insert into history first, then read back from the array. Svelte's $state
    // wraps array elements in reactive proxies on read, so this.history[0]
    // returns a proxy. If we instead set this.current to the raw object directly,
    // it and this.history[0] would be different proxies — pushing messages onto
    // one wouldn't notify subscribers (the sidebar) reading the other.
    this.history.unshift({ ...newChat, id })
    this.current = this.history[0]
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
    this.history = this.history.filter((c) => c.id !== id)

    // If we deleted the current chat, switch to another or create new
    if (this.current.id === id) {
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
    if (!content.trim() || this.isCurrentLoading || this.lastMessageIsError) return

    // Capture before any await: the user can switch chats while the request is in-flight.
    const chat = this.current

    const userMessage: ChatMessage = {
      role: 'user',
      content: content.trim(),
    }

    chat.messages.push(userMessage)
    scrollToBottom()

    // Save the captured chat (not this.current which may change if the user switches)
    await storage.updateChat(chat.id, chat)

    await this.processResponse(chat, content.trim())
  }

  /**
   * Regenerate response from a specific message index
   */
  async regenerate(index: number) {
    if (this.isCurrentLoading) return

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
    // See comment in createNew() for why we read back from history
    this.history.unshift({ ...newChat, id })
    this.current = this.history[0]

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
      if (this.current.id === chatId) scrollToBottom()

      await storage.updateChat(chatId, chat)
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
      if (this.current.id === chatId) scrollToBottom()

      await storage.updateChat(chatId, chat)
    } finally {
      await wakeLock?.release()
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
    this.pendingRequests.get(this.current.id)?.abort('user_stopped')
  }

  /**
   * Save current chat if it has messages
   */
  private async saveCurrentIfDirty() {
    if (this.current.messages.length === 0) return
    await storage.updateChat(this.current.id, this.current)
  }
}

// --- Boot ---

async function boot() {
  try {
    await storage.init()
    const history = await storage.getAllChats()

    let current: Chat
    if (history.length > 0 && history[0].messages.length === 0) {
      current = history[0]
    } else {
      const newChat: NewChat = {
        createdAt: new SvelteDate(),
        systemPrompt: systemBase,
        messages: [],
      }
      const id = await storage.createChat(newChat)
      current = { ...newChat, id }
      history.unshift(current)
    }

    chatState = new ChatManager(current, history)
    _boot = { status: 'ready' }
  } catch (error) {
    console.error('Failed to initialize chat storage:', error)
    _boot = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to initialize storage',
    }
  }
}

void boot()
