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
  ])('true: %s', (s) => expect(hasLatexChar(s)).toBe(true))

  test.each(['50', '100', '3.14', 'hello'])('false: %s', (s) => expect(hasLatexChar(s)).toBe(false))
})

describe('renderMath', () => {
  // Helper: check that renderMath produced MathML output
  const hasMathML = (result: string) => result.includes('<math')

  test.each([
    '$x$',
    '$a/b$',
    '$a,b$',
    '$x^2$',
    '$a_i$',
    '$\\frac{a}{b}$',
    '$a+b$',
    '$a-b$',
    '$(a+b)^2$',
    '$2^{10}$',
    '$3x+1$',
    '\\(x^2\\)',
    '\\(50\\)',
    '$$x^2 + y^2$$',
    '\\[x^2 + y^2\\]',
  ])('renders: %s', (input) => {
    expect(hasMathML(renderMath(input))).toBe(true)
  })

  test.each([
    'costs $50',
    'between $50 to $100',
    "used to be $50/year. Now it's $100",
    'I paid $100 for it',
    'between $5 and $10',
    '$ x^2$',
    'use `$x^2$` in LaTeX',
    '```\n$x^2$\n```',
    '```python\n$x^2$\n```',
    '\\$not math$',
    '$x\ny$',
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
