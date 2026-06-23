import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI } from './helpers/mocks'
import {
  send,
  regenerate,
  editMessage,
  forkMessage,
  userMessages,
  assistantMessages,
  messageInput,
} from './helpers/app'

test('regenerate replaces the last response in place', async ({ page }) => {
  let n = 0
  const openai = await mockOpenAI(page, { reply: () => `answer ${++n}`, auto: true })

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'q')
  await expect(assistantMessages(page)).toContainText('answer 1')

  await regenerate(page, 'q')
  await expect(assistantMessages(page)).toContainText('answer 2')
  await expect(assistantMessages(page)).toHaveCount(1)
  expect(openai.calls()).toBe(2)
})

test('edit a user message after an error pops it back into the input', async ({ page }) => {
  const openai = await mockOpenAI(page)

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'oops')
  openai.fail(401)
  await expect(assistantMessages(page)).toContainText('Error:')

  await editMessage(page, 'oops')
  await expect(messageInput(page)).toHaveValue('oops')
  await expect(userMessages(page)).toHaveCount(0)
})

test('fork branches a new chat and seeds the input', async ({ page }) => {
  await mockOpenAI(page, { reply: (u) => `Re: ${u}`, auto: true })

  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'original')
  await expect(assistantMessages(page)).toContainText('Re: original')

  await forkMessage(page, 'original')
  // Forking from the first message yields an empty new chat with the text queued.
  await expect(messageInput(page)).toHaveValue('original')
  await expect(userMessages(page)).toHaveCount(0)
})
