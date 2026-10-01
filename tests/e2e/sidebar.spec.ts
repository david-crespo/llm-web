import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI } from './helpers/mocks'
import { savedChat, seedChats } from './helpers/history'
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
  await seedChats(
    page,
    Array.from({ length: 105 }, (_, i) => ({
      ...savedChat(`seeded chat ${i}`),
      createdAt: new Date(Date.now() - i * 1000),
    })),
  )

  await page.goto('/')
  await openSidebar(page)
  await expect(chatRow(page, 'seeded chat 0')).toBeVisible()

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

test('sidebar previews stay on one line', async ({ page }) => {
  const previews = [
    '<pasted>\n' + 'Line\u2028Paragraph\u2029'.repeat(5) + '\n</pasted>',
    '<pasted>\n' + 'x'.repeat(10000) + '\n</pasted>\n\nExplain this',
  ]
  await seedChats(
    page,
    previews.map((preview) => savedChat(preview)),
  )
  await page.goto('/')
  await openSidebar(page)
  const history = page.getByRole('region', { name: 'Chat history' })
  for (const preview of previews) {
    const row = chatRow(page, preview)
    await expect(row).toBeVisible()
    const sizes = await row.evaluate((row) => ({
      width: row.clientWidth,
      scrollWidth: row.scrollWidth,
      height: row.clientHeight,
      scrollHeight: row.scrollHeight,
    }))
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.width)
    expect(sizes.scrollHeight).toBeLessThanOrEqual(sizes.height)
  }
  expect(await history.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
})
