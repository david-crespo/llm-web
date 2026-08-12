import { test, expect } from '@playwright/test'
import { messageInput, selectChat } from './helpers/app'

// The app runs on a phone, where there is no console. These cover the three
// channels that make an error readable there: `<svelte:boundary>` for render
// crashes, window listeners for everything else — event handlers and async work,
// which the boundary does not see — and +error.svelte for navigation, which
// SvelteKit catches before either of the others can.

const report = (page: import('@playwright/test').Page) => page.getByRole('alert')

test('an async error surfaces a dismissible report over the running app', async ({ page }) => {
  await page.goto('/')
  await expect(messageInput(page)).toBeVisible()

  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('boom from a timer')
    })
  })

  await expect(report(page)).toContainText('boom from a timer')
  // The app underneath is untouched — this error didn't take the page down.
  await expect(messageInput(page)).toBeVisible()

  await report(page).getByRole('button', { name: 'Dismiss' }).click()
  await expect(report(page)).toHaveCount(0)
})

test('an unhandled rejection surfaces a report', async ({ page }) => {
  await page.goto('/')
  await expect(messageInput(page)).toBeVisible()

  await page.evaluate(() => {
    void Promise.reject(new Error('boom from a promise'))
  })

  await expect(report(page)).toContainText('boom from a promise')
})

test('a bad route renders the error page rather than a bare SvelteKit 404', async ({ page }) => {
  await page.goto('/no-such-route')

  await expect(report(page)).toContainText('Something broke')
  await expect(report(page)).toContainText('Not found: /no-such-route')
})

test('a denied clipboard write says so and opens the stack for hand-copying', async ({ page }) => {
  // No console on a phone means the report has to be readable somehow even when
  // the clipboard is unavailable.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    })
  })
  await page.goto('/')
  // Wait for mount: the window listeners aren't installed until the app renders.
  await expect(messageInput(page)).toBeVisible()

  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('boom from a timer')
    })
  })
  await expect(report(page)).toContainText('boom from a timer')

  const stack = report(page).locator('pre')
  await expect(stack).toBeHidden()
  await report(page).getByRole('button', { name: 'Copy report' }).click()
  await expect(report(page).getByRole('button', { name: 'Copy failed' })).toBeVisible()
  await expect(stack).toBeVisible()
})

// A message with a cost of exactly this much crashes the render, courtesy of the
// patched formatter below. Anything the app throws on today is a bug someone
// will eventually fix, taking this test with it, so the crash is induced from
// outside instead — while still originating inside the app's own render, which
// is the part the boundary has to catch.
const CRASH_COST = 13371337

test('a render crash is caught by the boundary instead of blanking the page', async ({ page }) => {
  await page.addInitScript((cost) => {
    // `format` is a prototype accessor with no setter, so it can only be
    // shadowed per instance, and the app builds its formatters at module load —
    // after this script runs.
    const Original = Intl.NumberFormat
    Intl.NumberFormat = function (...args: ConstructorParameters<typeof Original>) {
      const nf = new Original(...args)
      const format = nf.format.bind(nf)
      Object.defineProperty(nf, 'format', {
        value: (value: number) => {
          if (value === cost) throw new Error('boom during render')
          return format(value)
        },
      })
      return nf
    } as unknown as typeof Intl.NumberFormat
  }, CRASH_COST)

  await page.goto('/settings')
  await page.evaluate(
    (cost) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('llm-web', 1)
        request.onerror = () => reject(request.error)
        request.onupgradeneeded = () => {
          const db = request.result
          const chats = db.createObjectStore('chats', { keyPath: 'id', autoIncrement: true })
          chats.createIndex('createdAt', 'createdAt', { unique: false })
          db.createObjectStore('apiKeys', { keyPath: 'id' })
        }
        request.onsuccess = () => {
          const db = request.result
          const transaction = db.transaction('chats', 'readwrite')
          transaction.onerror = () => reject(transaction.error)
          transaction.oncomplete = () => {
            db.close()
            resolve()
          }
          transaction.objectStore('chats').add({
            createdAt: new Date().toISOString(),
            systemPrompt: 'test',
            messages: [
              { role: 'user', content: 'crash me' },
              {
                role: 'assistant',
                model: 'GPT-5.6',
                content: 'costly',
                cost,
                timeMs: 1000,
                tokens: { input: 10, output: 20 },
              },
            ],
          })
        }
      }),
    CRASH_COST,
  )

  await page.goto('/')
  await selectChat(page, 'crash me')

  await expect(report(page)).toContainText('boom during render')
  // Only the boundary's report offers a reset, so this pins down which channel
  // caught the error — the app is gone and the report replaced it.
  await expect(report(page).getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(messageInput(page)).toBeHidden()
  // The stack is what makes this useful with no console attached.
  await report(page).getByText('Details').click()
  await expect(report(page).locator('pre')).toContainText('ChatMessage')
})
