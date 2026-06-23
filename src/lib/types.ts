export type TokenCounts = {
  input: number
  input_cache_hit?: number
  output: number
}

export type UserMessage = {
  role: 'user'
  content: string
  cache?: boolean
}

/** Provider-specific assistant-message data. Discriminated on `type` so we
 * can add fields for other providers without widening every consumer. Anthropic
 * and Google have no chaining handle (they resend full history), so they set
 * none. */
export type ProviderData = {
  type: 'openai'
  /** Responses API response.id, used as previous_response_id on the next turn
   * so reasoning items carry over and prompt caching hits. */
  responseId: string
}

/** Persistable reference to an in-flight provider request. Durable handles can
 * be re-polled after reload; non-durable handles only key an in-memory promise
 * and become unrecoverable after reload. */
export type JobHandle = {
  provider: 'openai' | 'google' | 'anthropic'
  id: string
  durable: boolean
}

/** An assistant turn that has been submitted but not yet committed. Persisted on
 * the chat so a reload can resume polling instead of losing the response. */
export type PendingJob = {
  job: JobHandle
  /** ISO timestamp of submission; used for elapsed-time display and the poll
   * timeout that converts a stuck job into an interrupted message. */
  startedAt: string
  /** Model id (Model.id) so commit can recompute cost and label the message
   * even after a reload, when the live request closure is gone. */
  modelId: string
  /** Whether web search was on, recorded on the committed message. */
  search: boolean
}

export type AssistantMessage = {
  role: 'assistant'
  model: string
  /** Model response text */
  content: string
  /** Reasoning text. May be blank. Not rendered in --raw mode. */
  reasoning?: string
  /** Whether search was on when this was generated */
  search?: boolean
  tokens: TokenCounts
  stop_reason: string
  cost: number
  timeMs: number
  cache?: boolean
  provider?: ProviderData
}

export type ChatMessage = UserMessage | AssistantMessage

export type NewChat = {
  // For now we don't allow system prompt to be changed in the middle
  // of a chat. Otherwise we'd have to annotate each message with it.
  systemPrompt: string
  messages: ChatMessage[]
  createdAt: Date
  /** In-flight assistant turn, if any. Present iff a request has been submitted
   * but not yet committed to `messages`. Drives the loading placeholder and
   * enables resume-after-reload. */
  pending?: PendingJob
}

export type Chat = NewChat & { id: number }
