import DOMPurify from 'dompurify'

// Open external links in new tabs. Configured once at module scope
// rather than per-render to avoid accumulating duplicate hooks.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export default DOMPurify
