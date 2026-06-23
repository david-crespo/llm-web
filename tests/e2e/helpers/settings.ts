import { expect, type Page } from '@playwright/test'

const KEY_LABELS = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Gemini',
} as const

type Provider = keyof typeof KEY_LABELS

export async function setKeysThroughSettings(
  page: Page,
  keys: Partial<Record<Provider, string>>,
): Promise<void> {
  await page.goto('/settings')

  for (const provider of Object.keys(KEY_LABELS) as Provider[]) {
    const value = keys[provider]
    if (value === undefined) continue

    const input = page.getByLabel(KEY_LABELS[provider])
    await input.fill(value)
    await expect(input).toHaveValue(value)
  }

  await page.getByRole('link', { name: /Back to Chat/ }).click()
  await expect(page).toHaveURL(/\/$/)
}
