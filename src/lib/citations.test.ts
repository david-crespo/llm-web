import { describe, expect, test } from 'vitest'
import {
  SourceCollector,
  badgeLabel,
  expandCitationTokens,
  extractOpenAITextCitations,
  formatAssistantMarkdown,
  normalizeUrl,
  prepareMarkdownCitations,
  sourceMeta,
  sourceTitle,
  utf8ByteOffsetMapper,
} from './citations'
import type { AssistantMessage } from './types'

describe('normalizeUrl & SourceCollector', () => {
  test('strips utm_source=openai while keeping other params and rejecting non-http schemes', () => {
    expect(normalizeUrl('https://www.aps.org/news?utm_source=openai')).toBe(
      'https://www.aps.org/news',
    )
    expect(normalizeUrl('https://example.com/p?a=1&utm_source=openai&b=2')).toBe(
      'https://example.com/p?a=1&b=2',
    )
    expect(normalizeUrl('oai-weather')).toBeNull()
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
  })

  test('orders cited sources by first inline appearance before uncited results and merges metadata', () => {
    const collector = new SourceCollector()
    collector.add({ url: 'https://uncited.com/page', title: 'Uncited Page' })
    collector.add({
      url: 'https://www.britannica.com/topic/2026-Nobel',
      title: '2026 Nobel Prize winners',
      age: '30 days ago',
    })
    collector.cite(50, {
      url: 'https://www.aps.org/news?utm_source=openai',
      title: 'APS congratulates winner',
    })
    collector.cite(10, {
      url: 'https://www.britannica.com/topic/2026-Nobel',
      title: '2026 Nobel Prize winners',
    })
    // Same URL without utm_source in action.sources dedupes cleanly
    collector.add({ url: 'https://www.aps.org/news' })

    const { sources, citations } = collector.build()
    expect(sources).toEqual([
      {
        url: 'https://www.britannica.com/topic/2026-Nobel',
        domain: 'britannica.com',
        title: '2026 Nobel Prize winners',
        age: '30 days ago',
        snippet: undefined,
        cited: true,
      },
      {
        url: 'https://www.aps.org/news',
        domain: 'aps.org',
        title: 'APS congratulates winner',
        age: undefined,
        snippet: undefined,
        cited: true,
      },
      {
        url: 'https://uncited.com/page',
        domain: 'uncited.com',
        title: 'Uncited Page',
        age: undefined,
        snippet: undefined,
      },
    ])
    expect(citations).toEqual([
      { offset: 10, sourceIndices: [0] },
      { offset: 50, sourceIndices: [1] },
    ])
  })

  test('extracts real domain and snippet fallback for Google vertexaisearch redirects', () => {
    const collector = new SourceCollector()
    collector.cite(42, {
      url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQE9UKqq',
      title: 'nobelprize.org',
      snippet: 'Halzen pioneered a cubic kilometer particle detector',
    })
    const { sources } = collector.build()
    expect(sources?.[0]).toMatchObject({
      domain: 'nobelprize.org',
      title: undefined,
      cited: true,
    })
    expect(sourceTitle(sources![0])).toBe('nobelprize.org')
    expect(sourceMeta(sources![0])).toBe('“Halzen pioneered a cubic kilometer particle detector”')
  })
})

describe('utf8ByteOffsetMapper', () => {
  test('maps UTF-8 byte offsets across 2-byte, 3-byte, and 4-byte characters', () => {
    // é = 2 bytes (1 u16), — = 3 bytes (1 u16), 🎉 = 4 bytes (2 u16)
    const text = 'Café—🎉 ok'
    const map = utf8ByteOffsetMapper(text)
    const encoded = new TextEncoder().encode(text)

    // Verify slices decoded from UTF-8 match slices at mapped UTF-16 indices on boundaries
    expect(text.slice(0, map(5))).toBe('Café')
    expect(text.slice(map(5), map(8))).toBe('—')
    expect(text.slice(map(8), map(12))).toBe('🎉')
    expect(text.slice(map(13), map(encoded.length))).toBe('ok')
  })
})

describe('extractOpenAITextCitations', () => {
  test('strips single and grouped inline markdown links while preserving non-ASCII offsets', () => {
    const raw =
      'Particles—from space. ([aps.org](https://www.aps.org/news?utm_source=openai)) More ([a.org](https://a.org/1), [b.org](https://b.org/2)).'
    const firstStart = raw.indexOf('([aps.org]')
    const firstEnd = firstStart + '([aps.org](https://www.aps.org/news?utm_source=openai))'.length
    const aStart = raw.indexOf('[a.org]')
    const aEnd = aStart + '[a.org](https://a.org/1)'.length
    const bStart = raw.indexOf('[b.org]')
    const bEnd = bStart + '[b.org](https://b.org/2)'.length

    const result = extractOpenAITextCitations(raw, [
      {
        start_index: firstStart,
        end_index: firstEnd,
        url: 'https://www.aps.org/news?utm_source=openai',
        title: 'APS News',
      },
      { start_index: aStart, end_index: aEnd, url: 'https://a.org/1', title: 'A' },
      { start_index: bStart, end_index: bEnd, url: 'https://b.org/2', title: 'B' },
    ])

    expect(result.text).toBe('Particles—from space. More.')
    expect(result.citations).toEqual([
      {
        offset: 'Particles—from space.'.length,
        url: 'https://www.aps.org/news?utm_source=openai',
        title: 'APS News',
      },
      { offset: 'Particles—from space. More'.length, url: 'https://a.org/1', title: 'A' },
      { offset: 'Particles—from space. More'.length, url: 'https://b.org/2', title: 'B' },
    ])
  })
})

describe('Markdown token injection & export', () => {
  const sources = [
    { url: 'https://europa.eu/p', domain: 'europa.eu', title: 'Europa', cited: true },
    { url: 'https://youtube.com/w', domain: 'youtube.com', title: 'YouTube', cited: true },
  ]

  test('nudges offsets past closing punctuation, merges duplicates, and strips forged PUA chars', () => {
    const text = 'He won "for neutrinos".\n\nNext\uE000cite0\uE001 line.'
    const offsetBeforeQuotePeriod = text.indexOf('.\n\n')
    const prepared = prepareMarkdownCitations(
      text,
      [{ offset: offsetBeforeQuotePeriod, sourceIndices: [0, 1] }],
      sources,
    )

    expect(prepared.content).toBe('He won "for neutrinos". \uE000cite0\uE001\n\nNextcite0 line.')
    const expanded = expandCitationTokens(`<p>${prepared.content}</p>`, prepared.citations, sources)
    expect(expanded).toContain('class="cite-badge" data-cite="0"')
    expect(expanded).toContain('>europa.eu +1</a>')
    expect(badgeLabel(prepared.citations[0], sources)).toBe('europa.eu +1')
  })

  test('formats assistant markdown with numbered inline markers and Sources list', () => {
    const msg: AssistantMessage = {
      role: 'assistant',
      model: 'Claude Opus 5.5',
      content: 'First claim. Second claim.',
      sources,
      citations: [
        { offset: 11, sourceIndices: [0] },
        { offset: 25, sourceIndices: [0, 1] },
      ],
      tokens: { input: 10, output: 10 },
      stop_reason: 'end_turn',
      cost: 0.01,
      timeMs: 1000,
    }
    expect(formatAssistantMarkdown(msg)).toBe(
      [
        'First claim. [1] Second claim. [1, 2]',
        '',
        '### Sources',
        '',
        '1. [Europa](https://europa.eu/p)',
        '2. [YouTube](https://youtube.com/w)',
      ].join('\n'),
    )
  })
})
