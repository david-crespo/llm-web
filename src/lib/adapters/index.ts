import type { Chat, JobHandle, ProviderData, TokenCounts } from '$lib/types'
import type { Model } from '$lib/models.svelte'
import { OpenAIAdapter } from './openai'
import { AnthropicAdapter } from './anthropic'
import { GoogleAdapter } from './google'

export type ModelResponse = {
  content: string
  tokens: TokenCounts
  stop_reason: string
  reasoning?: string
  searches?: number
  provider?: ProviderData
}

export type ChatInput = {
  chat: Chat
  model: Model
  search: boolean
  think: boolean
  signal?: AbortSignal
}

/** Result of a single poll. `unrecoverable` is the shared not-recoverable arm:
 * an expired/GC'd durable job and a non-durable job after reload both land here,
 * and the caller turns them into an interrupted message. */
export type PollResult =
  | { kind: 'pending' }
  | { kind: 'final'; response: ModelResponse }
  | { kind: 'failed'; error: string }
  | { kind: 'unrecoverable' }

/** Uniform submit-then-poll interface. Every provider implements it; the driver
 * in chat.svelte.ts never branches on provider. */
export interface Adapter {
  /** Submit a request, returning a durable-or-not handle the driver then polls. */
  start(input: ChatInput): Promise<JobHandle>
  poll(job: JobHandle, signal?: AbortSignal): Promise<PollResult>
  /** Best-effort server-side cancel. No-op for Anthropic (no server job). */
  cancel(job: JobHandle): Promise<void>
}

const adapters: Record<JobHandle['provider'], Adapter> = {
  openai: new OpenAIAdapter(),
  anthropic: new AnthropicAdapter(),
  google: new GoogleAdapter(),
}

export function getAdapter(provider: string): Adapter {
  if (provider in adapters) return adapters[provider as JobHandle['provider']]
  throw new Error(`Unsupported provider: ${provider}`)
}
