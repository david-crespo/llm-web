import { describe, expect, test } from 'vitest'
import { hasLatexChar, renderMath } from './math'

describe('hasLatexChar', () => {
  test('matches backslash, caret, underscore, braces, equals', () => {
    for (const ch of ['\\', '^', '_', '{', '}', '=']) {
      expect(hasLatexChar(`a${ch}b`)).toBe(true)
    }
  })

  test('matches slash and comma', () => {
    expect(hasLatexChar('a/b')).toBe(true)
    expect(hasLatexChar('a,b')).toBe(true)
  })

  test('matches plus, minus, parentheses', () => {
    expect(hasLatexChar('a+b')).toBe(true)
    expect(hasLatexChar('a-b')).toBe(true)
    expect(hasLatexChar('(a)')).toBe(true)
  })

  test('matches a single letter (variable name)', () => {
    expect(hasLatexChar('x')).toBe(true)
    expect(hasLatexChar('N')).toBe(true)
  })

  test('rejects plain numbers', () => {
    expect(hasLatexChar('50')).toBe(false)
    expect(hasLatexChar('100')).toBe(false)
    expect(hasLatexChar('3.14')).toBe(false)
  })

  test('rejects multiple plain letters (not single-letter variable)', () => {
    expect(hasLatexChar('hello')).toBe(false)
  })
})

describe('renderMath', () => {
  // Helper: check that renderMath produced MathML output
  const hasMathML = (result: string) => result.includes('<math')

  describe('inline math with $...$', () => {
    test('renders single variable: $x$', () => {
      expect(hasMathML(renderMath('$x$'))).toBe(true)
    })

    test('renders fraction: $a/b$', () => {
      expect(hasMathML(renderMath('$a/b$'))).toBe(true)
    })

    test('renders comma expression: $a,b$', () => {
      expect(hasMathML(renderMath('$a,b$'))).toBe(true)
    })

    test('renders superscript: $x^2$', () => {
      expect(hasMathML(renderMath('$x^2$'))).toBe(true)
    })

    test('renders subscript: $a_i$', () => {
      expect(hasMathML(renderMath('$a_i$'))).toBe(true)
    })

    test('renders braces: $\\frac{a}{b}$', () => {
      expect(hasMathML(renderMath('$\\frac{a}{b}$'))).toBe(true)
    })

    test('renders addition: $a+b$', () => {
      expect(hasMathML(renderMath('$a+b$'))).toBe(true)
    })

    test('renders subtraction: $a-b$', () => {
      expect(hasMathML(renderMath('$a-b$'))).toBe(true)
    })

    test('renders parenthesized: $(a+b)^2$', () => {
      expect(hasMathML(renderMath('$(a+b)^2$'))).toBe(true)
    })

    test('renders math starting with digit: $2^{10}$', () => {
      expect(hasMathML(renderMath('$2^{10}$'))).toBe(true)
    })

    test('renders math starting with digit: $3x+1$', () => {
      expect(hasMathML(renderMath('$3x+1$'))).toBe(true)
    })
  })

  describe('inline math with \\(...\\)', () => {
    test('renders expression', () => {
      expect(hasMathML(renderMath('\\(x^2\\)'))).toBe(true)
    })

    test('always renders (no hasLatexChar check)', () => {
      expect(hasMathML(renderMath('\\(50\\)'))).toBe(true)
    })
  })

  describe('block math', () => {
    test('renders $$...$$', () => {
      const result = renderMath('$$x^2 + y^2$$')
      expect(hasMathML(result)).toBe(true)
    })

    test('renders \\[...\\]', () => {
      const result = renderMath('\\[x^2 + y^2\\]')
      expect(hasMathML(result)).toBe(true)
    })
  })

  describe('false positive avoidance', () => {
    test('does not treat "$50" as math', () => {
      const input = 'costs $50'
      expect(renderMath(input)).toBe(input)
    })

    test('does not treat "$50 to $100" as math', () => {
      const input = 'between $50 to $100'
      expect(renderMath(input)).toBe(input)
    })

    test('does not treat "$50/year ... $100" as math', () => {
      const input = "used to be $50/year. Now it's $100"
      expect(renderMath(input)).toBe(input)
    })

    test('does not treat "$100" in prose as math', () => {
      const input = 'I paid $100 for it'
      expect(renderMath(input)).toBe(input)
    })

    test('does not treat "$5 and $10" as math', () => {
      const input = 'between $5 and $10'
      expect(renderMath(input)).toBe(input)
    })

    test('does not treat "$ " opening as math', () => {
      const input = '$ x^2$'
      expect(renderMath(input)).toBe(input)
    })
  })

  describe('code block protection', () => {
    test('does not process math inside inline code', () => {
      const input = 'use `$x^2$` in LaTeX'
      expect(renderMath(input)).toBe(input)
    })

    test('does not process math inside fenced code blocks', () => {
      const input = '```\n$x^2$\n```'
      expect(renderMath(input)).toBe(input)
    })
  })

  describe('multiple expressions', () => {
    test('renders multiple inline expressions in one string', () => {
      const result = renderMath('$x$ and $y$')
      // Both should become MathML, separated by " and "
      const mathCount = (result.match(/<math/g) ?? []).length
      expect(mathCount).toBe(2)
    })

    test('renders mixed block and inline', () => {
      const result = renderMath('$$x^2$$ and $y$')
      const mathCount = (result.match(/<math/g) ?? []).length
      expect(mathCount).toBe(2)
    })
  })

  describe('escaped dollars', () => {
    test('escaped opening $ is not treated as math delimiter', () => {
      const input = '\\$not math$'
      expect(renderMath(input)).toBe(input)
    })
  })

  describe('newlines in inline math', () => {
    test('$ does not match across newlines', () => {
      const input = '$x\ny$'
      expect(renderMath(input)).toBe(input)
    })
  })

  describe('code block with language tag', () => {
    test('does not process math inside fenced code with language', () => {
      const input = '```python\n$x^2$\n```'
      expect(renderMath(input)).toBe(input)
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
