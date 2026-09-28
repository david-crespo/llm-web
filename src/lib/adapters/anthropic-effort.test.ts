import { describe, expect, test } from 'vitest'
import { withEffortChanges } from './anthropic-effort'
import type { ChatMessage } from '$lib/types'

const user = (content: string, think?: boolean): ChatMessage => ({ role: 'user', content, think })
const assistant = (content: string): ChatMessage => ({
  role: 'assistant',
  model: 'Claude Opus 5.5',
  content,
  tokens: { input: 0, output: 0 },
  stop_reason: 'end_turn',
  cost: 0,
  timeMs: 0,
})
const effortChange = (effort: string) => ({
  role: 'system',
  content: [],
  output_config: { effort },
})

describe('withEffortChanges', () => {
  test('constant level adds no system messages', () => {
    const { effort, messages } = withEffortChanges(
      [user('a', false), assistant('b'), user('c')],
      false,
    )
    expect(effort).toBe('low')
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user'])
  })

  test('replays earlier changes so the next request extends the same prefix', () => {
    const history = [user('a', false), assistant('b'), user('c', true), assistant('d')]
    const turn2 = withEffortChanges(history.slice(0, 3), true)
    const turn3 = withEffortChanges([...history, user('e')], false)
    expect(turn2).toEqual({
      effort: 'low',
      messages: [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
        effortChange('high'),
        { role: 'user', content: 'c' },
      ],
    })
    expect(turn3.effort).toBe(turn2.effort)
    expect(turn3.messages.slice(0, turn2.messages.length)).toEqual(turn2.messages)
    expect(turn3.messages.slice(turn2.messages.length)).toEqual([
      { role: 'assistant', content: 'd' },
      effortChange('low'),
      { role: 'user', content: 'e' },
    ])
  })

  test('current toggle overrides the stored level on the final user message', () => {
    // Regenerate with the toggle flipped: the stored value is stale.
    const { effort, messages } = withEffortChanges([user('a', false)], true)
    expect(effort).toBe('high')
    expect(messages).toEqual([{ role: 'user', content: 'a' }])
  })

  test('messages from before think was recorded count as off', () => {
    const { effort, messages } = withEffortChanges([user('a'), assistant('b'), user('c')], true)
    expect(effort).toBe('low')
    expect(messages[2]).toEqual(effortChange('high'))
  })
})
