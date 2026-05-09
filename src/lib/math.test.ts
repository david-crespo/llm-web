import { describe, expect, test } from 'vitest'
import { hasLatexChar, renderMath } from './math'

describe('hasLatexChar', () => {
  test.each([
    'a\\b',
    'a^b',
    'a_b',
    'a{b',
    'a}b',
    'a=b',
    'a/b',
    'a,b',
    'a+b',
    'a-b',
    '(a)',
    'x',
    'N',
    'dx',
    'dy',
    'hello',
  ])('true: %s', (s) => expect(hasLatexChar(s)).toBe(true))

  test.each(['50', '100', '3.14'])('false: %s', (s) => expect(hasLatexChar(s)).toBe(false))
})

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

    test('renders math containing both \\sim and \\$ without error', () => {
      const result = renderMath('Hyperscaler capex $\\sim\\$900$B total')
      expect(result).toContain('<math')
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
    '\\$not math$',
    '$x\ny$',
    '**$30.7k** of depreciation, versus **$13.6k** for a Toyota',
  ])('not math: %s', (input) => {
    expect(renderMath(input)).toBe(input)
  })

  describe('multiple expressions', () => {
    test('renders multiple inline expressions in one string', () => {
      const result = renderMath('$x$ and $y$')
      const mathCount = (result.match(/<math/g) ?? []).length
      expect(mathCount).toBe(2)
    })

    test('renders mixed block and inline', () => {
      const result = renderMath('$$x^2$$ and $y$')
      const mathCount = (result.match(/<math/g) ?? []).length
      expect(mathCount).toBe(2)
    })
  })

  describe('math adjacent to punctuation', () => {
    test('renders math followed by period', () => {
      const result = renderMath('$x$.')
      expect(result).toContain('<math')
      expect(result).toMatch(/\.$/)
    })

    test('renders math followed by comma', () => {
      const result = renderMath('$x$, then')
      expect(result).toContain('<math')
      expect(result).toContain(', then')
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
