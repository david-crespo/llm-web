import { marked } from 'marked'
import { describe, expect, test } from 'vitest'
import { renderMath as renderMathParts } from './math'

// Render with no markdown pass in between
function renderMath(input: string) {
  const { text, restore } = renderMathParts(input)
  return restore(text)
}

// Render the way Markdown.svelte does: math, then markdown, then restore
async function renderWithMarkdown(input: string) {
  const { text, restore } = renderMathParts(input)
  const html = restore(await marked.parse(text))
  expect(html).not.toContain('\x00')
  return html
}

const mathCount = (html: string) => (html.match(/<math/g) ?? []).length

describe('renderMath', () => {
  // Helper: check that renderMath produced MathML output
  const hasMathML = (result: string) => result.includes('<math')

  test.each([
    '$x$',
    '$dx$',
    '$a/b$',
    '$a,b$',
    '$x^2$',
    '$a_i$',
    '$\\frac{a}{b}$',
    '$a+b$',
    '$a-b$',
    '$(a+b)^2$',
    '$f(x)$',
    '$x = 1$',
    '$2^{10}$',
    '$1+2$',
    '$1-2$',
    '$3x+1$',
    '$\\alpha + \\beta$',
    '$\\sqrt{x}$',
    '\\(x^2\\)',
    '\\(50\\)',
    '\\(x + y\\)',
    '\\(x = 1\\)',
    '\\(\\frac{a}{b}\\)',
    '\\(\\alpha + \\beta\\)',
    '\\(\\sqrt{x}\\)',
    // Currency inside an actual equation should still render as math.
    '\\(P(x) = \\$3x + \\$5\\)',
    '\\(\\$300 \\cdot 1.05\\)',
    '$$x^2 + y^2$$',
    '\\[x^2 + y^2\\]',
    // \$ inside $...$ is a valid LaTeX escape for a literal dollar sign and
    // must not break the surrounding match. (Regression: the closing $ was
    // matching too eagerly — the regex saw "$\$" as a complete math span with
    // content "\", which Temml then choked on.)
    '$\\$300$',
    '$\\sim\\$900$',
    '$\\sim\\$450$',
  ])('renders: %s', (input) => {
    expect(hasMathML(renderMath(input))).toBe(true)
  })

  describe('LaTeX-escaped dollars inside math', () => {
    test('renders both math spans in "$\\$300$–$\\$500$ billion"', () => {
      const result = renderMath('roughly $\\$300$–$\\$500$ billion')
      const mathCount = (result.match(/<math/g) ?? []).length
      expect(mathCount).toBe(2)
      expect(result).not.toContain('temml-error')
      expect(result).not.toContain('math-error')
    })

    test('long mixed paragraph: math spans render, prose preserved, no errors', () => {
      const input =
        '**\\$400$–$\\$650$B globally for U.S.-led LLM development/serving**, before geographic adjustment. If only counting **spending physically in the U.S.**, knock that down by perhaps **25–45%**, because a material fraction of data centers, cloud regions, power, and supply-chain spend is outside the U.S. That yields the **$300$–$\\$500$B** estimate.'
      const result = renderMath(input)
      expect(result).not.toContain('temml-error')
      expect(result).not.toContain('math-error')
      // The lazy match must not have spanned prose across sentences.
      expect(result).not.toMatch(/<math[^>]*>[^<]*globally/)
      // Prose markers from the surrounding text must survive.
      expect(result).toContain('before geographic adjustment')
      expect(result).toContain('25–45%')
    })
  })

  test.each([
    'costs $50',
    'between $50 to $100',
    'between $50-$100',
    'between $1,200-$1,500',
    'between $50 - $100',
    'between $50–$100',
    'between $50—$100',
    'between $5 + $10 in fees',
    'between $5+$10 in fees',
    'between $30k-$40k',
    "used to be $50/year. Now it's $100",
    'I paid $100 for it',
    'between $5 and $10',
    '$30.7k vs $13.6k',
    '$ x^2$',
    'use `$x^2$` in LaTeX',
    '```\n$x^2$\n```',
    '```python\n$x^2$\n```',
    '~~~\n$x^2$\n~~~',
    '\\$not math$',
    '$x\ny$',
    '**$30.7k** of depreciation, versus **$13.6k** for a Toyota',
    // \(...\) inside code spans/blocks must be preserved verbatim.
    'use `\\(x^2\\)` for inline math',
    '```\n\\(x^2\\)\n```',
    '```latex\n\\(x^2\\)\n```',
    '\\(x\ny\\)',
    'foo \\(\\) bar',
  ])('not math: %s', (input) => {
    expect(renderMath(input)).toBe(input)
  })

  test('renders mixed block and inline', () => {
    const result = renderMath('$$x^2$$ and $y$')
    expect((result.match(/<math/g) ?? []).length).toBe(2)
  })

  test('renders math followed by punctuation', () => {
    expect(renderMath('$x$.')).toMatch(/<math.*\.$/s)
    expect(renderMath('$x$, then')).toMatch(/<math.*, then$/s)
  })

  describe('\\(...\\) inline math', () => {
    test('renders math inside bold', () => {
      const result = renderMath('the value **\\(x^2\\)** is...')
      expect(result).toContain('<math')
      expect(result).toContain('**')
      expect(result).toContain('** is...')
    })

    test('renders multiple \\(...\\) spans in one line', () => {
      const result = renderMath('let \\(x\\) and \\(y\\) be variables')
      const mathCount = (result.match(/<math/g) ?? []).length
      expect(mathCount).toBe(2)
    })

    test('renders \\(...\\) following prose with parens', () => {
      // (x) is just prose parens; \(y\) is math. Make sure the (x) doesn't
      // confuse the regex.
      const result = renderMath('a function f(x) where \\(y = f(x)\\)')
      const mathCount = (result.match(/<math/g) ?? []).length
      expect(mathCount).toBe(1)
      expect(result).toContain('f(x) where')
    })
  })

  describe('markdown around rendered math', () => {
    test('backticks in MathML are not code spans', async () => {
      // \grave renders as a literal backtick in an <mo>. Two of them made marked
      // see a code span stretching across the MathML between them.
      const html = await renderWithMarkdown('$\\grave{o}$ and $\\grave{o}$')
      expect(html).not.toContain('<code')
      expect(mathCount(html)).toBe(2)
    })

    test('pipes in MathML do not split table cells', async () => {
      const html = await renderWithMarkdown('| a | b |\n|---|---|\n| \\(|x|\\) | y |')
      expect(html).toContain('<td>y</td>')
      expect(mathCount(html)).toBe(1)
    })

    test('math inside bold and headings', async () => {
      expect(await renderWithMarkdown('**$x^2$**-time')).toMatch(
        /<strong><math.*<\/math><\/strong>/,
      )
      expect(await renderWithMarkdown('## Solving $x^2$')).toMatch(/<h2>Solving <math/)
    })

    test('code span inside a math span is restored', () => {
      // Code is set aside before math, so the latex can contain its placeholder.
      expect(renderMath('$\\frac{`n`$ end')).not.toContain('\x00')
    })

    test('placeholder-like text in the input is not replaced', async () => {
      const html = await renderWithMarkdown('\x00MATH1\x00 and $x^2$')
      expect(html).not.toContain('undefined')
      expect(mathCount(html)).toBe(1)
    })
  })

  describe('invalid LaTeX', () => {
    test('renders error indicator for invalid LaTeX', () => {
      const result = renderMath('$\\invalid{$')
      // temml renders its own error span or our fallback catches it
      expect(result).toMatch(/math-error|temml-error/)
    })
  })
})
