import { test, expect, type Page } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI } from './helpers/mocks'
import { messageInput, userMessages, assistantMessages, editMessage } from './helpers/app'

// 300 words, 2,289 chars, so ~573 tokens at 4 chars/token
const LONG = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ')

async function paste(page: Page, text: string) {
  await messageInput(page).focus()
  await messageInput(page).evaluate((el, text) => {
    const dt = new DataTransfer()
    dt.setData('text/plain', text)
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    )
  }, text)
}

test('a large paste becomes a chip and a collapsed block in the sent message', async ({ page }) => {
  const openai = await mockOpenAI(page, {
    reply: (u) => `tagged: ${u.startsWith('<pasted>\nword0 ') && u.endsWith('summarize')}`,
    auto: true,
  })
  await setKeysThroughSettings(page, { openai: 'sk-test' })

  await paste(page, LONG)
  const chip = page.locator('[data-pasted-chip]')
  await expect(chip).toContainText('Pasted content (~573 tokens)')
  await expect(messageInput(page)).toHaveValue('')

  await messageInput(page).fill('summarize')
  await page.getByRole('button', { name: 'Send' }).click()

  const block = userMessages(page).locator('details[data-pasted]')
  await expect(block).toContainText('Pasted content (~573 tokens)')
  await expect(userMessages(page)).toContainText('summarize')
  await expect(userMessages(page)).not.toContainText('<pasted>')
  await expect(assistantMessages(page)).toContainText('tagged: true')
  expect(openai.calls()).toBe(1)
})

test('a small paste goes into the textarea as usual', async ({ page }) => {
  await mockOpenAI(page)
  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await messageInput(page).fill('short')
  // A dispatched paste event is not default-handled by the browser, so if the
  // app leaves it alone the textarea stays as it was and no chip appears.
  await paste(page, 'tiny')
  await expect(page.locator('[data-pasted-chip]')).toHaveCount(0)
  await expect(messageInput(page)).toHaveValue('short')
})

test('removing a chip and editing a message keep pastes in sync', async ({ page }) => {
  const openai = await mockOpenAI(page)
  await setKeysThroughSettings(page, { openai: 'sk-test' })

  await paste(page, LONG)
  await page.getByRole('button', { name: 'Remove pasted content' }).click()
  await expect(page.locator('[data-pasted-chip]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Send' })).toBeDisabled()

  await paste(page, LONG)
  await messageInput(page).fill('with paste')
  await page.getByRole('button', { name: 'Send' }).click()
  openai.fail(401)
  await expect(assistantMessages(page)).toContainText('Error:')

  await editMessage(page, 'with paste')
  await expect(messageInput(page)).toHaveValue('with paste')
  await expect(page.locator('[data-pasted-chip]')).toContainText('Pasted content (~573 tokens)')
})
