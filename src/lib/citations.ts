import type { AssistantMessage, InlineCitation, Source } from '#lib/types.ts'

const TOKEN_START = '\uE000'
const TOKEN_END = '\uE001'
const GOOGLE_REDIRECT_HOST = 'vertexaisearch.cloud.google.com'

export type RawSourceInput = {
  url: string
  title?: string | null
  age?: string | null
  snippet?: string | null
}

/** Validate http(s) URL and strip OpenAI's automatic utm_source=openai parameter. */
export function normalizeUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl.trim())
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    if (parsed.searchParams.get('utm_source') === 'openai') {
      parsed.searchParams.delete('utm_source')
    }
    return parsed.toString()
  } catch {
    return null
  }
}

export function isGoogleRedirect(url: string): boolean {
  try {
    return new URL(url).hostname.toLowerCase() === GOOGLE_REDIRECT_HOST
  } catch {
    return false
  }
}

function looksLikeDomain(text: string): boolean {
  const trimmed = text.trim()
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)
}

export function extractDomain(url: string, rawTitle?: string | null): string {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
    // Google Interactions returns opaque vertexaisearch redirect URLs and puts
    // the real site hostname (e.g. "nobelprize.org") in `title`.
    if (host === GOOGLE_REDIRECT_HOST && rawTitle && looksLikeDomain(rawTitle)) {
      return rawTitle
        .trim()
        .toLowerCase()
        .replace(/^www\./, '')
    }
    return host
  } catch {
    return rawTitle?.trim() || url
  }
}

function cleanTitle(
  rawTitle: string | null | undefined,
  domain: string,
  url: string,
): string | undefined {
  if (!rawTitle) return undefined
  const collapsed = rawTitle.replace(/\s+/g, ' ').trim()
  if (!collapsed) return undefined
  const lower = collapsed.toLowerCase().replace(/^www\./, '')
  if (lower === domain.toLowerCase() || collapsed === url) return undefined
  return collapsed
}

