import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI } from './helpers/mocks'
import { send, newChat, openSidebar, chatRow, assistantMessages } from './helpers/app'

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
  await page.getByRole('button', { name: 'Delete' }).click()

  await expect(chatRow(page, 'alpha')).toHaveCount(0)
  await expect(chatRow(page, 'beta')).toBeVisible()
})
