type Layer = {
  element: HTMLElement;
  previous: Element | null;
};

const layers: Layer[] = [];

const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Tracks open portals so only the top one is interactive. */
export function pushLayer(element: HTMLElement): void {
  layers.push({ element, previous: document.activeElement });
  syncLayers();
  focusFirst(element);
}

export function removeLayer(element: HTMLElement): void {
  const index = layers.findIndex((layer) => layer.element === element);
  if (index < 0) {
    return;
  }
  const [removed] = layers.splice(index, 1);
  syncLayers();
  restoreFocus(removed);
}

export function isTopLayer(element: HTMLElement): boolean {
  return layers.at(-1)?.element === element;
}

export function trapTab(event: KeyboardEvent, element: HTMLElement): void {
  const items = focusable(element);
  const first = items[0];
  const last = items.at(-1);
  if (first === undefined || last === undefined) {
    event.preventDefault();
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function syncLayers(): void {
  document.body.style.overflow = layers.length === 0 ? '' : 'hidden';
  const top = layers.at(-1)?.element;
  for (const child of document.body.children) {
    if (child instanceof HTMLElement) {
      child.inert = top !== undefined && child !== top;
    }
  }
}

function restoreFocus(removed: Layer | undefined): void {
  const previous = removed?.previous;
  if (previous instanceof HTMLElement && document.contains(previous)) {
    previous.focus();
  }
}

function focusFirst(element: HTMLElement): void {
  const target = focusable(element)[0];
  (target ?? element).focus();
}

function focusable(element: HTMLElement): HTMLElement[] {
  return [...element.querySelectorAll<HTMLElement>(FOCUSABLE)];
}
