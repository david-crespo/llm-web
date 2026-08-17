import type { Chat, NewChat } from './types'

const DB_NAME = 'llm-web'
const DB_VERSION = 1

export interface ApiKeys {
  openai?: string
  anthropic?: string
  google?: string
}

/**
 * Safari can close an IndexedDB connection out from under us while the page is
 * backgrounded, without always firing `close` first. The dead handle then
 * throws this on the next `transaction()` call.
 */
function isConnectionClosed(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'InvalidStateError'
}

export class Storage {
  private db: IDBDatabase | null = null
  private opening: Promise<IDBDatabase> | null = null

  async init(): Promise<void> {
    await this.open()
  }

  private open(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db)
    this.opening ??= this.openDb().finally(() => {
      this.opening = null
    })
    return this.opening
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this environment'))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result

        // Drop our reference when the connection goes away so the next
        // operation reopens instead of using a dead handle.
        db.onclose = () => {
          if (this.db === db) this.db = null
        }
        db.onversionchange = () => {
          db.close()
          if (this.db === db) this.db = null
        }

        this.db = db
        resolve(db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Chats store
        if (!db.objectStoreNames.contains('chats')) {
          const chatsStore = db.createObjectStore('chats', {
            keyPath: 'id',
            autoIncrement: true,
          })
          chatsStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        // API keys store
        if (!db.objectStoreNames.contains('apiKeys')) {
          db.createObjectStore('apiKeys', { keyPath: 'id' })
        }
      }
    })
  }

  /** Open a transaction on `chats`, reopening the database once if it's dead. */
  private async chatStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.open()
    try {
      return db.transaction(['chats'], mode).objectStore('chats')
    } catch (error) {
      if (!isConnectionClosed(error)) throw error
      if (this.db === db) this.db = null
      return (await this.open()).transaction(['chats'], mode).objectStore('chats')
    }
  }

  // Chat methods
  async createChat(chat: NewChat): Promise<number> {
    const store = await this.chatStore('readwrite')
    return new Promise((resolve, reject) => {
      // Create a plain object copy to avoid proxy serialization issues
      const plainChat = {
        createdAt: chat.createdAt.toISOString(),
        systemPrompt: chat.systemPrompt,
        messages: chat.messages,
        pending: chat.pending,
      }

      // Use JSON serialization to remove all proxy references
      const chatData = JSON.parse(JSON.stringify(plainChat))

      const request = store.put(chatData)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result as number)
    })
  }

  async updateChat(id: number, chat: Chat): Promise<void> {
    const store = await this.chatStore('readwrite')
    return new Promise((resolve, reject) => {
      // Create a plain object copy to avoid proxy serialization issues
      const plainChat = {
        id,
        createdAt: chat.createdAt.toISOString(),
        systemPrompt: chat.systemPrompt,
        messages: chat.messages,
        pending: chat.pending,
      }

      // Use JSON serialization to remove all proxy references
      const chatData = JSON.parse(JSON.stringify(plainChat))

      const request = store.put(chatData)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }

  async getChat(id: number): Promise<Chat | null> {
    const store = await this.chatStore('readonly')
    return new Promise((resolve, reject) => {
      const request = store.get(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        if (result) {
          // Convert string back to Date
          result.createdAt = new Date(result.createdAt)
        }
        resolve(result || null)
      }
    })
  }

  async getAllChats(): Promise<Chat[]> {
    const store = await this.chatStore('readonly')
    return new Promise((resolve, reject) => {
      const index = store.index('createdAt')
      const request = index.openCursor(null, 'prev') // Most recent first

      const results: Chat[] = []

      request.onerror = () => reject(request.error)
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          const chat = cursor.value
          chat.createdAt = new Date(chat.createdAt)
          results.push(chat)
          cursor.continue()
        } else {
          resolve(results)
        }
      }
    })
  }

  async deleteChat(id: number): Promise<void> {
    const store = await this.chatStore('readwrite')
    return new Promise((resolve, reject) => {
      const request = store.delete(id)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  }
}

export const storage = new Storage()
