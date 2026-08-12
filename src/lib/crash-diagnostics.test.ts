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
      message: expect.stringContaining('without a pagehide event'),
    })
    expect(report?.stack).toContain('chat-select-start')
    expect(report?.stack).toContain('"toChars": 50000')
  })

  test('ignores invalid persisted data', () => {
    expect(reportForUnexpectedExit(null)).toBeNull()
    expect(reportForUnexpectedExit({ ...activeRun, version: 2 } as never)).toBeNull()
  })
})
