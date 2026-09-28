import type { ResponseInput } from 'openai/resources/responses/responses'
import type { ChatMessage } from '$lib/types'

type Effort = 'low' | 'high'
const toEffort = (think: boolean): Effort => (think ? 'high' : 'low')
const update = (effort: Effort): ResponseInput[number] => ({
  type: 'configuration_update',
  reasoning: { effort },
})

/** Keep request-level effort fixed and append changes before their user turns.
 * With previous_response_id, chainEffort is that response's request-level effort;
 * the server retains earlier updates, so send only the new turn and its change.
 * Otherwise replay the stored Think history, as in the Anthropic adapter.
 * https://developers.openai.com/api/docs/guides/reasoning#change-reasoning-mid-conversation
 */
export function withEffortChanges(
  chatMessages: ChatMessage[],
  think: boolean,
  chainEffort?: Effort,
): { effort: Effort; input: ResponseInput } {
  if (chainEffort) {
    const previousUser = chatMessages.slice(0, -1).findLast((m) => m.role === 'user')
    // Legacy turns may predate stored Think values and configuration updates.
    const previous = previousUser?.think === undefined ? chainEffort : toEffort(previousUser.think)
    const desired = toEffort(think)
    return {
      effort: chainEffort,
      input: [
        ...(desired === previous ? [] : [update(desired)]),
        ...chatMessages.slice(-1).map((m) => ({ role: m.role, content: m.content })),
      ],
    }
  }

  const lastUserIndex = chatMessages.findLastIndex((m) => m.role === 'user')
  const levels = chatMessages.map((m, i) =>
    m.role === 'user' ? toEffort(i === lastUserIndex ? think : (m.think ?? false)) : null,
  )
  const effort = levels.find((level) => level !== null) ?? toEffort(think)

  let current = effort
  const input = chatMessages.flatMap<ResponseInput[number]>((m, i) => {
    const message = { role: m.role, content: m.content }
    const level = levels[i]
    if (!level || level === current) return [message]

    current = level
    return [update(level), message]
  })
  return { effort, input }
}
