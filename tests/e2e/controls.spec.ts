import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI } from './helpers/mocks'
import { send, newChat, assistantMessages, loadingPlaceholder } from './helpers/app'

test('Search and Think toggles affect the next request', async ({ page }) => {
  const openai = await mockOpenAI(page, { auto: true })
  await setKeysThroughSettings(page, { openai: 'sk-test' })

  const search = page.getByRole('button', { name: 'Search' })
  const think = page.getByRole('button', { name: 'Think' })

  await expect(search).toHaveAttribute('aria-pressed', 'true')
  await expect(think).toHaveAttribute('aria-pressed', 'false')

  await send(page, 'defaults')
  await expect(assistantMessages(page)).toContainText('Hello from GPT-5.6.')

  await newChat(page)
  await search.click()
  await think.click()

  await expect(search).toHaveAttribute('aria-pressed', 'false')
  await expect(think).toHaveAttribute('aria-pressed', 'true')

  await send(page, 'changed')
  await expect(assistantMessages(page)).toContainText('Hello from GPT-5.6.')

  const [defaults, changed] = openai.bodies()
  expect(defaults.model).toBe('gpt-5.6')
  expect(defaults.tools).toEqual([{ type: 'web_search_preview' }])
  expect(defaults.reasoning).toEqual({ effort: 'low' })
  expect(changed.tools).toBeUndefined()
  expect(changed.reasoning).toEqual({ effort: 'high' })
})

test('Stop cancels an in-flight response and gates the input', async ({ page }) => {
  await mockOpenAI(page)
  await setKeysThroughSettings(page, { openai: 'sk-test' })

  await send(page, 'stop this')
  await expect(loadingPlaceholder(page)).toBeVisible()

  await page.getByRole('button', { name: 'Stop', exact: true }).click()

  await expect(loadingPlaceholder(page)).toHaveCount(0)
  await expect(assistantMessages(page)).toContainText('Stopped by user')
  await expect(page.getByText('Stop: stopped')).toBeVisible()
  await expect(page.getByPlaceholder('Regen or fork to continue after error')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()
})
