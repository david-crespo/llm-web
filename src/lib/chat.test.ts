import { expect, test, vi } from 'vitest'
import { bootComplete, ChatManager } from './chat.svelte'
import { getAdapter } from './adapters'
import { withEffortChanges } from './adapters/anthropic-effort'
import { models } from './models'
import type { Chat } from './types'

vi.mock('#lib/storage.ts', () => ({
  storage: {
    init: async () => {},
    createChat: async () => 2,
    updateChat: async () => {},
  },
}))
vi.mock('#lib/settings.svelte.ts', () => ({ settings: { getKey: () => 'test-key' } }))
vi.mock('#lib/adapters/index.ts', () => ({ getAdapter: vi.fn<typeof getAdapter>() }))
vi.mock('#lib/actions/autoScroll.ts', () => ({
  scrollToBottom: () => {},
  scrollToAnswer: () => {},
  restoreScroll: () => {},
}))
// Node's own localStorage warns when touched without --localstorage-file.
// Hoisted because importing chat.svelte boots a ChatManager, which reads it.
vi.hoisted(() => vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} }))

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

test('selecting a chat mid-response restores the model and Search of the turn in flight', async () => {
  await bootComplete
  const [previous, inFlight] = models
  const waiting: Chat = {
    id: 3,
    createdAt: new Date(),
    systemPrompt: 'test',
    messages: [
      { role: 'user', content: 'one' },
      {
        role: 'assistant',
        model: previous.id,
        content: 'answer',
        tokens: { input: 0, output: 0 },
        stop_reason: 'end_turn',
        timeMs: 0,
        cost: 0,
        search: true,
      },
      { role: 'user', content: 'two', think: true },
    ],
    pending: {
      job: { provider: inFlight.provider, id: 'job', durable: true },
      startedAt: new Date().toISOString(),
      modelId: inFlight.id,
      search: false,
    },
  }
  const other: Chat = { id: 4, createdAt: new Date(), systemPrompt: 'test', messages: [] }
  const manager = new ChatManager(other, [waiting, other])

  await manager.selectChat(waiting.id)
  expect(manager.selectedModel?.id).toBe(inFlight.id)
  expect(manager.webSearch).toBe(false)
  expect(manager.reasoning).toBe(true)
})
