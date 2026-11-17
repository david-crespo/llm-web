/** Distance (px) a touch must move before it counts as horizontal or vertical. */
const SLOP = 10
/** Release speed (px/ms) that settles the drawer in the flick's direction. */
const FLICK = 0.3

type Options = {
  isOpen: () => boolean
  drawerWidth: () => number
  /** How far open the drawer is during a drag, 0 to 1, then null when the
   * drag ends. */
  onDrag: (progress: number | null) => void
  onSettle: (open: boolean) => void
}

/** Drag the open drawer closed from anywhere. There's no swipe to open: a
 * swipe in from the left edge is Back, in Safari and in the home-screen app.
 * Returns a cleanup function. */
export function trackDrawerSwipe(options: Options): () => void {
  let start: { x: number; y: number } | null = null
  let dragging = false
  let progress = 1
  let last = { x: 0, t: 0, vx: 0 }

  function onTouchStart(event: TouchEvent) {
    const touch = event.touches[0]
    if (event.touches.length !== 1 || !touch || !options.isOpen()) return
    start = { x: touch.clientX, y: touch.clientY }
    dragging = false
    last = { x: touch.clientX, t: event.timeStamp, vx: 0 }
  }

  function onTouchMove(event: TouchEvent) {
    const touch = event.touches[0]
    if (!start || !touch) return
    const dx = touch.clientX - start.x
    if (!dragging) {
      const dy = touch.clientY - start.y
      if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx)) {
        start = null
        return
      }
      if (Math.abs(dx) <= SLOP) return
      // A drag to the right moves nothing, so leave the touch to scrolling.
      if (dx > 0) {
        start = null
        return
      }
      dragging = true
    }
    // Keep the page and the history list from scrolling under the drag.
    event.preventDefault()
    progress = Math.min(1, Math.max(0, 1 + dx / options.drawerWidth()))
    const dt = event.timeStamp - last.t
    if (dt > 0) last = { x: touch.clientX, t: event.timeStamp, vx: (touch.clientX - last.x) / dt }
    options.onDrag(progress)
  }

  function onTouchEnd(event: TouchEvent) {
    if (start && dragging) {
      // A finger that stopped before lifting isn't flicking.
      const vx = event.timeStamp - last.t < 100 ? last.vx : 0
      // On touchcancel (a system gesture took over, say), stay open.
      const open = event.type === 'touchcancel' || (Math.abs(vx) > FLICK ? vx > 0 : progress > 0.5)
      options.onDrag(null)
      options.onSettle(open)
    }
    start = null
    dragging = false
  }

  window.addEventListener('touchstart', onTouchStart, { passive: true })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
  window.addEventListener('touchcancel', onTouchEnd)
  return () => {
    window.removeEventListener('touchstart', onTouchStart)
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
    window.removeEventListener('touchcancel', onTouchEnd)
  }
}
