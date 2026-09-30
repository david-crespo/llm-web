import type { Page } from '@playwright/test'
import type { AssistantMessage, NewChat } from '../../../src/lib/types'
import { messageInput } from './app'

export const answer = (model: string, content = 'Answer'): AssistantMessage => ({
  role: 'assistant',
  model,
  content,
  tokens: { input: 1, output: 1 },
  stop_reason: 'completed',
  timeMs: 0,
  cost: 0,
})

export const savedChat = (preview: string, messages: NewChat['messages'] = []): NewChat => ({
  createdAt: new Date(),
  systemPrompt: 'test',
  messages: [{ role: 'user', content: preview }, ...messages],
})

/** Seed saved chats without making provider requests. Boots the app first so
 * it creates the database; callers navigate again to load the seeded history. */
export async function seedChats(page: Page, chats: NewChat[]): Promise<void> {
  await page.goto('/')
  await messageInput(page).waitFor()
  await page.evaluate(
    (chats) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('llm-web')
        request.onerror = () => reject(request.error)
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
