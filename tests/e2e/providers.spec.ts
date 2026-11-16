import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { models } from '../../src/lib/models'
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
  await selectModel(page, models.find((m) => m.provider === 'anthropic')!.id)
  await send(page, 'Hi')
  await expect(loadingPlaceholder(page)).toBeVisible()

  anthropic.complete()
  await expect(assistantMessages(page)).toContainText('Hello from Claude.')
  // Reasoning (from Anthropic `thinking` blocks) is collapsed until expanded.
  await expectReasoning(page, 'Thinking about the greeting.')
  expect(anthropic.calls()).toBe(1)
  const tools = anthropic.bodies()[0]?.tools as { name: string }[]
  expect(tools.map((tool) => tool.name)).toEqual(['web_search', 'web_fetch', 'code_execution'])
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
