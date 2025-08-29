// Auto-scroll to bottom when content changes and when enabled
export function autoScroll(node: HTMLElement, enabled = true) {
  function scroll() {
    if (!enabled) return;
    // Allow layout to settle
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }

  const observer = new MutationObserver(() => scroll());
  observer.observe(node, { childList: true, subtree: true });

  // initial
  scroll();

  return {
    update(value: boolean) {
      enabled = !!value;
      scroll();
    },
    destroy() {
      observer.disconnect();
    }
  };
}

