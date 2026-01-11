<script lang="ts">
  import { marked, type Tokens } from 'marked'
  // Sanitize rendered HTML safely in the browser
  import DOMPurify from 'dompurify'
  // Use highlight.js core and explicitly register only needed languages
  import hljs from 'highlight.js/lib/core'
  import javascript from 'highlight.js/lib/languages/javascript'
  import typescript from 'highlight.js/lib/languages/typescript'
  import bash from 'highlight.js/lib/languages/bash'
  import rust from 'highlight.js/lib/languages/rust'
  import python from 'highlight.js/lib/languages/python'
  // Math rendering via Temml (outputs MathML, rendered natively by browsers)
  import temml from 'temml'

  // Register a minimal set of languages to keep bundle size small
  hljs.registerLanguage('javascript', javascript)
  hljs.registerLanguage('typescript', typescript)
  hljs.registerLanguage('bash', bash)
  hljs.registerLanguage('rust', rust)
  hljs.registerLanguage('python', python)

  // Render LaTeX math expressions to MathML
  // Supports both $...$/$$...$$ and \(...\)/\[...\] delimiters
  function renderMath(text: string): string {
    // Protect code blocks and inline code from math processing
    const codeBlocks: string[] = []
    const placeholder = (i: number) => `\x00CODE${i}\x00`

    // Protect fenced code blocks
    text = text.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
      codeBlocks.push(match)
      return placeholder(codeBlocks.length - 1)
    })

    // Block math: $$...$$ or \[...\]
    text = text.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g, (_, d1, d2) => {
      const latex = (d1 ?? d2).trim()
      try {
        return temml.renderToString(latex, { displayMode: true })
      } catch {
        return `<code class="math-error">${latex}</code>`
      }
    })
    // Inline math: $...$ (not \$) or \(...\)
    // For $...$, require at least one LaTeX-ish char to avoid "$50 to $100" false positives
    const hasLatexChar = (s: string) => /[\\^_{}=]/.test(s) || /^[a-zA-Z]$/.test(s)
    text = text.replace(/(?<!\\)\$([^$\n]+?)\$|\\\((.+?)\\\)/g, (match, d1, d2) => {
      // d1 is from $...$, d2 is from \(...\)
      if (d1 !== undefined && !hasLatexChar(d1)) return match
      const latex = (d1 ?? d2).trim()
      try {
        return temml.renderToString(latex, { displayMode: false })
      } catch {
        return `<code class="math-error">${latex}</code>`
      }
    })

    // Restore code blocks
    // eslint-disable-next-line no-control-regex
    text = text.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)])
    return text
  }

  interface Props {
    content: string
    class?: string
  }

  let { content, class: className }: Props = $props()
  let html = $state('')

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

  $effect(() => {
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
    ;(async () => {
      // Render math before markdown so $...$ isn't misinterpreted
      const withMath = renderMath(content)
      const rendered = await marked.parse(withMath, { renderer })

      DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'A') {
          node.setAttribute('target', '_blank')
          node.setAttribute('rel', 'noopener noreferrer')
        }
      })

      html = DOMPurify.sanitize(rendered, {
        // Allow common safe URL schemes and root-relative paths
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|\/)/i,
        FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        ADD_TAGS: MATHML_TAGS,
        ADD_ATTR: ['xmlns', 'displaystyle', 'scriptlevel'],
      })

      DOMPurify.removeHook('afterSanitizeAttributes')
    })()
  })
</script>

<div class="prose max-w-none {className}">
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html html}
</div>

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
  .prose :global(math[display='block']) {
    display: block;
    text-align: center;
    margin: 1rem 0;
  }

  /* Math parse errors */
  .prose :global(.math-error) {
    color: var(--color-error, #dc2626);
    background-color: var(--color-error-bg, #fef2f2);
  }
</style>
