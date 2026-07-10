import type { Page, Route } from '@playwright/test'

// Mock LLM provider APIs at the network boundary. The real SDK + adapter code
// runs; only the provider servers are faked. Each mock is written to respond to
// *whatever the app requests* (sync today, background+poll after the async
// refactor) so the test bodies don't change when the adapters change.

// --- shared gate: a test-controlled deferred the route handler awaits ---

type Gate = {
  ready: Promise<void>
  open: () => void
  settled: () => boolean
}

function makeGate(): Gate {
  let open!: () => void
  let settled = false
  const ready = new Promise<void>((resolve) => {
    open = () => {
      settled = true
      resolve()
    }
  })
  return { ready, open, settled: () => settled }
}

// --- CORS: fulfilled cross-origin responses are still CORS-checked by the
// browser, and custom auth headers trigger an OPTIONS preflight. Without these
// every fetch fails with an opaque CORS error instead of a useful assertion. ---

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
}

async function fulfillPreflight(route: Route): Promise<boolean> {
  if (route.request().method() !== 'OPTIONS') return false
  await route.fulfill({ status: 204, headers: CORS_HEADERS })
  return true
}

async function fulfillJSON(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function errorBody(message: string) {
  return { error: { message, type: 'invalid_request_error', code: 'invalid' } }
}

async function fulfillUnexpectedRequest(route: Route, provider: string): Promise<void> {
  const req = route.request()
  const { pathname } = new URL(req.url())
  await fulfillJSON(
    route,
    500,
    errorBody(`${provider} mock: unexpected ${req.method()} ${pathname}`),
  )
}

// --- handle returned to tests ---

export type ProviderMock = {
  /** Release the response (sync) / flip the poll to completed (async). */
  complete: () => void
  /** Fail the request with a non-retryable status (401 by default). */
  fail: (status?: number) => void
  /** How many times the create endpoint was hit. */
  calls: () => number
  /** Create request bodies, useful for checking UI controls are wired through. */
  bodies: () => Body[]
}

export type MockOpts = {
  /** Assistant text to return. */
  text?: string
  /** Resolve immediately instead of waiting for complete(). */
  auto?: boolean
  /** Derive the reply from the last user message (for attribution tests). */
  reply?: (userText: string) => string
  /** Reasoning text to include (Anthropic/Google). */
  reasoning?: string
}

type Body = Record<string, unknown>

// Loose shape covering all three providers' message items.
type LooseMsg = { role?: string; content?: string; parts?: { text?: string }[] }

function lastText(items: unknown[] | undefined, getText: (item: LooseMsg) => string): string {
  if (!Array.isArray(items)) return ''
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i] as LooseMsg
    if (item.role === 'user') return getText(item)
  }
  return ''
}

// --- OpenAI Responses API ---

function openaiResponse(text: string, status = 'completed', id = 'resp_test_openai') {
  return {
    id,
    object: 'response',
    status,
    output:
      status === 'completed'
        ? [
            {
              type: 'message',
              id: 'msg_test',
              role: 'assistant',
              status: 'completed',
              content: [{ type: 'output_text', text, annotations: [] }],
            },
          ]
        : [],
    output_text: status === 'completed' ? text : '',
    usage: {
      input_tokens: 12,
      output_tokens: 8,
      total_tokens: 20,
      input_tokens_details: { cached_tokens: 0 },
    },
  }
}

export async function mockOpenAI(page: Page, opts: MockOpts = {}): Promise<ProviderMock> {
  const gate = makeGate()
  if (opts.auto) gate.open()
  const fallback = opts.text ?? 'Hello from GPT-5.6.'
  // Per-request reply text, keyed by response id so concurrent requests don't
  // clobber each other (the create body has the user message; the GET poll
  // doesn't, so it looks the text up by id).
  const textById = new Map<string, string>()
  let idCounter = 0
  let failStatus: number | null = null
  let calls = 0
  const bodies: Body[] = []

  await page.route('https://api.openai.com/**', async (route) => {
    if (await fulfillPreflight(route)) return
    const req = route.request()
    const { pathname } = new URL(req.url())

    // create
    if (pathname === '/v1/responses' && req.method() === 'POST') {
      calls++
      const body = (req.postDataJSON() ?? {}) as Body
      bodies.push(body)
      const id = `resp_test_openai_${++idCounter}`
      const text = opts.reply
        ? opts.reply(lastText(body.input as unknown[], (m) => m.content ?? ''))
        : fallback
      textById.set(id, text)
      if (body.background) {
        return fulfillJSON(route, 200, { id, object: 'response', status: 'queued' })
      }
      await gate.ready
      return failStatus
        ? fulfillJSON(route, failStatus, errorBody('Invalid API key'))
        : fulfillJSON(route, 200, openaiResponse(text, 'completed', id))
    }

    // poll (async mode only)
    if (pathname.startsWith('/v1/responses/') && req.method() === 'GET') {
      if (failStatus) return fulfillJSON(route, failStatus, errorBody('Invalid API key'))
      const id = pathname.split('/').pop()!
      const text = textById.get(id) ?? fallback
      return fulfillJSON(
        route,
        200,
        openaiResponse(text, gate.settled() ? 'completed' : 'in_progress', id),
      )
    }

    return fulfillUnexpectedRequest(route, 'OpenAI')
  })

  return {
    complete: gate.open,
    fail: (status = 401) => {
      failStatus = status
      gate.open()
    },
    calls: () => calls,
    bodies: () => bodies.slice(),
  }
}

