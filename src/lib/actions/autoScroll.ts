// Scroll to the bottom of the page by scrolling the last message into view
export function scrollToBottom() {
  // Allow layout to settle
  requestAnimationFrame(() => {
    const lastMessage = document.querySelector('[data-message]:last-child') as HTMLElement
    if (lastMessage) {
      lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  })
}
