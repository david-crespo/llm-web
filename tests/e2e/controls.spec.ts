import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockAnthropic, mockOpenAI } from './helpers/mocks'
import {
  send,
  newChat,
  assistantMessages,
  loadingPlaceholder,
  selectChat,
  selectModel,
} from './helpers/app'
import { models } from '../../src/lib/models'

test('Search and Think toggles affect the next request', async ({ page }) => {
  const openai = await mockOpenAI(page, { auto: true })
  await setKeysThroughSettings(page, { openai: 'sk-test' })

  const search = page.getByRole('button', { name: 'Search' })
  const think = page.getByRole('button', { name: 'Think' })

  await expect(search).toHaveAttribute('aria-pressed', 'true')
  await expect(think).toHaveAttribute('aria-pressed', 'false')

  await send(page, 'defaults')
  await expect(assistantMessages(page)).toContainText('Hello from GPT-6 Sol.')

  await newChat(page)
  await search.click()
  await think.click()

  await expect(search).toHaveAttribute('aria-pressed', 'false')
  await expect(think).toHaveAttribute('aria-pressed', 'true')

  await send(page, 'changed')
  await expect(assistantMessages(page)).toContainText('Hello from GPT-6 Sol.')

  const [defaults, changed] = openai.bodies()
  expect(defaults.model).toBe('gpt-6-sol')
  expect(defaults.tools).toEqual([{ type: 'web_search_preview' }])
  expect(defaults.reasoning).toEqual({ effort: 'low' })
  expect(changed.tools).toBeUndefined()
  expect(changed.reasoning).toEqual({ effort: 'high' })
})

test('Anthropic: toggling Think mid-chat keeps top-level effort fixed', async ({ page }) => {
  const anthropic = await mockAnthropic(page, { auto: true })
  const betaHeaders: (string | null)[] = []
  page.on('request', (req) => {
    if (req.url().startsWith('https://api.anthropic.com/v1/messages') && req.method() === 'POST')
      betaHeaders.push(req.headers()['anthropic-beta'] ?? null)
  })
  await setKeysThroughSettings(page, { anthropic: 'sk-ant-test' })
  await selectModel(page, models.find((m) => m.provider === 'anthropic')!.id)
  const think = page.getByRole('button', { name: 'Think' })

  await send(page, 'one')
  await expect(assistantMessages(page)).toHaveCount(1)
  await think.click()
  await send(page, 'two')
  await expect(assistantMessages(page)).toHaveCount(2)
  await think.click()
  await send(page, 'three')
  await expect(assistantMessages(page)).toHaveCount(3)

  const bodies = anthropic.bodies()
  expect(bodies.map((b) => b.output_config)).toEqual([
    { effort: 'low' },
    { effort: 'low' },
    { effort: 'low' },
  ])
  const effortChange = (effort: string) => ({
    role: 'system',
    content: [],
    output_config: { effort },
  })
  // Each request replays the previous one's messages unchanged, then extends.
  expect(bodies[2]?.messages).toEqual([
    { role: 'user', content: 'one' },
    { role: 'assistant', content: 'Hello from Claude.' },
    effortChange('high'),
    { role: 'user', content: 'two' },
    { role: 'assistant', content: 'Hello from Claude.' },
    effortChange('low'),
    { role: 'user', content: 'three' },
  ])
  expect(betaHeaders).toHaveLength(3)
  for (const header of betaHeaders)
    expect(header).toContain('mid-conversation-output-config-2026-07-01')
})

test('OpenAI: Think changes preserve the response chain across reloads', async ({ page }) => {
  const openai = await mockOpenAI(page, { auto: true })
  await setKeysThroughSettings(page, { openai: 'sk-test' })
  const think = page.getByRole('button', { name: 'Think' })

  await send(page, 'one')
  await expect(assistantMessages(page)).toHaveCount(1)
  await think.click()
  await send(page, 'two')
  await expect(assistantMessages(page)).toHaveCount(2)
  await send(page, 'three')
  await expect(assistantMessages(page)).toHaveCount(3)

  // Reload resets Think to off; the response's original effort and the last
  // user turn's applied effort must both survive in stored history.
  // Creating a new chat waits for the current chat's save before switching.
  await newChat(page)
  await expect(assistantMessages(page)).toHaveCount(0)
  await page.reload()
  await selectChat(page, 'one')
  await expect(think).toHaveAttribute('aria-pressed', 'false')
  await send(page, 'four')
  await expect(assistantMessages(page)).toHaveCount(4)

  const bodies = openai.bodies()
  expect(bodies.map((body) => body.reasoning)).toEqual(
    Array.from({ length: 4 }, () => ({ effort: 'low' })),
  )
  expect(bodies.map((body) => body.previous_response_id)).toEqual([
    undefined,
    'resp_test_openai_1',
    'resp_test_openai_2',
    'resp_test_openai_3',
  ])
  expect(bodies.map((body) => body.input)).toEqual([
    [{ role: 'user', content: 'one' }],
    [
      { type: 'configuration_update', reasoning: { effort: 'high' } },
      { role: 'user', content: 'two' },
    ],
    [{ role: 'user', content: 'three' }],
    [
      { type: 'configuration_update', reasoning: { effort: 'low' } },
      { role: 'user', content: 'four' },
    ],
  ])
})

test('Stop cancels an in-flight response and gates the input', async ({ page }) => {
  const openai = await mockOpenAI(page)
  await setKeysThroughSettings(page, { openai: 'sk-test' })

  await send(page, 'stop this')
  await expect(loadingPlaceholder(page)).toBeVisible()

  await page.getByRole('button', { name: 'Stop', exact: true }).click()

  await expect(loadingPlaceholder(page)).toHaveCount(0)
  await expect(assistantMessages(page)).toContainText('Stopped by user')
  await expect(page.getByText('Stop: stopped')).toBeVisible()
  await expect(page.getByPlaceholder('Regen or fork to continue after error')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()
  await expect.poll(openai.cancels).toBe(1)
})
