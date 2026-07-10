import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'

const noKeysMessage = /set an OpenAI, Anthropic, or Gemini API key/
const modelOptions = (page: import('@playwright/test').Page) =>
  page.getByLabel('Select model').locator('option')

test('no keys: shows the no-keys message and a disabled selector', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText(noKeysMessage)).toBeVisible()
  const select = page.getByLabel('Select model')
  await expect(select).toBeDisabled()
  await expect(select).toContainText('No API keys')
})

test('anthropic key: shows both Claude models and nothing else', async ({ page }) => {
  await setKeysThroughSettings(page, { anthropic: 'sk-ant-test' })

  // Setting a key clears the no-keys message and enables the selector, and only
  // the keyed provider's models are offered (no OpenAI/Gemini leakage).
  await expect(page.getByText(noKeysMessage)).toHaveCount(0)
  await expect(page.getByLabel('Select model')).toBeEnabled()
  await expect(modelOptions(page)).toHaveText(['Claude Opus 4.8', 'Claude Fable 5'])
})

test('all keys: every model is listed in order', async ({ page }) => {
  await setKeysThroughSettings(page, { openai: 'a', anthropic: 'b', google: 'c' })

  await expect(modelOptions(page)).toHaveText([
    'GPT-5.6',
    'Gemini 3.5 Flash',
    'Claude Opus 4.8',
    'Claude Fable 5',
  ])
})
