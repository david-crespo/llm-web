import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI, mockAnthropic, mockGoogle } from './helpers/mocks'
import {
  send,
  selectModel,
  assistantMessages,
  loadingPlaceholder,
  expectReasoning,
} from './helpers/app'

// Doubles as the model-routing test: all keys set + all providers mocked, so the
// picked model is the only thing steering the request to one provider.
test('Anthropic happy path with reasoning', async ({ page }) => {
  const anthropic = await mockAnthropic(page, {
    text: 'Hello from Claude.',
    reasoning: 'Thinking about the greeting.',
  })
  const openai = await mockOpenAI(page)
  const google = await mockGoogle(page)

  await setKeysThroughSettings(page, { openai: 'a', anthropic: 'b', google: 'c' })
  await selectModel(page, 'Claude Opus 4.8')
  await send(page, 'Hi')
  await expect(loadingPlaceholder(page)).toBeVisible()

  anthropic.complete()
  await expect(assistantMessages(page)).toContainText('Hello from Claude.')
  // Reasoning (from Anthropic `thinking` blocks) is collapsed until expanded.
  await expectReasoning(page, 'Thinking about the greeting.')
  expect(anthropic.calls()).toBe(1)
  expect(anthropic.bodies()[0]?.tools).toEqual([
    { type: 'web_search_20260318', name: 'web_search', max_uses: 5 },
    { type: 'web_fetch_20260318', name: 'web_fetch' },
    { type: 'code_execution_20260120', name: 'code_execution' },
  ])
  expect(openai.calls()).toBe(0)
  expect(google.calls()).toBe(0)
})

// Provider routing is covered by the Anthropic test above; this one exists for
// Gemini's distinct reasoning shape (`thought: true` parts), so a single key.
test('Google happy path with reasoning', async ({ page }) => {
  const google = await mockGoogle(page, {
    text: 'Hello from Gemini.',
    reasoning: 'Pondering the greeting.',
  })
  let createHeaders: Record<string, string> | undefined
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/interactions')) {
      createHeaders = request.headers()
    }
  })

  await setKeysThroughSettings(page, { google: 'gm-test' })
  await send(page, 'Hi')
  google.complete()
  await expect(assistantMessages(page)).toContainText('Hello from Gemini.')
  await expectReasoning(page, 'Pondering the greeting.')
  expect(google.calls()).toBe(1)
  // @google/genai 2.11 removed this header because it failed browser CORS
  // preflights: https://github.com/googleapis/js-genai/issues/1723
  expect(createHeaders).not.toHaveProperty('api-revision')
})

test('error path: failed request shows error and disables input', async ({ page }) => {
  const anthropic = await mockAnthropic(page)

  await setKeysThroughSettings(page, { anthropic: 'sk-ant-test' })
  await send(page, 'Hi')
  anthropic.fail(401)

  await expect(assistantMessages(page)).toContainText('Error:')
  // Header surfaces the non-terminal stop reason.
  await expect(page.getByText('Stop: error')).toBeVisible()
  // Input is gated until the user regens or forks.
  await expect(page.getByPlaceholder('Regen or fork to continue after error')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()
})
