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
 * can add fields for other providers without widening every consumer. */
export type ProviderData = {
  type: 'openai'
  /** Responses API response.id, used as previous_response_id on the next turn
   * so reasoning items carry over and prompt caching hits. */
  responseId: string
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
}

export type Chat = NewChat & { id: number }
