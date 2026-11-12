import { test, expect } from '@playwright/test'
import { setKeysThroughSettings } from './helpers/settings'
import { mockOpenAI, mockAnthropic, mockGoogle } from './helpers/mocks'
import { send, selectChat, selectModel, assistantMessages } from './helpers/app'
import { models } from '../../src/lib/models'
import {
  openaiSearchResponse,
  anthropicSearchResponse,
  googleSearchResponse,
} from './fixtures/search-responses'

test('OpenAI search: inline badges, popover switch/dismiss, end sources, and reload persistence', async ({
  page,
}) => {
  await mockOpenAI(page, {
    auto: true,
    response: (_text, callIndex) => (callIndex === 0 ? openaiSearchResponse : undefined),
  })
  await setKeysThroughSettings(page, { openai: 'sk-test' })

  await send(page, 'Who won the 2026 Nobel Prizes in Physics and Chemistry?')

  const msg = assistantMessages(page).first()
  await expect(msg).toContainText('Francis Halzen won the 2026 Nobel Prize in Physics')
  await expect(msg).toContainText('Henri B. Kagan and Kenso Soai shared the 2026 Nobel Prize')
  // Raw OpenAI markdown citation links and utm_source=openai are stripped from prose.
  await expect(msg).not.toContainText('utm_source=openai')
  await expect(msg).not.toContainText('([aps.org]')

  const badges = msg.locator('a.cite-badge')
  await expect(badges).toHaveCount(2)
  await expect(badges.nth(0)).toHaveText('aps.org')
  await expect(badges.nth(1)).toHaveText('acs.org')

  const popover = page.locator('[data-citation-popover]')
  await expect(popover).toBeHidden()

  // Tap/click first badge -> popover shows full article title, domain+path metadata, and clean URL
  await badges.nth(0).click()
  await expect(popover).toBeVisible()
  const apsLink = popover.getByRole('link')
  await expect(apsLink).toContainText(
    'American Physical Society congratulates the winner of the 2026 Nobel Prize in Physics',
  )
  await expect(apsLink).toContainText('aps.org · /about/news/2026/10/aps-winner-2026-nobel-physics')
  await expect(apsLink).toHaveAttribute(
    'href',
    'https://www.aps.org/about/news/2026/10/aps-winner-2026-nobel-physics',
  )
  await expect(apsLink).toHaveAttribute('target', '_blank')

  // Clicking the second badge while open switches directly to the second citation
  await badges.nth(1).click()
  await expect(popover).toBeVisible()
  await expect(popover.getByRole('link')).toContainText(
    'ACS president comments on award of 2026 Nobel Prize in Chemistry',
  )

  // Clicking the active badge toggles the popover closed
  await badges.nth(1).click()
  await expect(popover).toBeHidden()

  // End-of-message Sources section: 2 cited sources + 3 uncited (aps & acs deduped against action.sources)
  const sourcesBox = msg.locator('[data-sources]')
  await expect(sourcesBox).toContainText('Sources')
  await expect(sourcesBox).toContainText(
    'Searched “site.nobelprize.org 2026 Nobel Prize physics laureates”',
  )
  await expect(sourcesBox.getByRole('link')).toHaveCount(2)

  const expandBtn = sourcesBox.getByRole('button', { name: '+ 3 more search results' })
  await expect(expandBtn).toBeVisible()
  await expandBtn.click()
  await expect(sourcesBox.getByRole('link')).toHaveCount(5)
  await expect(sourcesBox).toContainText('lemonde.fr')

  // Reloading starts a fresh chat; selecting the saved chat restores structured citations
  await page.reload()
  await selectChat(page, 'Who won the 2026 Nobel Prizes in Physics and Chemistry?')
  const reloadedMsg = assistantMessages(page).first()
  const reloadedBadges = reloadedMsg.locator('a.cite-badge')
  await expect(reloadedBadges).toHaveCount(2)
  await reloadedBadges.nth(0).click()
  await expect(popover).toContainText('American Physical Society congratulates the winner')
})

