import { expect, test, vi } from 'vitest'
import { OpenAIAdapter } from './openai'
import { withEffortChanges } from './openai-effort'
import { models } from '$lib/models'
import type { Response } from 'openai/resources/responses/responses'
import type { AssistantMessage, ChatMessage } from '$lib/types'

const responses = vi.hoisted(() => ({
  create: vi.fn<(...args: unknown[]) => Promise<{ id: string }>>(),
  retrieve: vi.fn<(...args: unknown[]) => Promise<Partial<Response>>>(),
}))
vi.mock('openai', () => ({
  default: class {
    responses = responses
  },
}))
vi.mock('$lib/settings.svelte', () => ({ settings: { getKey: () => 'test-key' } }))

const user = (content: string, think?: boolean): ChatMessage => ({ role: 'user', content, think })
const answer: AssistantMessage = {
  role: 'assistant',
  model: 'GPT-6.1 Sol',
  content: 'answer',
  tokens: { input: 0, output: 0 },
  stop_reason: 'completed',
  cost: 0,
  timeMs: 0,
}
const update = (effort: 'low' | 'high') => ({
  type: 'configuration_update',
  reasoning: { effort },
})

test('replays effort changes when sending full history', () => {
  expect(
    withEffortChanges([user('a', false), answer, user('b', true), answer, user('c')], false),
  ).toEqual({
    effort: 'low',
    input: [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'answer' },
      update('high'),
      { role: 'user', content: 'b' },
      { role: 'assistant', content: 'answer' },
      update('low'),
      { role: 'user', content: 'c' },
    ],
  })
})

test('regeneration uses the current toggle for both first and chained turns', () => {
  expect(withEffortChanges([user('a', true)], false)).toEqual({
    effort: 'low',
    input: [{ role: 'user', content: 'a' }],
  })
  expect(withEffortChanges([user('a', false), answer, user('b', true)], false, 'low')).toEqual({
    effort: 'low',
    input: [{ role: 'user', content: 'b' }],
  })
})

test('looks up the actual effort when continuing an older saved response', async () => {
  responses.retrieve.mockResolvedValue({ reasoning: { effort: 'high' } })
  responses.create.mockResolvedValue({ id: 'next' })
  await new OpenAIAdapter().start({
    chat: {
      id: 1,
      createdAt: new Date(),
      systemPrompt: 'test',
      messages: [
        user('a'),
        { ...answer, provider: { type: 'openai', responseId: 'legacy' } },
        user('b', false),
      ],
    },
    model: models.find((m) => m.provider === 'openai')!,
    search: false,
    think: false,
  })
  expect(responses.retrieve).toHaveBeenCalledExactlyOnceWith('legacy', undefined, {
    signal: undefined,
  })
  expect(responses.create).toHaveBeenCalledWith(
    expect.objectContaining({
      previous_response_id: 'legacy',
      reasoning: { effort: 'high', context: 'all_turns', summary: 'auto' },
      input: [update('low'), { role: 'user', content: 'b' }],
    }),
    { signal: undefined },
  )
})

test('preserves reasoning summaries from a response', async () => {
  responses.retrieve.mockResolvedValue({
    id: 'saved-response',
    status: 'completed',
    output_text: 'final answer',
    reasoning: { effort: 'high' },
    output: [
      {
        id: 'r1',
        type: 'reasoning',
        summary: [
          { type: 'summary_text', text: 'First thought.' },
          { type: 'summary_text', text: 'Second thought.' },
        ],
      },
      { id: 'r2', type: 'reasoning', summary: [] },
      {
        id: 'r3',
        type: 'reasoning',
        summary: [{ type: 'summary_text', text: 'After searching.' }],
      },
    ],
  })

  const result = await new OpenAIAdapter().poll({
    provider: 'openai',
    id: 'saved-response',
    durable: true,
  })
  expect(result).toMatchObject({
    kind: 'final',
    response: {
      content: 'final answer',
      reasoning: 'First thought.\n\nSecond thought.\n\nAfter searching.',
      provider: { type: 'openai', responseId: 'saved-response', initialEffort: 'high' },
    },
  })
})
