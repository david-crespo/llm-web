import type { JobHandle } from '$lib/types'
import type { Adapter, ChatInput, ModelResponse, PollResult, StartResult } from './index'

/** A fired request whose settled state poll() can inspect without blocking. */
type Tracked = {
  settled: boolean
  value?: ModelResponse
  error?: unknown
}

/** Wrap a normal in-browser request in the submit-then-poll adapter shape.
 *
 * These jobs are not durable: the id only keys this adapter instance's in-memory
 * map. After a reload the map is gone, so poll() returns `unrecoverable`.
 */
export abstract class NonDurableAdapter implements Adapter {
  private inflight = new Map<string, Tracked>()

  constructor(private readonly provider: JobHandle['provider']) {}

  async start(input: ChatInput): Promise<StartResult> {
    const id = crypto.randomUUID()
    const tracked: Tracked = { settled: false }

    // Fire the request but don't await it here; poll() resolves it. The promise
    // is tracked so poll() can tell pending from settled without blocking.
    this.create(input).then(
      (response) => {
        tracked.value = response
        tracked.settled = true
      },
      (error) => {
        tracked.error = error
        tracked.settled = true
      },
    )

    this.inflight.set(id, tracked)
    return { job: { provider: this.provider, id, durable: false } }
  }

  async poll(job: JobHandle): Promise<PollResult> {
    const tracked = this.inflight.get(job.id)
    // No live promise: we reloaded since submitting (or it was already consumed).
    if (!tracked) return { kind: 'unrecoverable' }
    if (!tracked.settled) return { kind: 'pending' }

    this.inflight.delete(job.id)
    if (tracked.error) {
      const message = tracked.error instanceof Error ? tracked.error.message : 'Unknown error'
      return { kind: 'failed', error: message }
    }
    return { kind: 'final', response: tracked.value! }
  }

  async cancel(job: JobHandle): Promise<void> {
    // No server-side job; drop the in-memory promise. The underlying fetch is
    // aborted via the request's AbortSignal by the driver.
    this.inflight.delete(job.id)
  }

  protected abstract create(input: ChatInput): Promise<ModelResponse>
}
