import { test, expect, type Page } from '@playwright/test'
import { models } from '../../src/lib/models'
import { answer, savedChat, seedChats } from './helpers/history'
import { newChat, selectChat, messageInput, openSidebar, userMessages } from './helpers/app'

// Desktop scrolls the message list; mobile scrolls the document.
const scrollTop = (page: Page) =>
  page.evaluate(() =>
    window.matchMedia('(min-width: 768px)').matches
      ? document.querySelector('[aria-label="Chat messages"]')!.scrollTop
      : window.scrollY,
  )

const scrollTo = (page: Page, top: number | 'bottom') =>
  page.evaluate((top) => {
    const messages = document.querySelector('[aria-label="Chat messages"]')!
    if (window.matchMedia('(min-width: 768px)').matches)
      messages.scrollTop = top === 'bottom' ? messages.scrollHeight : top
    else window.scrollTo(0, top === 'bottom' ? document.documentElement.scrollHeight : top)
  }, top)

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

  await scrollTo(page, 0)
  await expect(jump).toBeVisible()
  await scrollTo(page, 'bottom')
  await expect(jump).toBeHidden()

  // Expanding reasoning adds content without a scroll event.
  await page.getByText('Reasoning', { exact: true }).click()
  await expect(jump).toBeVisible()
  await jump.click()
  await expect(jump).toBeHidden()
  await newChat(page)
  await expect(jump).toBeHidden()
})

test('switching chats restores each chat’s scroll position, across reloads', async ({ page }) => {
  const longAnswer = answer(models[0].id, 'A paragraph of the answer.\n\n'.repeat(100))
  const longChat = (preview: string) =>
    savedChat(preview, [longAnswer, { role: 'user', content: 'Follow up' }, longAnswer])
  await seedChats(page, [longChat('first chat'), longChat('second chat')])
  await page.goto('/')

  await selectChat(page, 'first chat')
  await scrollTo(page, 1000)
  // A chat with no saved position opens at the top. Wait for that before
  // scrolling so the restore doesn't land after it.
  await selectChat(page, 'second chat')
  await expect.poll(() => scrollTop(page)).toBe(0)
  await scrollTo(page, 2000)
  await selectChat(page, 'first chat')
  await expect.poll(() => scrollTop(page)).toBe(1000)
  await selectChat(page, 'second chat')
  await expect.poll(() => scrollTop(page)).toBe(2000)
  await scrollTo(page, 2500)
  await selectChat(page, 'second chat')
  await expect.poll(() => scrollTop(page)).toBe(2500)

  // Reloading right after scrolling, without switching chats first, reopens
  // the chat where it was.
  await page.reload()
  await expect(userMessages(page)).toHaveCount(2)
  await expect.poll(() => scrollTop(page)).toBe(2500)
  await selectChat(page, 'first chat')
  await expect.poll(() => scrollTop(page)).toBe(1000)
  await selectChat(page, 'second chat')
  await expect.poll(() => scrollTop(page)).toBe(2500)

  // Visiting settings remounts the message list.
  await openSidebar(page)
  await page.getByRole('link', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await page.getByRole('link', { name: /Back to Chat/ }).click()
  await expect(page).toHaveURL(/\/\?chat=\d+$/)
  await expect.poll(() => scrollTop(page)).toBe(2500)
})

test('a scroll clamped by a chat switch isn’t saved as the new chat’s offset', async ({ page }) => {
  const paragraphs = (n: number) => answer(models[0].id, 'A paragraph of the answer.\n\n'.repeat(n))
  await seedChats(page, [
    savedChat('long chat', [paragraphs(100)]),
    savedChat('shorter chat', [paragraphs(50)]),
  ])
  await page.goto('/')

  await selectChat(page, 'long chat')
  await scrollTo(page, 'bottom')
  await openSidebar(page)
  // Switch to the shorter chat, whose content clamps the long chat's offset,
  // and away again in the next frame, after its restore has run but before
  // the scroll event the restore causes. If the restore's timing changes, the
  // second click misses that window and this test passes without checking
  // anything, so revisit it when touching restoreScroll.
  await page.evaluate(() => {
    const row = (name: string) =>
      document.querySelector<HTMLElement>(`[aria-label="Select chat: ${name}"]`)!
    row('shorter chat').click()
    requestAnimationFrame(() => row('long chat').click())
  })
  await expect(userMessages(page)).toContainText('long chat')
  await selectChat(page, 'shorter chat')
  await expect.poll(() => scrollTop(page)).toBe(0)
})
