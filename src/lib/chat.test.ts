import { expect, test, vi } from 'vitest'
import { bootComplete, ChatManager } from './chat.svelte'
import { getAdapter } from './adapters'
import { withEffortChanges } from './adapters/anthropic-effort'
import { models } from './models'
import type { Chat } from './types'

vi.mock('$lib/storage', () => ({
  storage: {
    init: async () => {},
    createChat: async () => 2,
    updateChat: async () => {},
  },
}))
vi.mock('$lib/settings.svelte', () => ({ settings: { getKey: () => 'test-key' } }))
vi.mock('$lib/adapters', () => ({ getAdapter: vi.fn<typeof getAdapter>() }))
vi.mock('$lib/actions/autoScroll', () => ({
  scrollToBottom: () => {},
  scrollToAnswer: () => {},
}))

test('regenerating a shared turn preserves the other chat’s effort history', async () => {
  await bootComplete
  const requests: ReturnType<typeof withEffortChanges>[] = []
  vi.mocked(getAdapter).mockReturnValue({
    start: async ({ chat, think }) => {
      requests.push(withEffortChanges(chat.messages, think))
      return { provider: 'anthropic', id: String(requests.length), durable: false }
    },
    poll: async () => ({
      kind: 'final',
      response: {
        content: 'answer',
        tokens: { input: 0, output: 0 },
        stop_reason: 'end_turn',
      },
    }),
    cancel: async () => {},
  })

  const original: Chat = {
    id: 1,
    createdAt: new Date(),
    systemPrompt: 'test',
    messages: [],
  }
  const manager = new ChatManager(original, [original])
  manager.selectedModel = models.find((model) => model.provider === 'anthropic')!
  await manager.sendMessage('one')
  await manager.sendMessage('two')
  await manager.fork(2)
  await manager.sendMessage('fork two')
  const fork = manager.current
  const forkRequest = requests.at(-1)!

  await manager.selectChat(original.id)
  manager.reasoning = true
  await manager.regenerate(0)
  expect(manager.current.messages[0]).toMatchObject({ think: true })
  expect(requests.at(-1)?.effort).toBe('high')
  expect(fork.messages[0]).toMatchObject({ think: false })

  await manager.selectChat(fork.id)
  manager.reasoning = false
  await manager.sendMessage('fork three')
  const continued = requests.at(-1)!
  expect(continued.effort).toBe(forkRequest.effort)
  expect(continued.messages).toEqual([
    ...forkRequest.messages,
    { role: 'assistant', content: 'answer' },
    { role: 'user', content: 'fork three' },
  ])
})
