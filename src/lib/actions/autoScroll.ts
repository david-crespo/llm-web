// Scroll all the way to the bottom of the scroll container (past the bottom
// padding reserved for the composer), so the loading placeholder sits just
// above the composer rather than mid-screen.
export function scrollToBottom() {
  requestAnimationFrame(() => {
    const messages = document.querySelectorAll('[data-message]')
    const last = messages[messages.length - 1] as HTMLElement | undefined
    if (!last) return
    const parent = getScrollParent(last)
    if (parent) {
      parent.scrollTo({ top: parent.scrollHeight, behavior: 'smooth' })
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
    }
  })
}

// Scroll so the top of the new answer aligns with the top of the viewport, so
// the reader starts at the beginning of the answer rather than its end. The
// loading placeholder is still in the DOM at this point (isCurrentLoading flips
// later), so exclude it to target the answer itself.
export function scrollToAnswer() {
  requestAnimationFrame(() => {
    const messages = document.querySelectorAll('[data-message]:not([data-loading])')
    const last = messages[messages.length - 1] as HTMLElement | undefined
    last?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

// Nearest ancestor that actually scrolls vertically. On desktop this is the
// MessageList (md:overflow-y-auto); on mobile nothing matches and we fall back
// to the document/window.
function getScrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement
  while (node) {
    const overflowY = getComputedStyle(node).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }
  return null
}
