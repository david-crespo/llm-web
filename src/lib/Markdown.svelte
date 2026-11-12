<script lang="ts">
  import { marked, type Tokens } from 'marked'
  import { Popover } from 'bits-ui'
  import DOMPurify from '#lib/purify.ts'
  import {
    expandCitationTokens,
    prepareMarkdownCitations,
    sourceMeta,
    sourceTitle,
  } from '#lib/citations.ts'
  import type { InlineCitation, Source } from '#lib/types.ts'
  // Use highlight.js core and explicitly register only needed languages
  import hljs from 'highlight.js/lib/core'
  import javascript from 'highlight.js/lib/languages/javascript'
  import typescript from 'highlight.js/lib/languages/typescript'
  import bash from 'highlight.js/lib/languages/bash'
  import rust from 'highlight.js/lib/languages/rust'
  import python from 'highlight.js/lib/languages/python'
  import { renderMath } from './math'

  // Register a minimal set of languages to keep bundle size small
  hljs.registerLanguage('javascript', javascript)
  hljs.registerLanguage('typescript', typescript)
  hljs.registerLanguage('bash', bash)
  hljs.registerLanguage('rust', rust)
  hljs.registerLanguage('python', python)

  interface Props {
    content: string
    citations?: InlineCitation[]
    sources?: Source[]
    class?: string
  }

  let { content, citations, sources, class: className }: Props = $props()
  let html = $state('')
  let activeCitations = $state<InlineCitation[]>([])
  let proseEl = $state<HTMLDivElement>()
  let popoverOpen = $state(false)
  let activeCiteIndex = $state<number | null>(null)
  let anchorEl = $state<HTMLElement | null>(null)
  let openedViaKeyboard = $state(false)

  const activeCiteSources = $derived.by((): Source[] => {
    if (activeCiteIndex === null || !sources?.length) return []
    const cite = activeCitations[activeCiteIndex]
    if (!cite) return []
    return cite.sourceIndices.map((i) => sources[i]).filter((s): s is Source => Boolean(s))
  })

  // Simple highlight.js integration via custom code renderer

  // MathML elements to allow through DOMPurify
  const MATHML_TAGS = [
    'math',
    'semantics',
    'annotation',
    'mrow',
    'mi',
    'mo',
    'mn',
    'ms',
    'mtext',
    'mspace',
    'msup',
    'msub',
    'msubsup',
    'mfrac',
    'msqrt',
    'mroot',
    'mtable',
    'mtr',
    'mtd',
    'mover',
    'munder',
    'munderover',
    'menclose',
    'mpadded',
    'mphantom',
    'mstyle',
    'merror',
    'mmultiscripts',
    'mprescripts',
  ]

  // Guard against stale async renders when content changes rapidly
  let renderSeq = 0

  $effect(() => {
    const seq = ++renderSeq
    const renderer = new marked.Renderer()

    // Render code blocks with highlight.js
    renderer.code = (token: Tokens.Code) => {
      const lang = token.lang ?? ''
      const highlighted =
        lang && hljs.getLanguage(lang)
          ? hljs.highlight(token.text, { language: lang }).value
          : hljs.highlightAuto(token.text).value
      const cls = `hljs${lang ? ` language-${lang}` : ''}`
      return `<pre><code class="${cls}">${highlighted}\n</code></pre>`
    }
    void (async () => {
      const prepared = prepareMarkdownCitations(content, citations, sources)
      // Render math before markdown so $...$ isn't misinterpreted
      const withMath = renderMath(prepared.content)
      const rendered = await marked.parse(withMath, { renderer })

      // A newer render started while we were awaiting — discard this result
      if (seq !== renderSeq) return

      const withBadges = expandCitationTokens(rendered, prepared.citations, sources)
      activeCitations = prepared.citations
      popoverOpen = false

      html = DOMPurify.sanitize(withBadges, {
        // Allow common safe URL schemes and root-relative paths
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/)/i,
        FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        ADD_TAGS: MATHML_TAGS,
        ADD_ATTR: ['xmlns', 'display', 'displaystyle', 'scriptlevel', 'aria-haspopup'],
      })
    })()
  })

  $effect(() => {
    const el = proseEl
    if (!el) return

    const onClick = (event: MouseEvent) => {
      const badge = (event.target as Element | null)?.closest?.(
        'a[data-cite]',
      ) as HTMLAnchorElement | null
      if (!badge || !el.contains(badge)) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return
      }
      event.preventDefault()
      const idx = Number(badge.dataset.cite)
      if (!Number.isInteger(idx) || !activeCitations[idx]) return

      if (popoverOpen && activeCiteIndex === idx && anchorEl === badge) {
        popoverOpen = false
        return
      }
      openedViaKeyboard = event.detail === 0
      anchorEl = badge
      activeCiteIndex = idx
      popoverOpen = true
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ' ') return
      const badge = (event.target as Element | null)?.closest?.(
        'a[data-cite]',
      ) as HTMLAnchorElement | null
      if (!badge || !el.contains(badge)) return
      event.preventDefault()
      badge.click()
    }

    el.addEventListener('click', onClick)
    el.addEventListener('keydown', onKeyDown)
    return () => {
      el.removeEventListener('click', onClick)
      el.removeEventListener('keydown', onKeyDown)
    }
  })

  $effect(() => {
    const badge = anchorEl
    if (!badge || !popoverOpen) return
    badge.setAttribute('data-active', '')
    badge.setAttribute('aria-expanded', 'true')
    return () => {
      badge.removeAttribute('data-active')
      badge.removeAttribute('aria-expanded')
    }
  })
