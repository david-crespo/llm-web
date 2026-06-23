import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI, mockAnthropic } from './helpers/mocks'
import {
  send,
  newChat,
  selectChat,
  openSidebar,
  chatRow,
  messageInput,
  responseLoadingIndicator,
  assistantMessages,
  loadingPlaceholder,
} from './helpers/app'

test('switch chats while a request runs; loading shows in sidebar', async ({ page }) => {
  const openai = await mockOpenAI(page, { reply: (u) => `Reply: ${u}` })

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'first')
  await expect(loadingPlaceholder(page)).toBeVisible()

  // Start a new chat while 'first' is still in flight.
  await newChat(page)
  await expect(messageInput(page)).toBeEnabled()
  await expect(loadingPlaceholder(page)).toHaveCount(0)

  // The still-running chat shows a loading dot in the sidebar.
  await openSidebar(page)
  await expect(responseLoadingIndicator(chatRow(page, 'first'))).toBeVisible()

  // Completing the in-flight request lands its answer in the right chat.
  openai.complete()
  await selectChat(page, 'first')
  await expect(assistantMessages(page)).toContainText('Reply: first')
  await expect(responseLoadingIndicator(chatRow(page, 'first'))).toHaveCount(0)
})

test('two concurrent requests resolve into their own chats', async ({ page }) => {
  const openai = await mockOpenAI(page, { reply: (u) => `Reply: ${u}` })

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'alpha')
  await expect(loadingPlaceholder(page)).toBeVisible()

  await newChat(page)
  await send(page, 'beta')
  await expect(loadingPlaceholder(page)).toBeVisible()

  // Both chats show as loading at once.
  await openSidebar(page)
  await expect(responseLoadingIndicator(chatRow(page, 'alpha'))).toBeVisible()
  await expect(responseLoadingIndicator(chatRow(page, 'beta'))).toBeVisible()

  // Release both; each chat gets its own reply (correct attribution).
  openai.complete()
  await selectChat(page, 'alpha')
  await expect(assistantMessages(page)).toContainText('Reply: alpha')
  await selectChat(page, 'beta')
  await expect(assistantMessages(page)).toContainText('Reply: beta')
  expect(openai.calls()).toBe(2)
})

test('OpenAI background job survives a reload and lands its answer', async ({ page }) => {
  const openai = await mockOpenAI(page, { reply: (u) => `Reply: ${u}` })

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'persist me')
  await expect(loadingPlaceholder(page)).toBeVisible()

  // Reload while the job is still running server-side (not completed yet). The
  // persisted handle means boot re-polls instead of discarding the request.
  await page.reload()

  // The chat is still shown as loading in the sidebar after reload.
  await openSidebar(page)
  await expect(responseLoadingIndicator(chatRow(page, 'persist me'))).toBeVisible()

  // Completing the job now lands the answer via the resumed poll loop.
  openai.complete()
  await selectChat(page, 'persist me')
  await expect(assistantMessages(page)).toContainText('Reply: persist me')
  await expect(responseLoadingIndicator(chatRow(page, 'persist me'))).toHaveCount(0)
})

test('Anthropic request lost to a reload becomes an interrupted message', async ({ page }) => {
  // Anthropic has no server-side job, so a reload can't recover it — the handle
  // resolves to unrecoverable and the turn is marked interrupted (not silently
  // dropped), so the user can regenerate.
  await mockAnthropic(page, { text: 'Hello from Claude.' })

  await setKeysThroughSettings(page, { anthropic: 'sk-ant-test' })
  await send(page, 'lose me')
  await expect(loadingPlaceholder(page)).toBeVisible()

  await page.reload()

  await selectChat(page, 'lose me')
  await expect(assistantMessages(page)).toContainText('Request interrupted')
  await expect(page.getByText('Stop: interrupted')).toBeVisible()
  // Gated until the user regenerates or forks.
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()
})
