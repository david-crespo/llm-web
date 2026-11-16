import DOMPurify from 'dompurify'

const MATHML = 'http://www.w3.org/1998/Math/MathML'

// The CSS properties Temml writes on MathML, minus `position` (only \llap
// uses it). Longhands, because that's what iterating a style declaration gives.
const MATH_STYLE =
  /^(color|background-color|display|width|text-align|justify-content|padding(-\w+)?|border(-[\w-]+)?|font-(weight|style|family)|math-(depth|style))$/

// Classes this app's own rendering adds: highlight.js, Temml, citation badges,
// and math errors.
const OWN_CLASS = /^(hljs|language-|tml-|cite-badge$|math-error$)/

// Configured once at module scope rather than per-render to avoid
// accumulating duplicate hooks.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    // Open links in new tabs.
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }

  // Model output can contain raw HTML, and the default config would let it
  // draw over the app: inline styles (`position: fixed`), the app's own
  // utility classes (`fixed inset-0`), or ids that CSS or scripts target. Keep
  // only what our renderers produce.
  node.removeAttribute('id')
  if (node.hasAttribute('class')) {
    const own = [...node.classList].filter((c) => OWN_CLASS.test(c))
    if (own.length > 0) node.setAttribute('class', own.join(' '))
    else node.removeAttribute('class')
  }
  if (node.hasAttribute('style')) {
    const { style } = node as Element & ElementCSSInlineStyle
    if (node.namespaceURI !== MATHML || !style) {
      node.removeAttribute('style')
      return
    }
    // Copy first: removing properties changes the live declaration.
    for (const prop of Array.from(style)) {
      if (!MATH_STYLE.test(prop)) style.removeProperty(prop)
    }
  }
})

export default DOMPurify
