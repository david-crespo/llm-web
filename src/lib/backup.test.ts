import { describe, expect, test } from 'vitest'
import { parseBackup, planImport, toBackupJson } from './backup'
import type { Chat } from './types'

const chat = (id: number, createdAt: string, ...contents: string[]): Chat => ({
  id,
  createdAt: new Date(createdAt),
  systemPrompt: 'sys',
  messages: contents.map((content) => ({ role: 'user', content })),
})

const backup = (chats: unknown[], version = 1) =>
  JSON.stringify({ format: 'llm-web-chats', version, chats })

describe('backup', () => {
  test('exports chats without ids or pending jobs, and drops empty chats', () => {
    const pending = {
      ...chat(2, '2026-11-02T00:00:00.000Z', 'waiting'),
      pending: {
        job: { provider: 'openai' as const, id: 'r', durable: true },
        startedAt: '2026-11-02T00:00:00.000Z',
        modelId: 'm',
        search: false,
      },
    }
    const empty = chat(3, '2026-11-03T00:00:00.000Z')
    const json = toBackupJson([chat(1, '2026-11-01T00:00:00.000Z', 'hi'), pending, empty])

    const chats = JSON.parse(json).chats
    expect(chats.map(Object.keys)).toEqual([
      ['createdAt', 'systemPrompt', 'messages'],
      ['createdAt', 'systemPrompt', 'messages'],
    ])
    expect(parseBackup(json)).toEqual([
      {
        createdAt: new Date('2026-11-01T00:00:00.000Z'),
        systemPrompt: 'sys',
        messages: [{ role: 'user', content: 'hi' }],
      },
      {
        createdAt: new Date('2026-11-02T00:00:00.000Z'),
        systemPrompt: 'sys',
        messages: [{ role: 'user', content: 'waiting' }],
      },
    ])
  })

  test.each([
    ['not json', 'not valid JSON'],
    ['{"chats": []}', 'not an llm-web chat export'],
    [backup([], 0), 'not an llm-web chat export'],
    [JSON.stringify({ format: 'llm-web-chats', chats: [] }), 'not an llm-web chat export'],
    [backup([], 2), 'newer version'],
    [backup([{ createdAt: 'nope', systemPrompt: '', messages: [] }]), 'Chat 1 in this file'],
    [
      backup([
        {
          createdAt: '2026-11-01T00:00:00.000Z',
          systemPrompt: '',
          messages: [{ role: 'system', content: 'x' }],
        },
      ]),
      'Chat 1 in this file',
    ],
    [
      backup([
        {
          createdAt: '2026-11-01T00:00:00.000Z',
          systemPrompt: '',
          messages: [{ role: 'user', content: 1 }],
        },
      ]),
      'Chat 1 in this file',
    ],
  ])('rejects %s', (text, message) => {
    expect(() => parseBackup(text)).toThrow(message)
  })

  test('adds new chats and updates ones that grew since the last import', () => {
    const existing = [
      chat(7, '2026-11-01T00:00:00.000Z', 'same'),
      chat(8, '2026-11-02T00:00:00.000Z', 'grew'),
      chat(9, '2026-11-03T00:00:00.000Z', 'longer here', 'reply'),
    ]
    const imported = parseBackup(
      toBackupJson([
        chat(1, '2026-11-01T00:00:00.000Z', 'same'),
        chat(2, '2026-11-02T00:00:00.000Z', 'grew', 'more'),
        chat(3, '2026-11-03T00:00:00.000Z', 'longer here'),
        chat(4, '2026-11-04T00:00:00.000Z', 'new'),
      ]),
    )
    const { added, updated } = planImport(existing, imported)
    expect(added.map((c) => c.messages[0].content)).toEqual(['new'])
    expect(updated).toEqual([{ ...existing[1], messages: imported[1].messages }])
  })

  test('does not overwrite a chat with a pending answer', () => {
    const waiting: Chat = {
      ...chat(8, '2026-11-02T00:00:00.000Z', 'q'),
      pending: {
        job: { provider: 'openai', id: 'r', durable: true },
        startedAt: '2026-11-02T00:00:00.000Z',
        modelId: 'm',
        search: false,
      },
    }
    const imported = parseBackup(
      toBackupJson([chat(2, '2026-11-02T00:00:00.000Z', 'q', 'a', 'q2')]),
    )
    expect(planImport([waiting], imported)).toEqual({ added: [], updated: [] })
  })
})
