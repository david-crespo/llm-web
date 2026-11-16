import type { Chat, NewChat } from '#lib/types.ts'

/**
 * Chat history as one JSON file, for moving it between browsers. The main case
 * is iOS, where a home-screen install has its own storage, separate from
 * Safari's. API keys are deliberately left out: the file is likely to end up
 * in iCloud Drive or a chat with yourself.
 */

const FORMAT = 'llm-web-chats'
const VERSION = 1

export function toBackupJson(chats: Chat[]): string {
  return JSON.stringify({
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    // Ids are per-database and would collide on import. In-flight requests
    // can't be resumed from another browser, so omit `pending` too.
    chats: chats
      .filter((chat) => chat.messages.length > 0)
      .map((chat) => ({
        createdAt: chat.createdAt.toISOString(),
        systemPrompt: chat.systemPrompt,
        messages: chat.messages,
      })),
  })
}

export function backupFileName(): string {
  return `llm-web-chats-${new Date().toISOString().slice(0, 10)}.json`
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** Parse an export file. Throws an Error with a user-facing message on
 * invalid input. */
export function parseBackup(text: string): NewChat[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (!isObject(data) || data.format !== FORMAT || !Array.isArray(data.chats)) {
    throw new Error('This file is not an llm-web chat export.')
  }
  if (data.version !== VERSION) {
    throw new Error(
      typeof data.version === 'number' && data.version > VERSION
        ? 'This export is from a newer version of the app.'
        : 'This file is not an llm-web chat export.',
    )
  }
  return data.chats.map((chat, index) => {
    const createdAt =
      isObject(chat) && typeof chat.createdAt === 'string' && new Date(chat.createdAt)
    const valid =
      createdAt &&
      !Number.isNaN(createdAt.getTime()) &&
      typeof chat.systemPrompt === 'string' &&
      Array.isArray(chat.messages) &&
      chat.messages.every(
        (m) =>
          isObject(m) &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string',
      )
    if (!valid) throw new Error(`Chat ${index + 1} in this file is malformed.`)
    return { createdAt, systemPrompt: chat.systemPrompt, messages: chat.messages } as NewChat
  })
}

/**
 * Sort imported chats into new ones and ones that grew since an earlier
 * import. Creation time identifies a chat across browsers, since ids don't
 * carry over. A chat that has more messages in the file than here was
 * continued after the last export, so the file's copy replaces this one;
 * otherwise this copy is kept. That makes importing the same file twice, or
 * an older file, a no-op.
 */
export function planImport(
  existing: Chat[],
  imported: NewChat[],
): { added: NewChat[]; updated: Chat[] } {
  const byTime = new Map(existing.map((chat) => [chat.createdAt.getTime(), chat]))
  const added: NewChat[] = []
  const updated: Chat[] = []
  for (const chat of imported) {
    if (chat.messages.length === 0) continue
    const match = byTime.get(chat.createdAt.getTime())
    if (!match) added.push(chat)
    // Overwriting a chat with a pending request would drop the incoming answer.
    else if (chat.messages.length > match.messages.length && !match.pending) {
      updated.push({ ...match, messages: chat.messages })
    }
  }
  return { added, updated }
}
