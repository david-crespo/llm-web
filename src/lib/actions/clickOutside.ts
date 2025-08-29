export type ClickOutsideOptions = {
  enabled?: boolean;
  onOut?: (event: MouseEvent | TouchEvent) => void;
};

// Generic click outside action
export function clickOutside(node: HTMLElement, options: ClickOutsideOptions = {}) {
  let { enabled = true, onOut } = options;

  const handle = (event: MouseEvent | TouchEvent) => {
    if (!enabled) return;
    const target = event.target as Node | null;
    if (target && !node.contains(target)) {
      onOut?.(event);
      node.dispatchEvent(new CustomEvent('outclick'));
    }
  };

  const add = () => {
    document.addEventListener('click', handle, true);
    document.addEventListener('touchstart', handle, true);
  };
  const remove = () => {
    document.removeEventListener('click', handle, true);
    document.removeEventListener('touchstart', handle, true);
  };

  add();

  return {
    update(next?: ClickOutsideOptions) {
      enabled = next?.enabled ?? true;
      onOut = next?.onOut;
    },
    destroy() {
      remove();
    }
  };
}

