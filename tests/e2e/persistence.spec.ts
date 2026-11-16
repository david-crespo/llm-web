import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI } from './helpers/mocks'
import {
  send,
  newChat,
  selectChat,
  openSidebar,
  chatRow,
  userMessages,
  assistantMessages,
  messageInput,
  forkMessage,
} from './helpers/app'
import { savedChat, seedChats } from './helpers/history'

test('stored history loads into the sidebar and stale empty chats are dropped', async ({
  page,
}) => {
  await seedChats(page, [
    ...[0, 1, 2].map((index) => ({
      ...savedChat(`seed ${index}`),
      createdAt: new Date(Date.now() - index * 1000),
    })),
    // An empty chat left over from a previous page load. Even though it's the
    // newest record, it should be dropped, not shown as a duplicate of this
    // load's fresh chat.
    { createdAt: new Date(Date.now() + 1000), systemPrompt: 'test', messages: [] },
  ])

  await page.goto('/')
  await expect(messageInput(page)).toBeVisible()

  // Stored history loads asynchronously into the already-mounted sidebar,
  // behind this load's fresh chat.
  await openSidebar(page)
  await expect(chatRow(page, 'seed 0')).toBeVisible()
  await expect(chatRow(page, 'seed 2')).toBeVisible()
  await expect(chatRow(page, 'New Chat')).toHaveCount(1)
})

test('OpenAI reasoning summaries and response chains survive reload and forks', async ({
  page,
}) => {
  const summary = 'Summary of the reasoning for this turn.'
  const openai = await mockOpenAI(page, { auto: true, reasoning: summary })
  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'stateful one')
  await expect(assistantMessages(page)).toHaveCount(1)
  await send(page, 'stateful two')
  await expect(assistantMessages(page)).toHaveCount(2)

  // Another chat must not become this chat's server-side prefix after reload.
  await newChat(page)
  await send(page, 'unrelated chat')
  await expect(assistantMessages(page)).toHaveCount(1)
  await newChat(page)
  await page.reload()
  await selectChat(page, 'stateful one')
  const reasoning = assistantMessages(page).first().getByRole('group')
  await expect(reasoning.getByText(summary)).toBeHidden()
  await reasoning.getByText('Reasoning', { exact: true }).click()
  await expect(reasoning.getByText(summary)).toBeVisible()
  await send(page, 'stateful three')
  await expect(assistantMessages(page)).toHaveCount(3)

  // A branch continues the response before the fork point, preserving the
  // original chat's chain even when the branch receives another answer.
  await forkMessage(page, 'stateful two')
  await expect(messageInput(page)).toHaveValue('stateful two')
  await send(page, 'branch two')
  await expect(assistantMessages(page)).toHaveCount(2)
  await openSidebar(page)
  await chatRow(page, 'stateful one').last().click()
  await send(page, 'stateful four')
  await expect(assistantMessages(page)).toHaveCount(4)

  const bodies = openai.bodies()
  expect(bodies.map((body) => body.previous_response_id)).toEqual([
    undefined,
    'resp_test_openai_1',
    undefined,
    'resp_test_openai_2',
    'resp_test_openai_1',
    'resp_test_openai_4',
  ])
  expect(bodies[3].input).toEqual([{ role: 'user', content: 'stateful three' }])
  expect(bodies[4].input).toEqual([{ role: 'user', content: 'branch two' }])
})

test('reload reopens the open chat, and a fresh visit starts a new one', async ({ page }) => {
  await mockOpenAI(page, { reply: (u) => `Re: ${u}`, auto: true })
  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'one')
  await expect(assistantMessages(page)).toContainText('Re: one')
  await newChat(page)
  await send(page, 'two')
  await expect(assistantMessages(page)).toContainText('Re: two')
  const secondUrl = page.url()
  await selectChat(page, 'one')
  await expect(page).not.toHaveURL(secondUrl)

  // What iOS Safari does when you return to a tab it discarded.
  await page.reload()
  await expect(userMessages(page)).toContainText(['one'])
  await expect(assistantMessages(page)).toContainText('Re: one')
  await openSidebar(page)
  await expect(chatRow(page, 'one')).toBeVisible()
  await expect(chatRow(page, 'two')).toBeVisible()

  await page.goto('/')
  await expect(page).toHaveURL(/\/\?chat=\d+$/)
  await expect(messageInput(page)).toBeVisible()
  await expect(userMessages(page)).toHaveCount(0)
})

test('back and forward move between opened chats', async ({ page }) => {
  await mockOpenAI(page, { reply: (u) => `Re: ${u}`, auto: true })
  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'one')
  await expect(assistantMessages(page)).toContainText('Re: one')
  await newChat(page)
  await send(page, 'two')
  await expect(assistantMessages(page)).toContainText('Re: two')
  const secondUrl = page.url()
  await selectChat(page, 'one')
  await expect(page).not.toHaveURL(secondUrl)

  await page.goBack()
  await expect(userMessages(page)).toContainText(['two'])
  await page.goBack()
  await expect(userMessages(page)).toContainText(['one'])
  await page.goForward()
  await expect(userMessages(page)).toContainText(['two'])

  // The first chat replaced the bare / it loaded on, so back from it leaves
  // the chat page rather than bouncing off an entry with no chat.
  await page.goBack()
  await page.goBack()
  await expect(page).toHaveURL(/\/settings$/)
})

test('an unsent message survives the tab being discarded while hidden', async ({ page }) => {
  await mockOpenAI(page, { reply: (u) => `Re: ${u}`, auto: true })
  await setKeysThroughSettings(page, { openai: 'sk-test' })
  await send(page, 'one')
  await expect(assistantMessages(page)).toContainText('Re: one')
  await messageInput(page).fill('half-written')

  const setVisibility = (state: 'hidden' | 'visible') =>
    page.evaluate((state) => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    }, state)

  // Discarded while hidden: the reload brings the message back.
  await setVisibility('hidden')
  await page.reload()
  await expect(messageInput(page)).toHaveValue('half-written')

  // Shown again without a discard: the saved copy is dropped, so it doesn't
  // reappear after the message is sent.
  await setVisibility('hidden')
  await setVisibility('visible')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(assistantMessages(page)).toHaveCount(2)
  await page.reload()
  await expect(userMessages(page)).toHaveCount(2)
  await expect(messageInput(page)).toHaveValue('')
})
