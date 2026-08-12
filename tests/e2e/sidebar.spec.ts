import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI } from './helpers/mocks'
import {
  send,
  newChat,
  openSidebar,
  chatRow,
  assistantMessages,
  expectPendingJobPersisted,
  sidebarRows,
} from './helpers/app'

test('create, then delete a chat via the confirm dialog', async ({ page }) => {
  await mockOpenAI(page, { reply: (u) => `Re: ${u}`, auto: true })

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'alpha')
  await expect(assistantMessages(page)).toContainText('Re: alpha')
  await newChat(page)
  await send(page, 'beta')
  await expect(assistantMessages(page)).toContainText('Re: beta')

  // Delete the non-active 'alpha' chat.
  await openSidebar(page)
  await chatRow(page, 'alpha').getByLabel('Chat menu').click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(chatRow(page, 'alpha')).toHaveCount(0)
  await expect(chatRow(page, 'beta')).toBeVisible()
})

test('deleting a resumed pending chat cancels its provider job', async ({ page }) => {
  const openai = await mockOpenAI(page)

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'delete while pending')
  await expectPendingJobPersisted(page, 'delete while pending')
  const pollsBeforeReload = openai.polls()

  await page.reload()
  await expect.poll(openai.polls).toBeGreaterThan(pollsBeforeReload)

  await openSidebar(page)
  await chatRow(page, 'delete while pending').getByLabel('Chat menu').click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()

  await expect(chatRow(page, 'delete while pending')).toHaveCount(0)
  await expect.poll(openai.cancels).toBe(1)
})

test('large histories are virtualized to bound the rendered sidebar', async ({ page }) => {
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
          const store = transaction.objectStore('chats')
          for (let i = 0; i < 105; i++) {
            store.add({
              createdAt: new Date(Date.now() - i * 1000).toISOString(),
              systemPrompt: 'test',
              messages: [{ role: 'user', content: `seeded chat ${i}` }],
            })
          }
        }
      }),
  )

  await page.goto('/')
  await openSidebar(page)

  // Only the visible rows plus a small overscan are mounted, while every chat
  // remains reachable through one continuous scroll area.
  await expect(sidebarRows(page)).not.toHaveCount(106)
  expect(await sidebarRows(page).count()).toBeLessThan(30)
  await expect(sidebarRows(page).first()).toHaveCSS('height', '68px')

  const history = page.getByRole('region', { name: 'Chat history' })
  await history.evaluate((element) => (element.scrollTop = element.scrollHeight))
  await expect(chatRow(page, 'seeded chat 104')).toBeVisible()
  expect(await sidebarRows(page).count()).toBeLessThan(30)
})
