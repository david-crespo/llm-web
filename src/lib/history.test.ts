import { describe, expect, test } from 'vitest'
import { mergeHistory } from './history'
import type { Chat, ChatMessage } from './types'

function chat(id: number, opts: { createdAt: number; messages?: string[] }): Chat {
  const messages: ChatMessage[] = (opts.messages ?? []).map((content) => ({
    role: 'user',
    content,
  }))
  return {
    id,
    createdAt: new Date(opts.createdAt),
    systemPrompt: 'test',
    messages,
  }
}

const ids = (chats: Chat[]) => chats.map((c) => c.id)

describe('mergeHistory', () => {
  test('stored chats merge in behind local ones, newest first', () => {
    const local = [chat(4, { createdAt: 40 })]
    const stored = [
      chat(3, { createdAt: 30 }),
      chat(2, { createdAt: 20 }),
      chat(1, { createdAt: 10 }),
    ]
    expect(ids(mergeHistory(local, stored))).toEqual([4, 3, 2, 1])
  })

  test('the local object wins when both sides have the same id', () => {
    // The local copy gained a message while the snapshot was loading.
    const localCurrent = chat(2, { messages: ['typed during load'], createdAt: 20 })
    const stored = [chat(2, { createdAt: 20 }), chat(1, { createdAt: 10 })]

    const merged = mergeHistory([localCurrent], stored)
    expect(ids(merged)).toEqual([2, 1])
    // Same object, not an equal copy — in-flight requests hold a reference to it.
    expect(merged[0]).toBe(localCurrent)
  })

  test('chats created locally after the snapshot are kept', () => {
    const local = [chat(5, { createdAt: 50 }), chat(4, { createdAt: 40 })]
    const stored = [chat(4, { createdAt: 40 }), chat(1, { createdAt: 10 })]
    expect(ids(mergeHistory(local, stored))).toEqual([5, 4, 1])
  })

  test('sorts by createdAt even when stored order disagrees', () => {
    const stored = [
      chat(1, { createdAt: 10 }),
      chat(3, { createdAt: 30 }),
      chat(2, { createdAt: 20 }),
    ]
    expect(ids(mergeHistory([], stored))).toEqual([3, 2, 1])
  })
})
