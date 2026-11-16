import { test, expect } from '@playwright/test'
import { models } from '../../src/lib/models'
import { answer, savedChat, seedChats } from './helpers/history'
import { assistantMessages, selectChat } from './helpers/app'

// Model output renders as HTML on the same origin as the API keys in
// localStorage, so sanitization is tested in a real page.
test('an answer renders code, math, and links, and drops scripts', async ({ page }) => {
  const content = [
    'A [safe link](https://example.com/page) and an [unsafe link](javascript:window.pwned=1).',
    '<script>window.pwned = 1</script><img src="/missing.png" onerror="window.pwned = 1">',
    '```ts\nconst x: number = 1\n```',
    'Inline math \\(x^2\\).',
  ].join('\n\n')
  await seedChats(page, [savedChat('render me', [answer(models[0].id, content)])])
  await page.goto('/')
  await selectChat(page, 'render me')
  const msg = assistantMessages(page)

  await expect(msg.locator('pre code.hljs span[class^="hljs-"]').first()).toBeVisible()
  await expect(msg.locator('math')).toHaveCount(1)
  const link = msg.getByRole('link', { name: 'safe link', exact: true })
  await expect(link).toHaveAttribute('href', 'https://example.com/page')
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer')

  // Seeing the unsafe link's text shows the markdown has rendered, so anything
  // absent was stripped.
  await expect(msg.getByText('unsafe link', { exact: true })).toBeVisible()
  await expect(msg.locator('script, [onerror], [href^="javascript:" i]')).toHaveCount(0)
  expect(await page.evaluate(() => 'pwned' in window)).toBe(false)
})
