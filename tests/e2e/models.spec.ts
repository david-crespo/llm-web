import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { models } from '../../src/lib/models'

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

test('only providers with a key have their models listed', async ({ page }) => {
  await setKeysThroughSettings(page, { anthropic: 'sk-ant-test', openai: 'sk-test' })
  await setKeysThroughSettings(page, { openai: '' })

  // Setting a key clears the no-keys message and enables the selector. Only
  // Anthropic still has a key, so only its models are listed.
  await expect(page.getByText(noKeysMessage)).toHaveCount(0)
  await expect(page.getByLabel('Select model')).toBeEnabled()
  const anthropicIds = models.filter((m) => m.provider === 'anthropic').map((m) => m.id)
  await expect(modelOptions(page)).toHaveText(anthropicIds)
})
