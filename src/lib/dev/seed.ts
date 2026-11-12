// Dev-only sample history, loaded by visiting /?seed. Lets you look at the
// sidebar and message rendering without API keys or provider calls.

import { storage } from '#lib/storage.ts'
import { models, systemBase } from '#lib/models.svelte.ts'
import type { AssistantMessage, ChatMessage, NewChat } from '#lib/types.ts'

/** Marks seeded chats so reseeding replaces them and leaves real chats alone. */
const SEED_PROMPT = `[dev seed]\n\n${systemBase}`

const model = (provider: string) => models.find((m) => m.provider === provider)?.id ?? 'Unknown'

const answer = (
  modelId: string,
  content: string,
  extra: Partial<AssistantMessage> = {},
): AssistantMessage => ({
  role: 'assistant',
  model: modelId,
  content,
  tokens: { input: 1200, output: 450 },
  stop_reason: 'completed',
  timeMs: 8400,
  cost: 0.0123,
  ...extra,
})

const user = (content: string): ChatMessage => ({ role: 'user', content })

function sampleChats(): NewChat[] {
  const openai = model('openai')
  const anthropic = model('anthropic')
  const google = model('google')
  const chats: ChatMessage[][] = [
    [
      user('Explain how the borrow checker handles two-phase borrows'),
      answer(
        anthropic,
        Array.from(
          { length: 40 },
          (_, i) =>
            `Paragraph ${i + 1}. Two-phase borrows let a mutable borrow be reserved before it is activated, so \`vec.push(vec.len())\` type-checks even though it looks like a shared borrow inside a mutable one.`,
        ).join('\n\n'),
        {
          reasoning: 'The user wants the mechanism, not just the rule.\n\n'.repeat(12),
          tokens: { input: 5400, output: 3200 },
          cost: 0.114,
        },
      ),
      user('And where does it not apply?'),
      answer(openai, 'It only applies to autoref on method calls and a few operators.', {
        reasoning: 'Short follow-up; keep it brief.',
        search: true,
      }),
    ],
    [
      user('Show me a TypeScript debounce and its Rust equivalent'),
      answer(
        google,
        [
          'Here is the TypeScript version:',
          '```ts\nexport function debounce<T extends unknown[]>(fn: (...args: T) => void, ms: number) {\n  let timer: ReturnType<typeof setTimeout> | undefined\n  return (...args: T) => {\n    clearTimeout(timer)\n    timer = setTimeout(() => fn(...args), ms)\n  }\n}\n```',
          'And Rust, with tokio:',
          '```rust\nuse tokio::time::{sleep, Duration};\n\nasync fn debounce(mut rx: tokio::sync::mpsc::Receiver<String>) {\n    let mut last = None;\n    loop {\n        tokio::select! {\n            Some(v) = rx.recv() => last = Some(v),\n            _ = sleep(Duration::from_millis(300)), if last.is_some() => {\n                println!("{}", last.take().unwrap());\n            }\n        }\n    }\n}\n```',
          '| | TS | Rust |\n|---|---|---|\n| Timer | `setTimeout` | `tokio::time::sleep` |\n| Cancel | `clearTimeout` | drop the future |',
          'Inline math renders too: the expected wait is $\\frac{1}{\\lambda}$.',
        ].join('\n\n'),
      ),
    ],
    [
      user(
        '<pasted>\n' +
          'Line one line two paragraph two\n'.repeat(20) +
          '</pasted>\n\nWhat does this log say?',
      ),
      answer(openai, 'It looks like a retry loop that never backs off.', {
        stop_reason: 'incomplete',
      }),
    ],
    [user('Short question'), answer(anthropic, 'Short answer.')],
    [
      user('Who won the 2026 Nobel Prizes in Physics and Chemistry?'),
      answer(
        anthropic,
        [
          '**Physics:** Francis Halzen won the 2026 Nobel Prize in Physics "for decisive contributions to the IceCube Neutrino Observatory and the discovery of high-energy neutrinos of astrophysical origin."',
          '**Chemistry:** Henri B. Kagan and Kenso Soai shared the prize for discovering nonlinear effects and autocatalysis in asymmetric organic synthesis.',
        ].join('\n\n'),
        {
          search: true,
          searchQueries: ['2026 Nobel Prize Physics Chemistry winners'],
          sources: [
            {
              url: 'https://www.nobelprize.org/all-nobel-prizes-2026/',
              domain: 'nobelprize.org',
              title: 'All Nobel Prizes 2026 - NobelPrize.org',
              age: '30 days ago',
              cited: true,
            },
            {
              url: 'https://www.aps.org/about/news/2026/10/aps-winner-2026-nobel-physics',
              domain: 'aps.org',
              title:
                'American Physical Society congratulates the winner of the 2026 Nobel Prize in Physics',
              cited: true,
            },
            {
              url: 'https://www.britannica.com/topic/2026-Nobel-Prize-winners',
              domain: 'britannica.com',
              title: '2026 Nobel Prize winners',
              age: '30 days ago',
              cited: true,
            },
            {
              url: 'https://en.wikipedia.org/wiki/Nobel_Prize_in_Physics',
              domain: 'wikipedia.org',
              title: 'Nobel Prize in Physics',
            },
          ],
          citations: [
            { offset: 196, sourceIndices: [0, 1] },
            { offset: 344, sourceIndices: [2] },
          ],
        },
      ),
    ],
  ]
  const now = Date.now()
  return chats.map((messages, i) => ({
    createdAt: new Date(now - i * 60_000),
    systemPrompt: SEED_PROMPT,
    messages,
  }))
}

/** Replace previously seeded chats with a fresh copy of the samples. */
export async function seedSampleChats(): Promise<void> {
  const existing = await storage.getAllChats()
  await Promise.all(
    existing
      .filter((chat) => chat.systemPrompt === SEED_PROMPT)
      .map((chat) => storage.deleteChat(chat.id)),
  )
  for (const chat of sampleChats()) await storage.createChat(chat)
}
