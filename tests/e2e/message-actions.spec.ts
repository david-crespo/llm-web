import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI } from './helpers/mocks'
import {
  send,
  regenerate,
  editMessage,
  userMessages,
  assistantMessages,
  messageInput,
  selectChat,
} from './helpers/app'
import { answer, savedChat, seedChats } from './helpers/history'
import { models } from '../../src/lib/models'

test('regenerate replaces the last response in place', async ({ page }) => {
  let n = 0
  const openai = await mockOpenAI(page, { reply: () => `answer ${++n}`, auto: true })

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'q')
  await expect(assistantMessages(page)).toContainText('answer 1')

  await regenerate(page, 'q')
  await expect(assistantMessages(page)).toContainText('answer 2')
  await expect(assistantMessages(page)).toHaveCount(1)
  expect(openai.calls()).toBe(2)
})

test('a failed request gates the input until the message is edited', async ({ page }) => {
  const openai = await mockOpenAI(page)

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'oops')
  openai.fail(401)
  await expect(assistantMessages(page)).toContainText('Error:')
  await expect(page.getByText('Stop: error')).toBeVisible()
  // Input is gated until the user regens, forks, or edits.
  await expect(page.getByPlaceholder('Regen or fork to continue after error')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()

  await editMessage(page, 'oops')
  await expect(messageInput(page)).toHaveValue('oops')
  await expect(userMessages(page)).toHaveCount(0)
})

test('the message menu opens above the composer', async ({ page }) => {
  await seedChats(page, [
    savedChat('long chat', [
      answer(models[0].id, 'A paragraph of the answer.\n\n'.repeat(100)),
      { role: 'user', content: 'last question' },
    ]),
  ])
  await page.goto('/')
  await selectChat(page, 'long chat')
  await page.getByRole('button', { name: 'Jump to bottom' }).click()
  // The last bubble sits just above the composer, so a menu opening downward
  // would run into it, or on desktop be clipped by the scrolling message list.
  // Check the items are on screen before anything scrolls them into view.
  await userMessages(page)
    .filter({ hasText: 'last question' })
    .getByLabel('Message options')
    .click()
  const items = page.getByRole('menuitem')
  await expect(items.getByText('Regen')).toBeVisible()
  const viewport = page.viewportSize()!
  for (const item of await items.all()) {
    const box = (await item.boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
  }
  // Clicking an item fails if the composer is on top and takes the click.
  await page.getByRole('menuitem', { name: 'Fork' }).click()
  await expect(messageInput(page)).toHaveValue('last question')
})
