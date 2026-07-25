import { expect, type Page, type Locator } from '@playwright/test'

// Page actions and locators shared across specs. Prefer user-visible roles and
// accessible names; use test ids only for UI state that has no accessible shape.

export function userMessages(page: Page): Locator {
  return page.getByRole('article', { name: 'user message' })
}

export function assistantMessages(page: Page): Locator {
  return page.getByRole('article', { name: 'assistant message' })
}

export function loadingPlaceholder(page: Page): Locator {
  return page.getByRole('status', { name: 'Waiting for response' })
}

export function sidebarRows(page: Page): Locator {
  return page.getByRole('button', { name: /^Select chat:/ })
}

export function messageInput(page: Page): Locator {
  return page.getByRole('textbox', { name: 'Message' })
}

export async function send(page: Page, text: string): Promise<void> {
  await messageInput(page).fill(text)
  await page.getByRole('button', { name: 'Send' }).click()
}

export function modelSelect(page: Page): Locator {
  return page.getByLabel('Select model')
}

export function selectedModel(page: Page): Promise<string> {
  return modelSelect(page).locator('option:checked').innerText()
}

/** Select the first model whose label contains `text`, so specs can name a
 * model family ("Claude Opus") without pinning the version. Exact labels and
 * their order are asserted in models.spec.ts; nothing else should hardcode
 * them. */
export async function selectModel(page: Page, text: string): Promise<void> {
  const select = modelSelect(page)
  const label = await select.locator('option', { hasText: text }).first().innerText()
  await select.selectOption({ label })
}

/** Select any model other than the one currently selected, and return its
 * label. Used where the point is that the model changed, not which one. */
export async function selectOtherModel(page: Page): Promise<string> {
  const select = modelSelect(page)
  const current = await selectedModel(page)
  const labels = await select.locator('option').allInnerTexts()
  const label = labels.find((l) => l !== current)
  if (!label) throw new Error(`only one model available: ${current}`)
  await select.selectOption({ label })
  return label
}

/** Wait until the submitted turn, including its provider handle, has committed
 * to IndexedDB. A loading placeholder appears earlier and is not a persistence
 * barrier for reload tests. */
export async function expectPendingJobPersisted(page: Page, userText: string): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        (text) =>
          new Promise<boolean>((resolve, reject) => {
            const request = indexedDB.open('llm-web')
            request.onerror = () => reject(request.error)
            request.onsuccess = () => {
              const db = request.result
              const getAll = db.transaction('chats').objectStore('chats').getAll()
              getAll.onerror = () => reject(getAll.error)
              getAll.onsuccess = () => {
                resolve(
                  getAll.result.some(
                    (chat) =>
                      chat.pending != null &&
                      chat.messages?.some(
                        (message: { role?: string; content?: string }) =>
                          message.role === 'user' && message.content === text,
                      ),
                  ),
                )
                db.close()
              }
            }
          }),
        userText,
      ),
    )
    .toBe(true)
}

// Sidebar is a drawer below the 768px breakpoint and always-visible above it.
// Idempotent: checks the toggle's expanded state, then waits for the open state
// so the CSS slide-in settles before callers click rows inside it.
export async function openSidebar(page: Page): Promise<void> {
  if (page.viewportSize()!.width >= 768) return
  const toggle = page.getByRole('button', { name: 'Toggle sidebar' })
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click()
  }
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
}

export async function newChat(page: Page): Promise<void> {
  await openSidebar(page)
  await page.getByLabel('New Chat').click()
}

export function chatRow(page: Page, preview: string): Locator {
  return page.getByRole('button', { name: `Select chat: ${preview}` })
}

export function responseLoadingIndicator(row: Locator): Locator {
  return row.getByRole('status', { name: 'Response loading' })
}

// Reasoning renders in a <details> (implicit role "group") that's collapsed by
// default. Assert the text is hidden, expand the disclosure, then assert it
// shows — covering both the collapse behavior and that the adapter parsed the
// reasoning out of the response and rendered it.
export async function expectReasoning(page: Page, text: string): Promise<void> {
  const group = assistantMessages(page).getByRole('group')
  const content = group.getByText(text)
  await expect(content).toBeHidden()
  await group.getByText('Reasoning').click()
  await expect(content).toBeVisible()
}

export async function selectChat(page: Page, preview: string): Promise<void> {
  await openSidebar(page)
  await chatRow(page, preview).click()
}

// Open the kebab on a user message bubble (Copy / Fork / Edit / Regen).
async function openMessageMenu(page: Page, text: string): Promise<void> {
  const bubble = userMessages(page).filter({ hasText: text })
  await bubble.getByLabel('Message options').click()
}

export async function regenerate(page: Page, userText: string): Promise<void> {
  await openMessageMenu(page, userText)
  await page.getByRole('button', { name: 'Regen' }).click()
}

export async function forkMessage(page: Page, userText: string): Promise<void> {
  await openMessageMenu(page, userText)
  await page.getByRole('button', { name: 'Fork' }).click()
}

export async function editMessage(page: Page, userText: string): Promise<void> {
  await openMessageMenu(page, userText)
  await page.getByRole('button', { name: 'Edit' }).click()
}
