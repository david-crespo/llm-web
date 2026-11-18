import temml from 'temml'

// Render LaTeX math expressions to MathML
// Supports both $...$/$$...$$ and \(...\)/\[...\] delimiters
//
// The returned text has placeholders where the math was, and restore puts the
// MathML back into the HTML that markdown produces. Markdown must not see the
// MathML: \grave renders to a literal backtick, for example, and two of them
// make a code span out of everything in between.
export function renderMath(text: string): { text: string; restore: (html: string) => string } {
  // The placeholders below use NUL, so drop any NULs already in the text
  // oxlint-disable-next-line no-control-regex
  text = text.replace(/\x00/g, '')

  // Protect code blocks and inline code from math processing
  const codeBlocks: string[] = []
  text = text.replace(/(```|~~~)[\s\S]*?\1|`[^`\n]+`/g, (match) => {
    codeBlocks.push(match)
    return `\x00CODE${codeBlocks.length - 1}\x00`
  })
  const restoreCode = (s: string) =>
    // oxlint-disable-next-line no-control-regex
    s.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[parseInt(i)])

  const math: string[] = []
  const toMathML = (latex: string, displayMode: boolean) => {
    // A math span can contain a code placeholder, as in $\frac{`n`$.
    latex = restoreCode(latex)
    let html: string
    try {
      html = temml.renderToString(latex, { displayMode })
    } catch {
      html = `<code class="math-error">${latex}</code>`
    }
    math.push(html)
    return `\x00MATH${math.length - 1}\x00`
  }

  // Block math: $$...$$ or \[...\]
  text = text.replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g, (_, d1, d2) =>
    toMathML((d1 ?? d2).trim(), true),
  )
  // Inline math: $...$ (not \$) or \(...\)
  // For $...$, require at least one LaTeX-ish char to avoid "$50 to $100" false positives.
  // Content allows `\$` (LaTeX-escaped dollar) so it is not mistaken for a closer;
  // the closing $ likewise must not be preceded by `\` (or a space).
  text = text.replace(
    /(?<!\\)\$(?! )((?:[^$\n]|\\\$)+?)(?<![ \\])\$|\\\((.+?)\\\)/g,
    (match, d1, d2, offset, source) => {
      // d1 is from $...$, d2 is from \(...\)
      if (d1 !== undefined && !shouldRenderDollarMath(d1, source.slice(offset + match.length))) {
        return match
      }
      return toMathML((d1 ?? d2).trim(), false)
    },
  )

  return {
    text: restoreCode(text),
    // oxlint-disable-next-line no-control-regex
    restore: (html) => html.replace(/\x00MATH(\d+)\x00/g, (_, i) => math[parseInt(i)]),
  }
}

// Heuristic: does the string contain characters typical of LaTeX?
// Used to avoid treating "$50 to $100" as math.
function hasLatexChar(s: string): boolean {
  return /[\\^_{}=/,+\-()]/.test(s) || /^[a-zA-Z]+$/.test(s)
}

function shouldRenderDollarMath(s: string, afterMatch: string): boolean {
  if (!hasLatexChar(s)) return false
  // Markdown bold inside a $...$ span means the lazy match is straddling prose.
  if (s.includes('**')) return false
  // Skip dollar amounts paired across prose: **$30.7k** of depreciation, versus **$13.6k**
  if (/^\d/.test(s) && /\s/.test(s) && !/[\\^_{}]/.test(s)) return false
  // In "$50-$100", the second dollar sign is the start of another amount, not a math closer.
  if (/^\d[\d,.]*(?:[kKmMbB])?[-+]\s*$/.test(s) && /^\d/.test(afterMatch)) return false
  return true
}
