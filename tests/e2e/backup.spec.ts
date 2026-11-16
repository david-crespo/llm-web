import { readFile, writeFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI } from './helpers/mocks'
import {
  send,
  newChat,
  openSidebar,
  chatRow,
  selectChat,
  assistantMessages,
  messageInput,
} from './helpers/app'

type Shared = { name: string; text: string }

// Phones get the share sheet, which headless WebKit can't show, so record what
// would have been shared. Call before the first navigation.
async function recordShares(page: Page) {
  await page.addInitScript(() => {
    navigator.share = async (data) => {
      const file = data?.files?.[0]
      ;(window as unknown as { shared?: Shared }).shared = file && {
        name: file.name,
        text: await file.text(),
      }
    }
  })
}

/** Trigger Export on the settings page (via share sheet or download), save to
 * `path`, and return the JSON string. */
async function exportChats(page: Page, path: string): Promise<string> {
  const share = await page.evaluate(
    () => matchMedia('(pointer: coarse)').matches && 'canShare' in navigator,
  )
  let file: Shared
  if (share) {
    await page.evaluate(() => delete (window as unknown as { shared?: Shared }).shared)
    await page.getByRole('button', { name: 'Export' }).click()
    const handle = await page.waitForFunction(
      () => (window as unknown as { shared?: Shared }).shared,
    )
    file = (await handle.jsonValue()) as Shared
  } else {
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export' }).click()
    const download = await downloadPromise
    file = {
      name: download.suggestedFilename(),
      text: await readFile(await download.path(), 'utf8'),
    }
  }
  expect(file.name).toMatch(/^llm-web-chats-\d{4}-\d{2}-\d{2}\.json$/)
  await writeFile(path, file.text)
  return file.text
}

async function openSettings(page: Page) {
  await openSidebar(page)
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
}

async function importChats(page: Page, path: string, status: string) {
  await page.locator('input[type=file]').setInputFiles(path)
  await expect(page.getByText(status)).toBeVisible()
}

// The point of export/import is moving history into a home-screen install,
// which on iOS has its own storage: a fresh browser context stands in for it.
// Pages are reached by links, not page loads, so imports have to merge into
// the history the chat page already holds in memory.
test('exports chats to a fresh browser without API keys', async ({ page, browser }, testInfo) => {
  await recordShares(page)
  await mockOpenAI(page, { reply: (u) => `Re: ${u}`, auto: true })
  await setKeysThroughSettings(page, { openai: 'sk-secret-key' })
  await send(page, 'first chat')
  await expect(assistantMessages(page)).toContainText('Re: first chat')
  await newChat(page)
  await send(page, 'second chat')
  await expect(assistantMessages(page)).toContainText('Re: second chat')

  await openSettings(page)
  const path = testInfo.outputPath('export.json')
  const json = await exportChats(page, path)
  expect(json).toContain('first chat')
  expect(json).not.toContain('sk-secret-key')

  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const fresh = await context.newPage()
  await fresh.goto('/')
  await expect(messageInput(fresh)).toBeVisible()
  await openSettings(fresh)
  await importChats(fresh, path, 'Added 2 chats.')
  await importChats(fresh, path, 'Added 0 chats, 2 already up to date.')
  await fresh.getByRole('link', { name: /Back to Chat/ }).click()
  await openSidebar(fresh)
  await expect(chatRow(fresh, 'first chat')).toHaveCount(1)
  await expect(chatRow(fresh, 'second chat')).toHaveCount(1)

  // A chat continued in the old browser after the first move comes over
  // with its new messages on the next one.
  await page.getByRole('link', { name: /Back to Chat/ }).click()
  await selectChat(page, 'first chat')
  await send(page, 'follow-up')
  await expect(assistantMessages(page)).toHaveCount(2)
  await openSettings(page)
  await exportChats(page, path)
  await openSettings(fresh)
  await importChats(
    fresh,
    path,
    'Added 0 chats, updated 1 with newer messages, 1 already up to date.',
  )
  await fresh.getByRole('link', { name: /Back to Chat/ }).click()
  await selectChat(fresh, 'first chat')
  await expect(assistantMessages(fresh)).toHaveCount(2)
  await expect(assistantMessages(fresh).last()).toContainText('Re: follow-up')
  await context.close()
})

test('shows a retry message instead of downloading when the share sheet fails', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.share = () => Promise.reject(new DOMException('No activation', 'NotAllowedError'))
  })
  await page.goto('/settings')
  test.skip(
    !(await page.evaluate(
      () => matchMedia('(pointer: coarse)').matches && 'canShare' in navigator,
    )),
    'Only phones export through the share sheet',
  )
  await page.getByRole('button', { name: 'Export' }).click()
  await expect(page.getByText("Couldn't open the share sheet. Tap Export again.")).toBeVisible()
})

test('import reports a file that is not an export', async ({ page }) => {
  await page.goto('/settings')
  await page.locator('input[type=file]').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello": 1}'),
  })
  await expect(page.getByText('This file is not an llm-web chat export.')).toBeVisible()
})

test('deleting all chats requires typed confirmation and keeps API keys', async ({ page }) => {
  await mockOpenAI(page, { reply: (u) => `Re: ${u}`, auto: true })
  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'doomed chat')
  await expect(assistantMessages(page)).toContainText('Re: doomed chat')

  await page.goto('/settings')
  await page.getByRole('button', { name: 'Delete all chats…' }).click()
  await expect(page.getByText('permanently deletes all 1 chat in this browser')).toBeVisible()
  const confirm = page.getByRole('button', { name: 'Delete all chats', exact: true })
  await expect(confirm).toBeDisabled()
  await page.getByLabel('Type delete to confirm').fill('delete')
  await confirm.click()

  await expect(messageInput(page)).toBeVisible()
  await openSidebar(page)
  await expect(chatRow(page, 'doomed chat')).toHaveCount(0)
  await page.goto('/settings')
  await expect(page.getByLabel('OpenAI')).toHaveValue('sk-test')
})

test('delete all says so when there are no chats', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Delete all chats…' }).click()
  await expect(page.getByText('There are no chats to delete.')).toBeVisible()
  await expect(page.getByLabel('Type delete to confirm')).toHaveCount(0)
})

test('delete all is disabled while an answer is in progress', async ({ page }) => {
  await mockOpenAI(page)
  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'still thinking')
  await openSettings(page)
  await page.getByRole('button', { name: 'Delete all chats…' }).click()
  await expect(page.getByText('1 chat has an answer in progress')).toBeVisible()
  await page.getByLabel('Type delete to confirm').fill('delete')
  await expect(page.getByRole('button', { name: 'Delete all chats', exact: true })).toBeDisabled()
})

// The Linux WebKit build Playwright uses in CI has no `navigator.storage` at
// all, unlike the macOS build, so the settings page has to survive its absence.
test('settings page renders without navigator.storage', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'storage', { value: undefined, configurable: true })
  })
  await page.goto('/settings')

  await expect(page.getByLabel('OpenAI')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText('used of')).toHaveCount(0)
})
