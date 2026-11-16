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

// Raw HTML in model output, e.g. from a prompt-injected search result, must
// not be able to draw over the app or restyle it, while Temml's own inline
// math styles still apply.
test('strips app classes and layout styles from model HTML while preserving math styles', async ({
  page,
}) => {
  const content = [
    '<div class="fixed inset-0 z-50 hljs" id="overlay" style="position:fixed;inset:0">Overlay</div>',
    '<math style="position:fixed;color:red"><mi>y</mi></math>',
    'Colored \\(\\color{red}{x}\\) and boxed \\(\\boxed{z}\\).',
  ].join('\n\n')
  await seedChats(page, [savedChat('style me', [answer(models[0].id, content)])])
  await page.goto('/')
  await selectChat(page, 'style me')
  const msg = assistantMessages(page)

  const overlay = msg.getByText('Overlay', { exact: true })
  await expect(overlay).toBeVisible()
  await expect(overlay).not.toHaveAttribute('style')
  await expect(overlay).not.toHaveAttribute('id')
  await expect(overlay).toHaveAttribute('class', 'hljs')
  await expect(overlay).toHaveCSS('position', 'static')

  const rawMath = msg.locator('math').first()
  await expect(rawMath).toHaveCSS('position', 'static')
  await expect(rawMath).toHaveAttribute('style', 'color: red;')
  await expect(msg.locator('[style*="color"]', { hasText: 'x' }).last()).toHaveCSS(
    'color',
    'rgb(255, 0, 0)',
  )
  await expect(msg.locator('[style*="border"]', { hasText: 'z' }).last()).toHaveCSS(
    'border-top-style',
    'solid',
  )
})
