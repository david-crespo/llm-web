import { SvelteDate, SvelteMap } from 'svelte/reactivity'
import { storage } from '$lib/storage'
import { models, getCost, systemBase, getAvailableModels, type Model } from '$lib/models.svelte'
import { getAdapter, type ModelResponse } from '$lib/adapters'
import { scrollToBottom, scrollToAnswer } from '$lib/actions/autoScroll'
import type { Chat, NewChat, ChatMessage, JobHandle, PendingJob } from '$lib/types'

// Poll frequently while the answer is likely to finish soon. Provider polling
// is cheap relative to generation, and a long backoff makes a chat UI feel
// noticeably slower after the answer is already available.
const POLL_INTERVAL_MS = 2000
const RETRY_START_MS = 1000
const RETRY_MAX_MS = 30_000
// After this much elapsed time, ease off to a slower poll interval — the job
// is long-running or we're resuming after the tab was closed for a while.
const POLL_EASE_OFF_MS = 10 * 60 * 1000
const POLL_EASE_OFF_INTERVAL_MS = 30_000
// Give up on a job that never terminates so a wedged request becomes an
// interrupted message. OpenAI stores responses with store=true for ~30 days,
// so this catches truly stuck jobs rather than racing server-side expiry.
const JOB_TIMEOUT_MS = 30 * 60 * 1000

/** Turn a thrown submit error / abort into the message to show. */
function classifyError(
  error: unknown,
  signal: AbortSignal,
  reason: string | undefined,
): { content: string; stopReason: string } {
  if (reason === 'user_stopped') return { content: 'Stopped by user', stopReason: 'stopped' }
  const isAbort = signal.aborted || (error instanceof Error && error.name === 'AbortError')
  if (isAbort) {
    return {
      content: 'Request interrupted (connection lost or tab backgrounded)',
      stopReason: 'interrupted',
    }
  }
  console.error('Error sending message:', error)
  return {
    content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    stopReason: 'error',
  }
}

/** Resolve after `ms`, or immediately if `signal` aborts (so a Stop during a
 * backoff wait doesn't have to wait out the full delay). */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    signal.addEventListener('abort', finish, { once: true })
  })
}

/** Durable polling survives connectivity failures. Authentication and ordinary
 * request errors require user action; timeouts, rate limits, server errors, and
 * errors without an HTTP status are safe to retry. */
