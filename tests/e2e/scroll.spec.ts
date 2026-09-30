import { test, expect } from '@playwright/test'
import { models } from '../../src/lib/models'
import { answer, savedChat, seedChats } from './helpers/history'
import { newChat, selectChat, messageInput } from './helpers/app'

test('jump to bottom follows scrolling and content resizing', async ({ page }) => {
  await seedChats(page, [
    savedChat('long chat', [
      answer(models[0].id, 'A paragraph of the answer.\n\n'.repeat(100)),
      { role: 'user', content: 'Follow up' },
      { ...answer(models[0].id), reasoning: 'A paragraph of reasoning.\n\n'.repeat(30) },
    ]),
  ])
  await page.goto('/')
  const jump = page.getByRole('button', { name: 'Jump to bottom' })
  await expect(jump).toBeHidden()
  await selectChat(page, 'long chat')
  await expect(jump).toBeVisible()
  const input = messageInput(page)
  const buttonBox = await jump.boundingBox()
  const inputBox = await input.boundingBox()
  expect(buttonBox!.y + buttonBox!.height).toBeLessThan(inputBox!.y)
  await jump.click()
  await expect(jump).toBeHidden()

  const scroll = async (bottom: boolean) =>
    page.evaluate((bottom) => {
      const messages = document.querySelector('[aria-label="Chat messages"]')!
      if (window.matchMedia('(min-width: 768px)').matches)
        messages.scrollTop = bottom ? messages.scrollHeight : 0
      else window.scrollTo(0, bottom ? document.documentElement.scrollHeight : 0)
    }, bottom)
  await scroll(false)
  await expect(jump).toBeVisible()
  await scroll(true)
  await expect(jump).toBeHidden()

  // Expanding reasoning adds content without a scroll event.
  await page.getByText('Reasoning', { exact: true }).click()
  await expect(jump).toBeVisible()
  await jump.click()
  await expect(jump).toBeHidden()
  await newChat(page)
  await expect(jump).toBeHidden()
})
