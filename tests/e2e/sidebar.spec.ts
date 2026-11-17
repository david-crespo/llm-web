import { test, expect, type Page } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI } from './helpers/mocks'
import { answer, savedChat, seedChats } from './helpers/history'
import { models } from '../../src/lib/models'
import {
  send,
  openSidebar,
  chatRow,
  deleteChat,
  expectPendingJobPersisted,
  sidebarRows,
  selectChat,
  userMessages,
  messageInput,
} from './helpers/app'

test('deleting a resumed pending chat cancels its provider job', async ({ page }) => {
  const openai = await mockOpenAI(page)

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'delete while pending')
  await expectPendingJobPersisted(page, 'delete while pending')

  // Count from after the reload, to leave out polls the old page had in flight.
  await page.reload()
  const pollsAfterReload = openai.polls()
  await expect.poll(openai.polls).toBeGreaterThan(pollsAfterReload)

  await deleteChat(page, 'delete while pending')

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
  expect(await sidebarRows(page).count()).toBeLessThan(30)

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

test('deleting the open chat restores the fallback chat’s toggles and scroll', async ({ page }) => {
  const id = models[0].id
  const long = answer(id, 'A paragraph of the answer.\n\n'.repeat(100))
  await seedChats(page, [
    // Newer than the chat each page load starts, so it's the fallback.
    {
      ...savedChat('fallback chat', [{ ...long, search: false }]),
      createdAt: new Date(Date.now() + 60_000),
    },
    savedChat('doomed chat', [{ ...long, search: true }]),
  ])
  await page.goto('/')
  const search = page.getByRole('button', { name: 'Search' })
  await selectChat(page, 'doomed chat')
  await expect(search).toHaveAttribute('aria-pressed', 'true')
  await page.evaluate(() => {
    const messages = document.querySelector('[aria-label="Chat messages"]')!
    messages.scrollTop = messages.scrollHeight
    window.scrollTo(0, document.documentElement.scrollHeight)
  })

  await deleteChat(page, 'doomed chat')

  await expect(userMessages(page)).toContainText('fallback chat')
  await expect(search).toHaveAttribute('aria-pressed', 'false')
  await expect
    .poll(() =>
      page.evaluate(
        () => document.querySelector('[aria-label="Chat messages"]')!.scrollTop + window.scrollY,
      ),
    )
    .toBe(0)
  await openSidebar(page)
  await expect(chatRow(page, 'fallback chat')).toBeVisible()
  await expect(chatRow(page, 'doomed chat')).toHaveCount(0)
})

test('the theme choice survives a reload', async ({ page }) => {
  await page.goto('/')
  const html = page.locator('html')
  const cycle = page.getByRole('button', { name: 'Cycle theme' })
  // Cycles system, light, dark. The test browsers' system theme is light.
  await openSidebar(page)
  await cycle.click()
  await cycle.click()
  await expect(html).toHaveClass(/dark/)

  await page.reload()
  await expect(html).toHaveClass(/dark/)
  await openSidebar(page)
  await cycle.click()
  await expect(html).not.toHaveClass(/dark/)
})

/** Drag one finger from `from` to `to` in a few steps. Playwright has no swipe
 * and WebKit has no Touch constructor, so this dispatches plain events with
 * `touches` filled in, all on the element at `from`. `press: false` continues
 * a drag started with `lift: false`. */
async function swipe(
  page: Page,
  from: [number, number],
  to: [number, number],
  { press = true, lift = true } = {},
) {
  await page.evaluate(
    ([from, to, press, lift]) => {
      const target = document.elementFromPoint(...from)!
      const fire = (type: string, [x, y]: [number, number]) => {
        const event = new Event(type, { bubbles: true, cancelable: true })
        const touches = type === 'touchend' ? [] : [{ clientX: x, clientY: y }]
        Object.defineProperty(event, 'touches', { value: touches })
        target.dispatchEvent(event)
      }
      if (press) fire('touchstart', from)
      for (let step = 1; step <= 5; step++) {
        fire('touchmove', [
          from[0] + ((to[0] - from[0]) * step) / 5,
          from[1] + ((to[1] - from[1]) * step) / 5,
        ])
      }
      if (lift) fire('touchend', to)
    },
    [from, to, press, lift] as const,
  )
}

const sidebarToggle = (page: Page) => page.getByRole('button', { name: 'Toggle sidebar' })

test.describe('swiping the mobile sidebar', () => {
  test.skip(({ hasTouch }) => !hasTouch, 'Touch only')

  test('closes by swiping left', async ({ page }) => {
    await page.goto('/')
    await expect(messageInput(page)).toBeVisible()
    await openSidebar(page)

    // Mid-drag, the drawer follows the finger.
    const { width } = (await page.locator('#mobile-sidebar').boundingBox())!
    await swipe(page, [250, 300], [150, 305], { lift: false })
    const box = await page.locator('#mobile-sidebar').boundingBox()
    expect(box!.x + box!.width).toBeCloseTo(width - 100, -1)
    await swipe(page, [150, 305], [20, 305], { press: false })
    await expect(sidebarToggle(page)).toHaveAttribute('aria-expanded', 'false')
  })

  test('does not open from the left edge, where the swipe is Back', async ({ page }) => {
    await page.goto('/')
    await expect(messageInput(page)).toBeVisible()
    await swipe(page, [5, 300], [250, 305])
    // Give a wrongly opened drawer time to show up.
    await page.waitForTimeout(300)
    await expect(sidebarToggle(page)).toHaveAttribute('aria-expanded', 'false')
  })
})
