import { test, expect } from '@playwright/test'

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

test('settings page shows storage usage when the API exists', async ({ page }) => {
  await page.goto('/settings')

  await expect(page.getByText(/MB used of .* GB quota/)).toBeVisible()
})
