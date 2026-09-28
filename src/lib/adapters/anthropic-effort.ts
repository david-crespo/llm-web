import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { ChatMessage } from '$lib/types'

type Effort = 'low' | 'high'
const toEffort = (think: boolean): Effort => (think ? 'high' : 'low')

/** Keep initial effort fixed and replay per-turn Think changes as system messages.
 * The current toggle overrides the final user turn, including on regeneration.
 * This preserves cached prefixes and steers Fable 5.1 more reliably than changing
 * top-level effort between requests.
 * https://platform.claude.com/docs/en/build-with-claude/effort#change-effort-mid-conversation-beta
 */
export function withEffortChanges(
  chatMessages: ChatMessage[],
  think: boolean,
): { effort: Effort; messages: BetaMessageParam[] } {
  const lastUserIndex = chatMessages.findLastIndex((m) => m.role === 'user')
  const levels = chatMessages.map((m, i) =>
    m.role === 'user' ? toEffort(i === lastUserIndex ? think : (m.think ?? false)) : null,
  )
  const effort = levels.find((level) => level !== null) ?? toEffort(think)

  let current = effort
  const messages = chatMessages.flatMap<BetaMessageParam>((m, i) => {
    const message = { role: m.role, content: m.content }
    const level = levels[i]
    if (!level || level === current) return [message]

    current = level
    return [{ role: 'system', content: [], output_config: { effort: level } }, message]
  })
  return { effort, messages }
}
