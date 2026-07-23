import type { Chat } from '$lib/types'

/** Merge the asynchronous IndexedDB snapshot into the in-memory history without
 * overwriting chats that changed in memory while it was loading: when both
 * sides have a chat with the same id, the in-memory object wins (preserving
 * object identity for in-flight requests holding a reference to it), and chats
 * created in memory after the snapshot was taken are kept. Newest first. */
export function mergeHistory(local: Chat[], stored: Chat[]): Chat[] {
  const localById = new Map(local.map((chat) => [chat.id, chat]))
  const merged: Chat[] = []
  const seen = new Set<number>()

  for (const chat of stored) {
    merged.push(localById.get(chat.id) ?? chat)
    seen.add(chat.id)
  }
  for (const chat of local) {
    if (!seen.has(chat.id)) merged.push(chat)
  }

  return merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}
