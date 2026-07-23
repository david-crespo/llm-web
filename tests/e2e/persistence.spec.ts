import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI } from './helpers/mocks'
import {
  send,
  newChat,
  selectChat,
  openSidebar,
  chatRow,
  userMessages,
  assistantMessages,
  messageInput,
} from './helpers/app'

test('stored history loads into the sidebar and stale empty chats are dropped', async ({
  page,
}) => {
  await page.goto('/settings')
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('llm-web', 1)
        request.onerror = () => reject(request.error)
        request.onupgradeneeded = () => {
          const db = request.result
          const chats = db.createObjectStore('chats', { keyPath: 'id', autoIncrement: true })
          chats.createIndex('createdAt', 'createdAt', { unique: false })
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
          const chats = transaction.objectStore('chats')
          for (let index = 0; index < 3; index += 1) {
            chats.add({
              createdAt: new Date(Date.now() - index * 1000).toISOString(),
              systemPrompt: 'test',
              messages: [{ role: 'user', content: `seed ${index}` }],
            })
          }
          // An empty chat left over from a previous page load. Even though it's
          // the newest record, it should be dropped, not shown as a duplicate
          // of this load's fresh chat.
          chats.add({
            createdAt: new Date(Date.now() + 1000).toISOString(),
            systemPrompt: 'test',
            messages: [],
          })
        }
      }),
  )

  await page.goto('/')
  await expect(messageInput(page)).toBeVisible()

  // Stored history loads asynchronously into the already-mounted sidebar,
  // behind this load's fresh chat.
  await openSidebar(page)
  await expect(chatRow(page, 'seed 0')).toBeVisible()
  await expect(chatRow(page, 'seed 2')).toBeVisible()
  await expect(chatRow(page, 'New Chat')).toHaveCount(1)
})

test('multiple chats and their messages persist across reload', async ({ page }) => {
  await mockOpenAI(page, { reply: (u) => `Re: ${u}`, auto: true })

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'one')
  await expect(assistantMessages(page)).toContainText('Re: one')
  await newChat(page)
  await send(page, 'two')
  await expect(assistantMessages(page)).toContainText('Re: two')

  await page.reload()
  // Both chats survive in history, and opening one restores its full message content.
  await openSidebar(page)
  await expect(chatRow(page, 'one')).toBeVisible()
  await expect(chatRow(page, 'two')).toBeVisible()

  await selectChat(page, 'one')
  await expect(userMessages(page)).toContainText('one')
  await expect(assistantMessages(page)).toContainText('Re: one')
})
