import { afterEach, describe, expect, test, vi } from 'vitest'
import { Storage } from './storage'
import type { Chat } from './types'

/**
 * Minimal fake of the slice of IndexedDB storage.ts uses. `connections` records
 * every connection handed out so tests can see reopens, and `closed` simulates
 * Safari killing a connection while the page is backgrounded.
 */
function fakeIndexedDB() {
  const connections: { closed: boolean; onclose: (() => void) | null }[] = []

  const store = {
    put: () => request(1),
    get: () => request(undefined),
    delete: () => request(undefined),
  }

  function request(result: unknown) {
    const req: Record<string, unknown> = { result, error: null }
    queueMicrotask(() => (req.onsuccess as (() => void) | undefined)?.())
    return req
  }

  const open = () => {
    const db = {
      closed: false,
      onclose: null,
      onversionchange: null,
      close() {
        db.closed = true
      },
      transaction() {
        if (db.closed) {
          throw new DOMException('The database connection is closing.', 'InvalidStateError')
        }
        return { objectStore: () => store }
      },
    }
    connections.push(db)
    const req: Record<string, unknown> = { result: db, error: null }
    queueMicrotask(() => (req.onsuccess as (() => void) | undefined)?.())
    return req
  }

  vi.stubGlobal('indexedDB', { open })
  return connections
}

const chat: Chat = {
  id: 1,
  createdAt: new Date(0),
  systemPrompt: '',
  messages: [],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('storage reconnects', () => {
  test('reuses one connection while it is alive', async () => {
    const connections = fakeIndexedDB()
    const storage = new Storage()
    await storage.updateChat(1, chat)
    await storage.updateChat(1, chat)
    expect(connections.length).toBe(1)
  })

  test('concurrent first calls share one open', async () => {
    const connections = fakeIndexedDB()
    const storage = new Storage()
    await Promise.all([storage.updateChat(1, chat), storage.getChat(1)])
    expect(connections.length).toBe(1)
  })

  // Safari closes IDB connections on a backgrounded page, sometimes without
  // firing `close`, so the first sign of trouble is a throw from transaction().
  test('reopens after the connection dies silently', async () => {
    const connections = fakeIndexedDB()
    const storage = new Storage()
    await storage.updateChat(1, chat)
    connections[0].closed = true

    await expect(storage.updateChat(1, chat)).resolves.toBeUndefined()
    expect(connections.length).toBe(2)
  })

  test('reopens after a close event', async () => {
    const connections = fakeIndexedDB()
    const storage = new Storage()
    await storage.updateChat(1, chat)
    // Not marked closed: the close event alone should retire the connection.
    connections[0].onclose?.()

    await expect(storage.updateChat(1, chat)).resolves.toBeUndefined()
    expect(connections.length).toBe(2)
  })
})
