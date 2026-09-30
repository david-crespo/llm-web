import type { Page } from '@playwright/test'
import type { NewChat } from '../../../src/lib/types'

/** Seed saved chats without making provider requests. */
export async function seedChats(page: Page, chats: NewChat[]): Promise<void> {
  await page.goto('/settings')
  await page.getByLabel('OpenAI').waitFor()
  await page.evaluate(
    (chats) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('llm-web', 1)
        request.onerror = () => reject(request.error)
        request.onupgradeneeded = () => {
          const db = request.result
          const store = db.createObjectStore('chats', { keyPath: 'id', autoIncrement: true })
          store.createIndex('createdAt', 'createdAt', { unique: false })
          db.createObjectStore('apiKeys', { keyPath: 'id' })
        }
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction('chats', 'readwrite')
          transaction.onerror = () => reject(transaction.error)
          transaction.oncomplete = () => {
            db.close()
            resolve()
          }
          const store = transaction.objectStore('chats')
          for (const chat of chats) store.add(chat)
        }
      }),
    chats.map((chat) => ({ ...chat, createdAt: chat.createdAt.toISOString() })),
  )
}