// --- Anthropic Messages API (stays synchronous even after the refactor) ---

function anthropicResponse(text: string, reasoning?: string) {
  const content: unknown[] = []
  if (reasoning) content.push({ type: 'thinking', thinking: reasoning, signature: 'sig' })
  content.push({ type: 'text', text })
  return {
    id: 'msg_test_anthropic',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-4-8',
    content,
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 12, output_tokens: 8 },
  }
}

export async function mockAnthropic(page: Page, opts: MockOpts = {}): Promise<ProviderMock> {
  const gate = makeGate()
  if (opts.auto) gate.open()
  const fallback = opts.text ?? 'Hello from Claude.'
  let failStatus: number | null = null
  let calls = 0
  const bodies: Body[] = []

  await page.route('https://api.anthropic.com/**', async (route) => {
    if (await fulfillPreflight(route)) return
    const req = route.request()
    const { pathname } = new URL(req.url())
    if (pathname === '/v1/messages' && req.method() === 'POST') {
      calls++
      const body = (req.postDataJSON() ?? {}) as Body
      bodies.push(body)
      const text = opts.reply
        ? opts.reply(lastText(body.messages as unknown[], (m) => m.content ?? ''))
        : fallback
      await gate.ready
      return failStatus
        ? fulfillJSON(route, failStatus, errorBody('Invalid API key'))
        : fulfillJSON(route, 200, anthropicResponse(text, opts.reasoning))
    }
    return fulfillUnexpectedRequest(route, 'Anthropic')
  })

  return {
    complete: gate.open,
    fail: (status = 401) => {
      failStatus = status
      gate.open()
    },
    calls: () => calls,
    bodies: () => bodies.slice(),
  }
}

// --- Google Gemini API ---

function geminiResponse(text: string, reasoning?: string) {
  const parts: unknown[] = []
  if (reasoning) parts.push({ text: reasoning, thought: true })
  parts.push({ text })
  return {
    candidates: [{ content: { parts, role: 'model' }, finishReason: 'STOP', index: 0 }],
    usageMetadata: {
      promptTokenCount: 12,
      candidatesTokenCount: 8,
      thoughtsTokenCount: reasoning ? 4 : 0,
      cachedContentTokenCount: 0,
      totalTokenCount: 24,
    },
  }
}

export async function mockGoogle(page: Page, opts: MockOpts = {}): Promise<ProviderMock> {
  const gate = makeGate()
  if (opts.auto) gate.open()
  const fallback = opts.text ?? 'Hello from Gemini.'
  let failStatus: number | null = null
  let calls = 0
  const bodies: Body[] = []

  await page.route('https://generativelanguage.googleapis.com/**', async (route) => {
    if (await fulfillPreflight(route)) return
    const req = route.request()
    const { pathname } = new URL(req.url())
    // today: .../models/{model}:generateContent ; after: .../interactions
    const isCreate =
      req.method() === 'POST' &&
      (pathname.includes(':generateContent') || pathname.endsWith('/interactions'))
    if (isCreate) {
      calls++
      const body = (req.postDataJSON() ?? {}) as Body
      bodies.push(body)
      const text = opts.reply
        ? opts.reply(lastText(body.contents as unknown[], (c) => c.parts?.[0]?.text ?? ''))
        : fallback
      await gate.ready
      return failStatus
        ? fulfillJSON(route, failStatus, {
            error: { code: failStatus, message: 'Invalid API key', status: 'UNAUTHENTICATED' },
          })
        : fulfillJSON(route, 200, geminiResponse(text, opts.reasoning))
    }
    return fulfillUnexpectedRequest(route, 'Google')
  })

  return {
    complete: gate.open,
    fail: (status = 401) => {
      failStatus = status
      gate.open()
    },
    calls: () => calls,
    bodies: () => bodies.slice(),
  }
}
