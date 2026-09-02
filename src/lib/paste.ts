/**
 * Large pastes are kept out of the textarea and shown as a collapsed chip in
 * the composer and as a collapsible block in the sent message. The underlying
 * representation is plain text: the pasted text is wrapped in a `<pasted>` tag
 * and appended to the message, so the string sent to the model is
 * self-describing and stored chats need no schema change.
 */

/** Pastes at least this many characters long get collapsed. */
export const PASTE_COLLAPSE_CHARS = 500

const OPEN = '<pasted>'
const CLOSE = '</pasted>'
// Also consumes the blank-line separator joinComposer puts after a block, so
// the typed text round-trips through the composer byte-for-byte.
const BLOCK_RE = /<pasted>\n?([\s\S]*?)\n?<\/pasted>(?:\n\n)?/g

export type Segment = { kind: 'text'; text: string } | { kind: 'pasted'; text: string }

/** Rough token estimate. Providers' tokenizers differ, but ~4 chars per token
 * is close enough for a size hint on English text and code. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

const tokenFmt = new Intl.NumberFormat()

export function pasteLabel(text: string): string {
  return `Pasted content (~${tokenFmt.format(estimateTokens(text))} tokens)`
}

/** Split message content into alternating typed text and pasted blocks. */
export function splitSegments(content: string): Segment[] {
  const segments: Segment[] = []
  let last = 0
  for (const m of content.matchAll(BLOCK_RE)) {
    const text = content.slice(last, m.index)
    if (text.trim()) segments.push({ kind: 'text', text })
    segments.push({ kind: 'pasted', text: m[1] })
    last = m.index + m[0].length
  }
  const tail = content.slice(last)
  if (tail.trim()) segments.push({ kind: 'text', text: tail })
  return segments
}

/** Composer view of a message: what goes in the textarea, and the chips. */
export function splitComposer(content: string): { text: string; pastes: string[] } {
  const segments = splitSegments(content)
  return {
    text: segments
      .filter((s) => s.kind === 'text')
      .map((s) => s.text)
      .join('\n\n'),
    pastes: segments.filter((s) => s.kind === 'pasted').map((s) => s.text),
  }
}

/**
 * Inverse of splitComposer: each paste as a block, then the typed text. Long
 * material goes before the instructions about it, which is the order Anthropic
 * recommends for long-context prompts.
 */
export function joinComposer(text: string, pastes: string[]): string {
  const blocks = pastes.map((p) => `${OPEN}\n${p}\n${CLOSE}`)
  return [...blocks, text].filter((s) => s.trim()).join('\n\n')
}