function cleanSnippet(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const cleaned = raw
    .replace(/^\(more\)\s*/i, '')
    .replace(/^---[\s\S]*?---\s*/, '')
    .replace(/[#*_`>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return undefined
  return cleaned.length > 180 ? `${cleaned.slice(0, 177).trimEnd()}…` : cleaned
}

/** Collects cited and uncited sources for a single assistant turn, deduplicating
 * by normalized URL and ordering cited sources first (by first inline appearance). */
export class SourceCollector {
  private entries = new Map<string, Source>()
  private order: string[] = []
  private rawCitations: { offset: number; key: string }[] = []

  add(input: RawSourceInput): string | null {
    const normalized = normalizeUrl(input.url)
    if (!normalized) return null

    const domain = extractDomain(normalized, input.title)
    const title = cleanTitle(input.title, domain, normalized)
    const age = input.age?.trim() || undefined
    const snippet = cleanSnippet(input.snippet)

    const existing = this.entries.get(normalized)
    if (existing) {
      if (!existing.title && title) existing.title = title
      if (!existing.age && age) existing.age = age
      if (!existing.snippet && snippet) existing.snippet = snippet
      if (existing.domain === GOOGLE_REDIRECT_HOST && domain !== GOOGLE_REDIRECT_HOST) {
        existing.domain = domain
      }
      return normalized
    }

    this.entries.set(normalized, { url: normalized, domain, title, age, snippet })
    this.order.push(normalized)
    return normalized
  }

  cite(offset: number, input: RawSourceInput): void {
    const key = this.add(input)
    if (!key) return
    const entry = this.entries.get(key)!
    entry.cited = true
    this.rawCitations.push({ offset, key })
  }

  build(): { sources?: Source[]; citations?: InlineCitation[] } {
    if (this.entries.size === 0) return {}

    const sortedRaw = [...this.rawCitations].sort((a, b) => a.offset - b.offset)
    const orderedKeys: string[] = []
    const seen = new Set<string>()

    // 1. Cited sources in order of first inline citation
    for (const { key } of sortedRaw) {
      if (!seen.has(key)) {
        seen.add(key)
        orderedKeys.push(key)
      }
    }
    // 2. Remaining uncited search results in discovery order
    for (const key of this.order) {
      if (!seen.has(key)) {
        seen.add(key)
        orderedKeys.push(key)
      }
    }

    const indexByKey = new Map<string, number>()
    const sources = orderedKeys.map((key, idx) => {
      indexByKey.set(key, idx)
      return this.entries.get(key)!
    })

    const byOffset = new Map<number, number[]>()
    for (const { offset, key } of sortedRaw) {
      const idx = indexByKey.get(key)
      if (idx === undefined) continue
      const list = byOffset.get(offset) ?? []
      if (!list.includes(idx)) list.push(idx)
      byOffset.set(offset, list)
    }

    const citations: InlineCitation[] = [...byOffset.entries()]
      .filter(([, indices]) => indices.length > 0)
      .map(([offset, sourceIndices]) => ({ offset, sourceIndices }))

    return {
      sources: sources.length > 0 ? sources : undefined,
      citations: citations.length > 0 ? citations : undefined,
    }
  }
}

/** Map UTF-8 byte offsets (used by Google's Annotations) to JS UTF-16 indices. */
export function utf8ByteOffsetMapper(text: string): (byteOffset: number) => number {
  const map: number[] = []
  for (let u16 = 0; u16 < text.length;) {
    const cp = text.codePointAt(u16)!
    const byteLen = cp <= 0x7f ? 1 : cp <= 0x7ff ? 2 : cp <= 0xffff ? 3 : 4
    const u16Len = cp > 0xffff ? 2 : 1
    for (let b = 0; b < byteLen; b++) map.push(u16)
    u16 += u16Len
  }
  map.push(text.length)
  return (byteOffset: number) => {
    if (byteOffset <= 0) return 0
    if (byteOffset >= map.length) return text.length
    return map[byteOffset]
  }
}

export type OpenAIUrlAnnotation = {
  start_index: number
  end_index: number
  url: string
  title?: string | null
}

/** Strip OpenAI's inline `([domain](url))` markdown spans from an output_text
 * block and return clean prose plus UTF-16 citation positions into that prose. */
export function extractOpenAITextCitations(
  text: string,
  annotations: OpenAIUrlAnnotation[],
): { text: string; citations: { offset: number; url: string; title?: string | null }[] } {
  if (annotations.length === 0) return { text, citations: [] }

  const valid = annotations
    .filter((a) => a.url && a.start_index >= 0 && a.end_index >= a.start_index)
    .sort((a, b) => a.start_index - b.start_index || a.end_index - b.end_index)

  if (valid.length === 0) return { text, citations: [] }

  type Group = {
    start: number
    end: number
    stripSpan: boolean
    items: OpenAIUrlAnnotation[]
  }

  const groups: Group[] = []
  for (const ann of valid) {
    const start = Math.min(ann.start_index, text.length)
    const end = Math.min(ann.end_index, text.length)
    const slice = text.slice(start, end)
    const isLinkSpan = slice.includes('](')

    const prev = groups.at(-1)
    if (
      prev &&
      prev.stripSpan &&
      isLinkSpan &&
      start >= prev.end &&
      /^[\s,;·/()[\]]*$/.test(text.slice(prev.end, start))
    ) {
      prev.end = Math.max(prev.end, end)
      prev.items.push(ann)
      continue
    }
    if (prev && start < prev.end) {
      prev.end = Math.max(prev.end, end)
      prev.items.push(ann)
      continue
    }
    groups.push({ start, end, stripSpan: isLinkSpan, items: [ann] })
  }

  let out = ''
  let cursor = 0
  const citations: { offset: number; url: string; title?: string | null }[] = []

  for (const group of groups) {
    if (!group.stripSpan) {
      out += text.slice(cursor, group.end)
      cursor = group.end
      for (const item of group.items) {
        citations.push({ offset: out.length, url: item.url, title: item.title })
      }
      continue
    }

    let removeStart = group.start
    let removeEnd = group.end

    // If individual link annotations sat inside an outer `(...)`, consume the parens too.
    if (removeStart > cursor && text[removeStart - 1] === '(' && text[removeEnd] === ')') {
      removeStart--
      removeEnd++
    }
    // Consume horizontal spaces immediately before the removed inline link span.
    while (
      removeStart > cursor &&
      (text[removeStart - 1] === ' ' || text[removeStart - 1] === '\t')
    ) {
      removeStart--
    }

    out += text.slice(cursor, removeStart)
    cursor = removeEnd
    for (const item of group.items) {
      citations.push({ offset: out.length, url: item.url, title: item.title })
    }
  }

  out += text.slice(cursor)
  return { text: out, citations }
}

/** Compact domain for inline pills (keeps `bbc.co.uk`, shortens deep subdomains). */
export function shortDomain(domain: string): string {
  const clean = domain.replace(/^www\./, '')
  const parts = clean.split('.')
  if (parts.length <= 3) return clean
  // Keep e.g. `ec.europa.eu` instead of `research-and-innovation.ec.europa.eu`.
  return parts.slice(-3).join('.')
}

export function badgeLabel(citation: InlineCitation, sources: Source[]): string {
  const first = sources[citation.sourceIndices[0]]
  if (!first) return 'source'
  const base = shortDomain(first.domain)
  const extra = citation.sourceIndices.length - 1
  return extra > 0 ? `${base} +${extra}` : base
}

export function sourceTitle(source: Source): string {
  return source.title || source.domain
}

function readableUrlPath(url: string): string | undefined {
  if (isGoogleRedirect(url)) return undefined
  try {
    const parsed = new URL(url)
    let path = parsed.pathname.replace(/\/+$/, '')
    if (!path || path === '/') return undefined
    try {
      path = decodeURIComponent(path)
    } catch {
      // Keep raw percent-encoded path if malformed
    }
    return path
  } catch {
    return undefined
  }
}

export function sourceMeta(source: Source): string {
  const path = readableUrlPath(source.url)
  if (source.title) {
    if (source.age) return `${source.domain} · ${source.age}`
    if (path) return `${source.domain} · ${path}`
    return source.domain
  }
  if (source.age) return path ? `${source.age} · ${path}` : source.age
  if (path) return path
  if (source.snippet) return `“${source.snippet}”`
  return 'Web source'
}

// Closing emphasis/quote/sentence punctuation right before whitespace or end-of-text.
const TRAILING_PUNCT_RE = /^(?:\*{1,3}|_{1,3})?[.,;:!?"”’)]+(?:\*{1,3}|_{1,3})?(?=\s|$)/

/** Normalize citation offsets so badges sit neatly after closing punctuation
 * and merge citations that land on the same spot. */
export function normalizeInlineCitations(
  content: string,
  citations: InlineCitation[] | undefined,
  sources: Source[] | undefined,
): InlineCitation[] {
  if (!citations?.length || !sources?.length) return []

  const merged = new Map<number, number[]>()
  for (const cite of citations) {
    let offset = Math.max(0, Math.min(cite.offset, content.length))
    const tail = content.slice(offset)
    const match = TRAILING_PUNCT_RE.exec(tail)
    if (match) offset += match[0].length

    const validIndices = cite.sourceIndices.filter((idx) => idx >= 0 && idx < sources.length)
    if (validIndices.length === 0) continue

    const existing = merged.get(offset) ?? []
    for (const idx of validIndices) {
      if (!existing.includes(idx)) existing.push(idx)
    }
    merged.set(offset, existing)
  }

  return [...merged.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([offset, sourceIndices]) => ({ offset, sourceIndices }))
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Insert inert Private-Use-Area tokens at citation offsets prior to math +
 * markdown parsing, so markdown constructs (tables, bold, lists) never break. */
export function prepareMarkdownCitations(
  rawContent: string,
  citations?: InlineCitation[],
  sources?: Source[],
): { content: string; citations: InlineCitation[] } {
  // Strip any PUA delimiter characters from untrusted model output so tokens cannot be forged.
  const sanitized = rawContent.replace(/[\uE000\uE001]/g, '')
  const normalized = normalizeInlineCitations(sanitized, citations, sources)
  if (normalized.length === 0) return { content: sanitized, citations: [] }

  let out = sanitized
  for (let i = normalized.length - 1; i >= 0; i--) {
    const { offset } = normalized[i]
    const before = out.slice(0, offset)
    const after = out.slice(offset)
    const leadSpace = before.length > 0 && !/\s$/.test(before) ? ' ' : ''
    const trailSpace = after.length > 0 && !/^[\s.,;:!?)]/.test(after) ? ' ' : ''
    out = `${before}${leadSpace}${TOKEN_START}cite${i}${TOKEN_END}${trailSpace}${after}`
  }
  return { content: out, citations: normalized }
}

const TOKEN_RE = /\uE000cite(\d+)\uE001/g

/** Replace PUA citation tokens with `<a class="cite-badge" data-cite="i">` HTML
 * before DOMPurify runs, so every URL and attribute is still sanitized by DOMPurify. */
export function expandCitationTokens(
  html: string,
  citations: InlineCitation[],
  sources?: Source[],
): string {
  if (citations.length === 0 || !sources?.length) return html
  return html.replace(TOKEN_RE, (_, rawIdx: string) => {
    const idx = Number(rawIdx)
    const cite = citations[idx]
    const primary = cite ? sources[cite.sourceIndices[0]] : undefined
    if (!cite || !primary) return ''
    const label = badgeLabel(cite, sources)
    const aria =
      cite.sourceIndices.length > 1
        ? `Sources: ${label} (${sourceTitle(primary)})`
        : `Source: ${sourceTitle(primary)}`
    return `<a href="${escapeHtml(primary.url)}" class="cite-badge" data-cite="${idx}" aria-haspopup="dialog" aria-label="${escapeHtml(aria)}">${escapeHtml(label)}</a>`
  })
}

/** Render an assistant message's text + numbered citations + Sources section
 * for plain Markdown export ("Copy as Markdown"). */
export function formatAssistantMarkdown(msg: AssistantMessage): string {
  const sources = msg.sources ?? []
  if (sources.length === 0) return msg.content

  const normalized = normalizeInlineCitations(msg.content, msg.citations, sources)
  let body = msg.content
  for (let i = normalized.length - 1; i >= 0; i--) {
    const { offset, sourceIndices } = normalized[i]
    const nums = sourceIndices.map((s) => s + 1).join(', ')
    body = `${body.slice(0, offset)} [${nums}]${body.slice(offset)}`
  }

  const lines = sources.map((s, i) => `${i + 1}. [${sourceTitle(s)}](${s.url})`)
  return `${body}\n\n### Sources\n\n${lines.join('\n')}`
}