function isRetryablePollError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('status' in error)) return true
  const status = error.status
  return (
    typeof status !== 'number' ||
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  )
}

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

  // Per-chat live poll loops so switching chats doesn't block, cancel, or
  // mis-attribute replies. Holds the AbortController for cancel/stop; the
  // durable source of truth for "is loading" is the persisted chat.pending.
  private pendingRequests = new SvelteMap<number, AbortController>()

  // A chat is loading if a job is persisted (survives reload) or a live request
  // is mid-submit before its pending field is written. The map keeps the
  // placeholder instant on send; chat.pending keeps it across reloads.
  get isCurrentLoading(): boolean {
    return this.pendingRequests.has(this.current.id) || this.current.pending != null
  }

  isLoading(chatId: number): boolean {
    if (this.pendingRequests.has(chatId)) return true
    return this.history.find((c) => c.id === chatId)?.pending != null
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

  /**
   * Index of the user message that can be edited in place, or -1 if none. Only
   * the final user message is editable, and only when nothing succeeded after
   * it: it's the last message, or the only thing following is a stopped/failed
   * response. Editing isn't offered while a request is in flight.
   */
  get editableIndex(): number {
    if (this.isCurrentLoading) return -1
    const messages = this.current.messages
    if (messages.at(-1)?.role === 'user') return messages.length - 1
    if (this.lastMessageIsError && messages.at(-2)?.role === 'user') return messages.length - 2
    return -1
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
    // Stop any in-flight poll loop for this chat first. 'replaced' makes runJob
    // bail without committing, so it can't re-persist (resurrect) the deleted
    // chat; also cancel the server-side job so it doesn't keep running.
    this.pendingRequests.get(id)?.abort('replaced')
    const pendingJob = this.history.find((c) => c.id === id)?.pending?.job
    if (pendingJob) void this.cancelJob(pendingJob)

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
   * Edit a user message in place: drop it (and anything after it) from the
   * current chat and return its content so the caller can repopulate the input.
   * Like fork(), but stays in the same chat rather than branching a new one.
   */
  async editMessage(index: number): Promise<string | null> {
    const chat = this.current
    const target = chat.messages[index]
    if (target?.role !== 'user') return null

    chat.messages = chat.messages.slice(0, index)
    await storage.updateChat(chat.id, chat)
    return target.content
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
   * Submit a request for `chat` and drive it to completion via the uniform
   * submit→poll adapter. Operates on the specific `chat` reference so it stays
   * correct even if the user switches chats while the request is in flight.
   */
  private async processResponse(chat: Chat, input: string) {
    if (!this.selectedModel) return
    const chatId = chat.id
    const model = this.selectedModel
    const search = this.webSearch
    const adapter = getAdapter(model.provider)

    // Supersede any prior in-flight job for this chat: drop its poll loop and
    // cancel the server-side job so we don't pay for an answer we'll discard.
    this.pendingRequests.get(chatId)?.abort('replaced')
    if (chat.pending) void this.cancelJob(chat.pending.job)

    const controller = new AbortController()
    this.pendingRequests.set(chatId, controller)

    // Scroll after isCurrentLoading flips so the loading placeholder is in the
    // DOM by the time scrollToBottom's rAF runs; otherwise it would stop at the
    // bottom of the user message and miss the placeholder.
    if (this.current.id === chatId) scrollToBottom()

    let job: JobHandle
    try {
      const result = await adapter.start({
        chat,
        input,
        model,
        search,
        think: this.reasoning,
        signal: controller.signal,
      })
      job = result.job
    } catch (error) {
      // Submit failed (bad key, network, or user stopped before it landed).
      // No pending was written, so push the error message directly.
      if (this.pendingRequests.get(chatId) !== controller) return
      this.pendingRequests.delete(chatId)
      const reason = controller.signal.reason as string | undefined
      if (reason === 'replaced') return
      this.pushErrorMessage(chat, model.id, classifyError(error, controller.signal, reason))
      await storage.updateChat(chatId, chat)
      return
    }

    // Persist the handle before polling so a reload (or visibility wake) can
    // resume this exact job instead of losing it.
    const pending: PendingJob = {
      job,
      startedAt: new SvelteDate().toISOString(),
      modelId: model.id,
      search,
    }
    chat.pending = pending
    await storage.updateChat(chatId, chat)

    await this.runJob(chat, pending, controller)
  }

  /**
   * Poll a job to completion and commit the result. Shared by live sends and by
   * resume-on-boot/visibility, so it must reconstruct everything it needs from
   * the persisted `pending` rather than a live closure.
   */
  private async runJob(chat: Chat, pending: PendingJob, existing?: AbortController) {
    const chatId = chat.id
    const { job } = pending
    const adapter = getAdapter(job.provider)

    // Resume paths have no live controller yet; create one so Stop still works.
    const controller = existing ?? new AbortController()
    if (!existing) this.pendingRequests.set(chatId, controller)

    let retryDelay = RETRY_START_MS
    try {
      while (true) {
        // Superseded by a newer job for this chat (regenerate/edit) — bail and
        // let the newer loop own chat.pending.
        if (chat.pending?.job.id !== job.id) return

        if (controller.signal.aborted) {
          const reason = controller.signal.reason as string | undefined
          if (reason === 'replaced' || reason === 'restart') return
          await this.cancelJob(job)
          await this.commitError(
            chat,
            pending,
            reason === 'user_stopped' ? 'stopped' : 'interrupted',
          )
          return
        }

        let result
        let transientFailure = false
        try {
          result = await adapter.poll(job, controller.signal)
        } catch (error) {
          // Abort surfaces as a throw — loop back so the aborted branch handles it.
          if (controller.signal.aborted) continue
          if (job.durable && isRetryablePollError(error)) {
            // Keep the persisted handle. A visibility or online event can
            // restart this loop immediately; otherwise retry with backoff.
            transientFailure = true
            result = { kind: 'pending' as const }
          } else {
            result = {
              kind: 'failed' as const,
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          }
        }

        if (result.kind === 'final') {
          await this.commitResponse(chat, pending, result.response)
          return
        }
        if (result.kind === 'failed') {
          await this.commitError(chat, pending, 'error', result.error)
          return
        }
        if (result.kind === 'unrecoverable') {
          await this.commitError(chat, pending, 'interrupted')
          return
        }

        // Poll before timing out: a job that completed while the tab was
        // closed past the deadline still lands its answer. Only give up if
        // the poll came back pending AND the deadline has passed.
        const elapsed = Date.now() - Date.parse(pending.startedAt)
        if (!transientFailure && elapsed > JOB_TIMEOUT_MS) {
          await this.cancelJob(job)
          await this.commitError(chat, pending, 'interrupted')
          return
        }

        // After the ease-off point, poll less frequently — the job is either
        // long-running or we're resuming after a long absence.
        const sleepMs = transientFailure
          ? retryDelay
          : elapsed > POLL_EASE_OFF_MS
            ? POLL_EASE_OFF_INTERVAL_MS
            : POLL_INTERVAL_MS
        await sleep(sleepMs, controller.signal)
        retryDelay = transientFailure ? Math.min(retryDelay * 2, RETRY_MAX_MS) : RETRY_START_MS
      }
    } finally {
      if (this.pendingRequests.get(chatId) === controller) {
        this.pendingRequests.delete(chatId)
      }
    }
  }

  /** Commit a successful response: build the assistant message, clear pending. */
  private async commitResponse(
    chat: Chat,
    pending: PendingJob,
    response: ModelResponse,
  ): Promise<void> {
    // Superseded while polling — a newer job owns this chat's turn now.
    if (chat.pending?.job.id !== pending.job.id) return

    const model = models.find((m) => m.id === pending.modelId)
    const cost = model ? getCost(model, response.tokens, response.searches) : 0
    const timeMs = Date.now() - Date.parse(pending.startedAt)

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      model: pending.modelId,
      content: response.content,
      reasoning: response.reasoning,
      search: pending.search,
      tokens: response.tokens,
      stop_reason: response.stop_reason,
      cost,
      timeMs,
      provider: response.provider,
    }

    chat.pending = undefined
    chat.messages.push(assistantMessage)
    // Don't yank the viewport if the user is viewing a different chat.
    if (this.current.id === chat.id) scrollToAnswer()
    await storage.updateChat(chat.id, chat)
  }

  /** Push an interrupted/stopped/error message in place of the pending job. */
  private async commitError(
    chat: Chat,
    pending: PendingJob,
    kind: 'stopped' | 'interrupted' | 'error',
    detail?: string,
  ): Promise<void> {
    if (chat.pending?.job.id !== pending.job.id) return
    const content =
      kind === 'stopped'
        ? 'Stopped by user'
        : kind === 'interrupted'
          ? 'Request interrupted (connection lost or tab backgrounded)'
          : `Error: ${detail ?? 'Unknown error'}`
    chat.pending = undefined
    this.pushErrorMessage(chat, pending.modelId, { content, stopReason: kind })
    if (this.current.id === chat.id) scrollToBottom()
    await storage.updateChat(chat.id, chat)
  }

  private pushErrorMessage(
    chat: Chat,
    modelId: string,
    e: { content: string; stopReason: string },
  ) {
    const errorMessage: ChatMessage = {
      role: 'assistant',
      model: modelId,
      content: e.content,
      tokens: { input: 0, output: 0 },
      stop_reason: e.stopReason,
      cost: 0,
      timeMs: 0,
    }
    chat.messages.push(errorMessage)
  }

  /** Best-effort cancel of a server-side job; never throws. */
  private async cancelJob(job: JobHandle): Promise<void> {
    try {
      await getAdapter(job.provider).cancel(job)
    } catch {
      // Cancel is best-effort; the job timing out server-side is acceptable.
    }
  }

  /**
   * Resume any persisted pending jobs that aren't already being polled. Called
   * on boot and on visibility/online wake. Durable jobs can recover after
   * reload; non-durable jobs resolve to `unrecoverable` after reload and become
   * interrupted messages.
   */
  resumePending(restartActive = false) {
    for (const chat of this.history) {
      if (!chat.pending) continue
      const active = this.pendingRequests.get(chat.id)
      if (active && !restartActive) continue
      // A non-durable request cannot be restarted: aborting its controller also
      // aborts the only underlying fetch. Its existing promise will resume with
      // the page instead.
      if (active && !chat.pending.job.durable) continue
      if (active) active.abort('restart')
      void this.runJob(chat, chat.pending)
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

    // Resume jobs that were in flight when the page last closed, and re-check on
    // every wake — a phone that slept mid-request lands here, re-polls the
    // server-side job, and the answer appears without the user resending.
    chatState.resumePending()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') chatState.resumePending(true)
      })
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => chatState.resumePending(true))
    }
  } catch (error) {
    console.error('Failed to initialize chat storage:', error)
    _boot = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to initialize storage',
    }
  }
}

void boot()
