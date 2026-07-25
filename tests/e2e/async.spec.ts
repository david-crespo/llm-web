import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI, mockAnthropic, mockGoogle } from './helpers/mocks'
import {
  send,
  newChat,
  selectChat,
  selectedModel,
  selectOtherModel,
  openSidebar,
  chatRow,
  messageInput,
  responseLoadingIndicator,
  assistantMessages,
  loadingPlaceholder,
  expectPendingJobPersisted,
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

test('two concurrent requests can finish in reverse order', async ({ page }) => {
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

  await expect.poll(openai.calls).toBe(2)

  // Resolve beta first. Alpha must remain pending and must not receive beta's answer.
  openai.completeRequest('beta')
  await selectChat(page, 'beta')
  await expect(assistantMessages(page)).toContainText('Reply: beta')
  await selectChat(page, 'alpha')
  await expect(assistantMessages(page)).toHaveCount(0)
  await expect(loadingPlaceholder(page)).toBeVisible()

  openai.completeRequest('alpha')
  await expect(assistantMessages(page)).toContainText('Reply: alpha')
  expect(openai.calls()).toBe(2)
})

test('pending placeholder keeps the submitted model label', async ({ page }) => {
  await mockOpenAI(page)

  await setKeysThroughSettings(page, { openai: 'sk-test', anthropic: 'sk-ant-test' })
  const submittedModel = await selectedModel(page)
  await send(page, 'label me')
  await expect(loadingPlaceholder(page)).toContainText(submittedModel)

  const otherModel = await selectOtherModel(page)
  await expect(loadingPlaceholder(page)).toContainText(submittedModel)
  await expect(loadingPlaceholder(page)).not.toContainText(otherModel)
})

test('OpenAI background job survives a reload and lands its answer', async ({ page }) => {
  const openai = await mockOpenAI(page, { reply: (u) => `Reply: ${u}` })

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'persist me')
  await expect(loadingPlaceholder(page)).toBeVisible()
  await expectPendingJobPersisted(page, 'persist me')

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

test('Google background job survives a reload and lands its answer', async ({ page }) => {
  const google = await mockGoogle(page, { reply: (u) => `Reply: ${u}` })
  const firstPoll = page.waitForRequest(
    (request) => request.method() === 'GET' && request.url().includes('/interactions/'),
  )

  await setKeysThroughSettings(page, { google: 'gm-test' })
  await send(page, 'persist with Gemini')
  await expect(loadingPlaceholder(page)).toBeVisible()
  // The immediate placeholder can precede submission. Seeing a poll proves the
  // server handle has been persisted and is safe to resume after reload.
  await firstPoll
  await expectPendingJobPersisted(page, 'persist with Gemini')

  await page.reload()
  await openSidebar(page)
  await expect(responseLoadingIndicator(chatRow(page, 'persist with Gemini'))).toBeVisible()

  google.complete()
  await selectChat(page, 'persist with Gemini')
  await expect(assistantMessages(page)).toContainText('Reply: persist with Gemini')
  await expect(responseLoadingIndicator(chatRow(page, 'persist with Gemini'))).toHaveCount(0)
})

test('Google background job remains pending while queued', async ({ page }) => {
  const google = await mockGoogle(page, { auto: true, queuedPolls: 1 })

  await setKeysThroughSettings(page, { google: 'gm-test' })
  await send(page, 'wait in queue')

  await expect(assistantMessages(page)).toContainText('Hello from Gemini.')
  expect(google.polls()).toBeGreaterThanOrEqual(2)
})

test('OpenAI background job missing on resume becomes interrupted', async ({ page }) => {
  const openai = await mockOpenAI(page, { reply: (u) => `Reply: ${u}` })

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'expire me')
  await expect(loadingPlaceholder(page)).toBeVisible()
  await expectPendingJobPersisted(page, 'expire me')
  await expect.poll(openai.polls).toBeGreaterThan(0)

  // Arm the 404 for the resumed document only. The pre-reload loop cannot
  // satisfy this assertion accidentally.
  openai.failAfterNavigation(404)
  await page.reload()

  await selectChat(page, 'expire me')
  await expect(assistantMessages(page)).toContainText('Request interrupted')
  await expect(page.getByText('Stop: interrupted')).toBeVisible()
  await expect(responseLoadingIndicator(chatRow(page, 'expire me'))).toHaveCount(0)
})

test('durable job survives transient poll failures', async ({ page }) => {
  const openai = await mockOpenAI(page, { reply: (u) => `Reply: ${u}` })

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'retry me')
  await expectPendingJobPersisted(page, 'retry me')
  await expect.poll(openai.polls).toBeGreaterThan(0)

  const pollsBeforeFailure = openai.polls()
  // The OpenAI SDK retries twice internally. Three consecutive HTTP failures
  // exercise the app's persisted retry path rather than only the SDK's retry.
  openai.failNextPolls(3, 503)
  await expect
    .poll(openai.polls, { timeout: 10_000 })
    .toBeGreaterThanOrEqual(pollsBeforeFailure + 3)
  await expect(loadingPlaceholder(page)).toBeVisible()
  await expect(assistantMessages(page)).toHaveCount(0)

  openai.completeRequest('retry me')
  await expect(assistantMessages(page)).toContainText('Reply: retry me')
  expect(openai.calls()).toBe(1)
})

test('multiple OpenAI background jobs survive one reload', async ({ page }) => {
  const openai = await mockOpenAI(page, { reply: (u) => `Reply: ${u}` })

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'alpha')
  await expect(loadingPlaceholder(page)).toBeVisible()
  await expectPendingJobPersisted(page, 'alpha')

  await newChat(page)
  await send(page, 'beta')
  await expect(loadingPlaceholder(page)).toBeVisible()
  await expectPendingJobPersisted(page, 'beta')

  await page.reload()
  await openSidebar(page)
  await expect(responseLoadingIndicator(chatRow(page, 'alpha'))).toBeVisible()
  await expect(responseLoadingIndicator(chatRow(page, 'beta'))).toBeVisible()

  openai.complete()

  await selectChat(page, 'alpha')
  await expect(assistantMessages(page)).toContainText('Reply: alpha')
  await expect(responseLoadingIndicator(chatRow(page, 'alpha'))).toHaveCount(0)

  await selectChat(page, 'beta')
  await expect(assistantMessages(page)).toContainText('Reply: beta')
  await expect(responseLoadingIndicator(chatRow(page, 'beta'))).toHaveCount(0)
  expect(openai.calls()).toBe(2)
})

test('Anthropic request lost to a reload becomes an interrupted message', async ({ page }) => {
  // Anthropic has no server-side job, so a reload can't recover it — the handle
  // resolves to unrecoverable and the turn is marked interrupted (not silently
  // dropped), so the user can regenerate.
  await mockAnthropic(page, { text: 'Hello from Claude.' })

  await setKeysThroughSettings(page, { anthropic: 'sk-ant-test' })
  await send(page, 'lose me')
  await expect(loadingPlaceholder(page)).toBeVisible()
  await expectPendingJobPersisted(page, 'lose me')

  await page.reload()

  await selectChat(page, 'lose me')
  await expect(assistantMessages(page)).toContainText('Request interrupted')
  await expect(page.getByText('Stop: interrupted')).toBeVisible()
  // Gated until the user regenerates or forks.
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()
})
