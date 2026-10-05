// Scroll all the way to the bottom of the scroll container (past the bottom
// padding reserved for the composer), so the loading placeholder sits just
// above the composer rather than mid-screen.
export function scrollToBottom() {
  requestAnimationFrame(() => {
    const messages = document.querySelectorAll('[data-message]')
    const last = messages[messages.length - 1] as HTMLElement | undefined
    if (!last) return
    const scroller = getScrollParent(last) ?? document.scrollingElement ?? document.documentElement
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      scroller.scrollTop = scroller.scrollHeight
    } else {
      animateToBottom(scroller)
    }
  })
}

const SCROLL_DURATION_MS = 250

let cancelScroll: (() => void) | undefined

// Native smooth scrolling has a browser-chosen duration (slow in Safari), so
// tween scrollTop ourselves. Any user input stops the animation.
function animateToBottom(scroller: Element) {
  cancelScroll?.()
  const start = scroller.scrollTop
  const startTime = performance.now()
  let frame = 0

  const stop = () => {
    cancelAnimationFrame(frame)
    window.removeEventListener('wheel', stop)
    window.removeEventListener('touchstart', stop)
    window.removeEventListener('keydown', stop)
    cancelScroll = undefined
  }
  cancelScroll = stop
  window.addEventListener('wheel', stop, { passive: true })
  window.addEventListener('touchstart', stop, { passive: true })
  window.addEventListener('keydown', stop)

  const step = (now: number) => {
    const t = Math.min(1, (now - startTime) / SCROLL_DURATION_MS)
    const eased = 1 - (1 - t) ** 3 // ease-out cubic
    // Recompute the target each frame in case content height changes mid-scroll
    const target = scroller.scrollHeight - scroller.clientHeight
    scroller.scrollTop = start + (target - start) * eased
    if (t < 1) frame = requestAnimationFrame(step)
    else stop()
  }
  frame = requestAnimationFrame(step)
}

/** Track both the desktop scroller and the mobile document, including changes
 * from opening disclosures, resizing the composer, and switching chats. */
type ScrollPositionOptions = {
  onAtBottomChange: (atBottom: boolean) => void
  /** Not read. Passing it makes Svelte call the action's update() when the
   * composer resizes, since the list itself isn't observed (see below). */
  composerHeight: number
}

export function trackScrollPosition(node: HTMLElement, options: ScrollPositionOptions) {
  let frame = 0
  let content = node.firstElementChild

  function update() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      const parent = getScrollParent((content as HTMLElement | null) ?? node)
      const distance = parent
        ? parent.scrollHeight - parent.scrollTop - parent.clientHeight
        : document.documentElement.scrollHeight - window.scrollY - window.innerHeight
      options.onAtBottomChange(distance <= 24)
    })
  }

  const resizeObserver = new ResizeObserver(update)
  // Composer height updates the list's padding during Svelte's resize
  // delivery. Observing the list itself can produce a WebKit resize loop;
  // observe content and receive composer changes through update() instead.
  if (content) resizeObserver.observe(content)
  const mutationObserver = new MutationObserver(() => {
    if (content !== node.firstElementChild) {
      if (content) resizeObserver.unobserve(content)
      content = node.firstElementChild
      if (content) resizeObserver.observe(content)
    }
    update()
  })
  mutationObserver.observe(node, { childList: true })

  node.addEventListener('scroll', update, { passive: true })
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update)
  update()

  return {
    update(nextOptions: ScrollPositionOptions) {
      options = nextOptions
      update()
    },
    destroy() {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      node.removeEventListener('scroll', update)
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    },
  }
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
