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
} from './helpers/app'

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
