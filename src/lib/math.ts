import temml from 'temml'

// Render LaTeX math expressions to MathML
// Supports both $...$/$$...$$ and \(...\)/\[...\] delimiters
export function renderMath(text: string): string {
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

// Heuristic: does the string contain characters typical of LaTeX?
// Used to avoid treating "$50 to $100" as math.
export function hasLatexChar(s: string): boolean {
  return /[\\^_{}=\/,+\-()]/.test(s) || /^[a-zA-Z]$/.test(s)
}
