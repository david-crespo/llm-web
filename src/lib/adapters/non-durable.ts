import type { JobHandle } from '$lib/types'
import type { Adapter, ChatInput, ModelResponse, PollResult, StartResult } from './index'

type TrackedResult = { ok: true; response: ModelResponse } | { ok: false; error: unknown }

/** Wrap a normal in-browser request in the submit-then-poll adapter shape.
 *
 * These jobs are not durable: the id only keys this adapter instance's in-memory
 * map. After a reload the map is gone, so poll() returns `unrecoverable`.
 */
export abstract class NonDurableAdapter implements Adapter {
  private inflight = new Map<string, Promise<TrackedResult>>()

  constructor(private readonly provider: JobHandle['provider']) {}

  async start(input: ChatInput): Promise<StartResult> {
    const id = crypto.randomUUID()
    const tracked = this.create(input).then<TrackedResult, TrackedResult>(
      (response) => ({ ok: true, response }),
      (error: unknown) => ({ ok: false, error }),
    )

    this.inflight.set(id, tracked)
    return { job: { provider: this.provider, id, durable: false } }
  }

  async poll(job: JobHandle, signal?: AbortSignal): Promise<PollResult> {
    const tracked = this.inflight.get(job.id)
    // No live promise: we reloaded since submitting (or it was already consumed).
    if (!tracked) return { kind: 'unrecoverable' }

    // A non-durable request already has one live promise. Awaiting it avoids
    // imposing the durable providers' polling interval on Anthropic responses.
    const result = await tracked
    this.inflight.delete(job.id)
    if (!result.ok) {
      // Let the driver observe Stop through the aborted branch instead of
      // committing the fetch's AbortError as a provider failure.
      if (signal?.aborted) throw result.error
      const message = result.error instanceof Error ? result.error.message : 'Unknown error'
      return { kind: 'failed', error: message }
    }
    return { kind: 'final', response: result.response }
  }

  async cancel(job: JobHandle): Promise<void> {
    // No server-side job; drop the in-memory promise. The underlying fetch is
    // aborted via the request's AbortSignal by the driver.
    this.inflight.delete(job.id)
  }

  protected abstract create(input: ChatInput): Promise<ModelResponse>
}