test('Anthropic search: multi-block inline citations, page_age metadata, and clean replay', async ({
  page,
}) => {
  const anthropic = await mockAnthropic(page, {
    auto: true,
    response: (_text, callIndex) => (callIndex === 0 ? anthropicSearchResponse : undefined),
  })
  await setKeysThroughSettings(page, { anthropic: 'sk-ant-test' })
  await selectModel(page, models.find((m) => m.provider === 'anthropic')!.id)

  await send(page, 'Who won the 2026 Nobel Prizes?')

  const msg = assistantMessages(page).first()
  await expect(msg).toContainText('living organisms only contain one of these mirror images')
  // Tool-call query is surfaced in the Sources footer rather than injected into prose
  await expect(msg.locator('.prose')).not.toContainText('Search:')

  const badges = msg.locator('a.cite-badge')
  await expect(badges).toHaveCount(5)
  await expect(badges.nth(0)).toHaveText('britannica.com')
  await expect(badges.nth(1)).toHaveText('nobelprize.org')

  // Popover joins page_age from web_search_tool_result onto the cited source
  await badges.nth(0).click()
  const popover = page.locator('[data-citation-popover]')
  await expect(popover).toBeVisible()
  const link = popover.getByRole('link')
  await expect(link).toContainText('2026 Nobel Prize winners')
  await expect(link).toContainText('britannica.com · 30 days ago')
  await expect(link).toHaveAttribute(
    'href',
    'https://www.britannica.com/topic/2026-Nobel-Prize-winners',
  )

  // Outside click dismisses the popover
  await page.locator('body').click({ position: { x: 8, y: 8 } })
  await expect(popover).toBeHidden()

  // End sources deduplicate the 5 inline citations down to 2 cited sources + 2 extra search results
  const sourcesBox = msg.locator('[data-sources]')
  await expect(sourcesBox.getByRole('link')).toHaveCount(2)
  await expect(sourcesBox).toContainText('britannica.com · 30d')
  await expect(sourcesBox).toContainText('Searched “2026 Nobel Prize Physics Chemistry winners”')
  await sourcesBox.getByRole('button', { name: '+ 2 more search results' }).click()
  await expect(sourcesBox.getByRole('link')).toHaveCount(4)
  await expect(sourcesBox).toContainText('Nobel Prize in Physics')

  // Multi-turn follow-up replays clean assistant prose without citation markup or Search: headers
  await send(page, 'Follow up')
  await expect(assistantMessages(page)).toHaveCount(2)
  const messages = (anthropic.bodies()[1]?.messages ?? []) as { role: string; content: string }[]
  const replayedAssistant = messages.find((m) => m.role === 'assistant')
  expect(replayedAssistant?.content).toContain(
    'He won it "for decisive contributions to the IceCube Neutrino Observatory and the discovery of high-energy neutrinos of astrophysical origin".',
  )
  expect(replayedAssistant?.content).not.toContain('britannica.com')
  expect(replayedAssistant?.content).not.toContain('Search:')
})

test('Google search: UTF-8 byte offsets, multi-source pills, and redirect domain resolution', async ({
  page,
}) => {
  await mockGoogle(page, { auto: true, response: googleSearchResponse })
  await setKeysThroughSettings(page, { google: 'gm-test' })

  await send(page, '2026 Nobel Prizes')

  const msg = assistantMessages(page).first()
  // Final sentence after multi-byte em-dash ("homochirality—how") renders intact, not truncated
  await expect(msg).toContainText('safe and effective pharmaceuticals.')
  // Redirect hostname never leaks into badges or sources
  await expect(msg).not.toContainText('vertexaisearch.cloud.google.com')

  const badges = msg.locator('a.cite-badge')
  await expect(badges).toHaveCount(6)
  await expect(badges.nth(0)).toHaveText('europa.eu +1')
  await expect(badges.nth(1)).toHaveText('nobelprize.org +1')
  await expect(badges.nth(5)).toHaveText('nobelprize.org +1')

  // Clicking a multi-source badge opens popover listing all cited sources for that span
  await badges.nth(0).click()
  const popover = page.locator('[data-citation-popover]')
  await expect(popover).toBeVisible()
  const popLinks = popover.getByRole('link')
  await expect(popLinks).toHaveCount(2)
  await expect(popLinks.nth(0)).toContainText('europa.eu')
  await expect(popLinks.nth(0)).toContainText('Francis Halzen')
  await expect(popLinks.nth(0)).toHaveAttribute(
    'href',
    'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQHv0lXUW0oX',
  )
  await expect(popLinks.nth(1)).toContainText('youtube.com')

  // End sources list the 8 unique cited redirect URLs (deduping 2 repeated URLs across 10 spans)
  const sourcesBox = msg.locator('[data-sources]')
  await expect(sourcesBox.getByRole('link')).toHaveCount(8)
  await expect(sourcesBox).toContainText(
    'Searched “2026 Nobel Prize in Chemistry”, “2026 Nobel Prize in Physics”',
  )
})
