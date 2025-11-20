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
}

export type ChatMessage = UserMessage | AssistantMessage

export type Chat = {
  // For now we don't allow system prompt to be changed in the middle
  // of a chat. Otherwise we'd have to annotate each message with it.
  systemPrompt: string
  messages: ChatMessage[]
  createdAt: Date
  id?: number // Optional ID for stored chats
}