</script>

<div bind:this={proseEl} class="prose max-w-none {className}">
  {@html html}
</div>

{#if activeCitations.length > 0}
  <Popover.Root bind:open={popoverOpen}>
    <Popover.Portal>
      <Popover.Content
        customAnchor={anchorEl}
        align="start"
        sideOffset={6}
        collisionPadding={{ top: 12, right: 12, bottom: 132, left: 12 }}
        trapFocus={false}
        onOpenAutoFocus={(e) => {
          if (!openedViaKeyboard) e.preventDefault()
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onEscapeKeydown={() => anchorEl?.focus({ preventScroll: true })}
        onInteractOutside={(e) => {
          if ((e.target as Element | null)?.closest?.('a[data-cite]')) {
            e.preventDefault()
          }
        }}
        aria-label="Citation details"
        data-citation-popover
        class="z-50 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-edge bg-surface-elevated shadow-lg"
      >
        <div class="max-h-64 divide-y divide-edge-muted overflow-y-auto">
          {#each activeCiteSources as source (source.url)}
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              onclick={() => (popoverOpen = false)}
              class="group block px-3.5 py-2.5 transition-colors hover:bg-surface-hover focus:bg-surface-hover focus:outline-none"
            >
              <div class="flex items-start justify-between gap-2">
                <span
                  class="line-clamp-2 text-sm leading-snug font-medium text-fg group-hover:text-link"
                >
                  {sourceTitle(source)}
                </span>
                <span
                  class="shrink-0 text-xs text-fg-faint group-hover:text-link"
                  aria-hidden="true">↗</span
                >
              </div>
              <div class="mt-0.5 truncate text-xs text-fg-muted">
                {sourceMeta(source)}
              </div>
            </a>
          {/each}
        </div>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
{/if}

<!-- lang="postcss" suppresses svelte-check warnings for Tailwind's @reference/@apply directives -->
<style lang="postcss">
  @reference '../app.css';

  /* Custom styles for markdown content */
  .prose :global(pre) {
    /* Let the highlight theme style the code block visuals */
    overflow-x: auto;
    overflow-y: hidden;
    max-width: 100%;
    white-space: pre;
    word-break: normal;
    -webkit-overflow-scrolling: touch;
    margin-bottom: 0.75rem;
  }

  .prose :global(pre:last-child) {
    margin-bottom: 0;
  }

  .prose :global(code) {
    background-color: var(--color-code-bg, #e2e8f0);
    color: var(--color-fg);
    padding: 0.125rem 0.25rem;
    border-radius: 3px;
    font-size: 0.875rem;
  }

  .prose :global(pre code) {
    white-space: pre;
  }
  /* Slightly more padding for code blocks (reduced) */
  .prose :global(pre code.hljs) {
    padding: 0.75em 0.85em;
  }
  /* Code block visuals: background + subtle border */
  .prose :global(pre code.hljs) {
    background-color: var(--color-code-block-bg, #f6f8fa);
    border: 1px solid var(--color-edge);
  }

  .prose :global(blockquote) {
    border-left: 4px solid var(--color-edge);
    padding-left: 1rem;
    margin: 1rem 0;
    color: var(--color-fg-muted);
  }

  .prose :global(blockquote:last-child) {
    margin-bottom: 0;
  }

  .prose :global(h1),
  .prose :global(h2),
  .prose :global(h3),
  .prose :global(h4),
  .prose :global(h5),
  .prose :global(h6) {
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .prose :global(p) {
    margin-bottom: 0.75rem;
  }

  .prose :global(p:last-child) {
    margin-bottom: 0;
  }

  .prose :global(ul) {
    margin-bottom: 0.75rem;
    padding-left: 1.5rem;
    list-style-type: disc;
  }

  .prose :global(ol) {
    margin-bottom: 0.75rem;
    padding-left: 1.5rem;
    list-style-type: decimal;
  }

  .prose :global(ul:last-child) {
    margin-bottom: 0;
  }

  .prose :global(ol:last-child) {
    margin-bottom: 0;
  }

  .prose :global(li) {
    margin-bottom: 0.25rem;
  }

  /* Nested list styling */
  .prose :global(ul ul) {
    list-style-type: circle;
    margin-bottom: 0;
  }

  .prose :global(ul ul ul) {
    list-style-type: square;
    margin-bottom: 0;
  }

  .prose :global(ol ol) {
    list-style-type: lower-alpha;
    margin-bottom: 0;
  }

  .prose :global(ol ol ol) {
    list-style-type: lower-roman;
    margin-bottom: 0;
  }

  .prose :global(table) {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1rem;
    max-width: 100%;
    overflow-x: auto;
    display: block;
  }

  .prose :global(table:last-child) {
    margin-bottom: 0;
  }

  .prose :global(th),
  .prose :global(td) {
    border: 1px solid var(--color-edge);
    padding: 0.5rem;
    text-align: left;
  }

  .prose :global(th) {
    background-color: var(--color-surface-alt);
    font-weight: 600;
  }

  .prose :global(a) {
    color: var(--color-link);
    text-decoration: underline;
  }

  .prose :global(hr) {
    border-color: var(--color-edge);
    margin: 1rem 0;
  }

  .prose :global(a:hover) {
    color: var(--color-link-hover);
  }

  /* Default to compact sizing */
  .prose :global(p),
  .prose :global(li),
  .prose :global(td),
  .prose :global(th) {
    font-size: 0.9375rem;
    line-height: 1.35;
  }

  /* Inline code slightly smaller */
  .prose :global(code) {
    font-size: 0.85rem;
  }

  /* Code blocks a notch smaller + tighter line-height */
  .prose :global(pre),
  .prose :global(pre code) {
    font-size: 0.9rem;
    line-height: 1.3;
  }

  .prose :global(h1) {
    font-size: 1.1rem;
  }

  .prose :global(h2) {
    font-size: 1rem;
  }

  .prose :global(h3),
  .prose :global(h4),
  .prose :global(h5),
  .prose :global(h6) {
    font-size: 0.95rem;
  }

  /* Block math: center and add vertical spacing */
  .prose :global(math.tml-display) {
    text-align: center;
    margin: 1rem 0;
  }

  /* Scroll wide display math rather than overflowing the container. overflow-x
   * forces overflow-y to auto too, and tall glyphs (integrals, superscripts)
   * poke out a few pixels, so hide vertical overflow and pad to avoid clipping. */
  .prose :global(p:has(> math.tml-display)) {
    overflow-x: auto;
    overflow-y: hidden;
    padding-block: 0.25rem;
  }

  /* Math parse errors */
  .prose :global(.math-error) {
    color: var(--color-error, #dc2626);
    background-color: var(--color-error-bg, #fef2f2);
  }

  /* Inline citation pills */
  .prose :global(a.cite-badge) {
    position: relative;
    display: inline-flex;
    align-items: center;
    padding: 0.08rem 0.44rem;
    border-radius: 9999px;
    border: 1px solid var(--color-badge-edge);
    background-color: var(--color-badge-bg);
    color: var(--color-fg-muted);
    font-size: 0.72rem;
    font-weight: 500;
    line-height: 1.25;
    text-decoration: none;
    vertical-align: 0.06em;
    white-space: nowrap;
    transition:
      background-color 120ms ease,
      color 120ms ease,
      border-color 120ms ease;
  }

  /* Expand tap target on touch screens without altering paragraph line-height */
  .prose :global(a.cite-badge::before) {
    content: '';
    position: absolute;
    inset: -5px -2px;
  }

  .prose :global(a.cite-badge:hover),
  .prose :global(a.cite-badge[data-active]) {
    background-color: var(--color-badge-hover);
    border-color: var(--color-toggle-active-border);
    color: var(--color-fg);
  }
</style>
