import { describe, expect, test } from 'vitest'
import { reportForUnexpectedExit, type DiagnosticRun } from './crash-diagnostics'

const activeRun: DiagnosticRun = {
  version: 1,
  runId: 'run-1',
  startedAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:05.000Z',
  navigationType: 'navigate',
  url: 'https://example.test/',
  userAgent: 'Mobile Safari test',
  events: [
    {
      at: '2026-08-12T00:00:05.000Z',
      name: 'chat-select-start',
      details: { fromChatId: 2, toChatId: 1, toMessages: 20, toChars: 50_000 },
    },
  ],
}

describe('reportForUnexpectedExit', () => {
  test('turns an abandoned active run into a copyable error report', () => {
    const report = reportForUnexpectedExit(activeRun)

    expect(report).toMatchObject({
      source: 'abnormal-exit',
      message: expect.stringContaining('unexpectedly after chat-select-start'),
    })
    expect(report?.stack).toContain('chat-select-start')
    expect(report?.stack).toContain('"toChars": 50000')
  })

  test('ignores invalid persisted data', () => {
    expect(reportForUnexpectedExit(null)).toBeNull()
    expect(reportForUnexpectedExit({ ...activeRun, version: 2 } as never)).toBeNull()
  })

  test('summarizes the last snapshot and recent sidebar state', () => {
    const report = reportForUnexpectedExit({
      ...activeRun,
      updatedAt: '2026-08-12T00:00:06.100Z',
      events: [
        {
          at: '2026-08-12T00:00:05.000Z',
          name: 'sidebar-toggle',
          details: { open: true, pending: true, history: 1064, domNodes: 5418 },
        },
        {
          at: '2026-08-12T00:00:06.100Z',
          name: 'request-started',
          details: { provider: 'openai', domNodes: 5417 },
        },
      ],
    })

    expect(report?.message).toContain('after request-started with 5,417 DOM nodes')
    expect(report?.message).toContain('sidebar had been opened 1.1s earlier')
    expect(report?.message).toContain('History contained 1,064 chats')
  })
})
