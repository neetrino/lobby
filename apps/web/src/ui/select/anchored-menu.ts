'use client';

import { useEffect, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

const gap = 6;
const edge = 8;
const menuCap = 240;

export type AnchoredBox = {
  top: number;
  left: number;
  width: number;
  upward: boolean;
  maxHeight: number;
  /** When false the panel is fully visible and must not be height-clipped. */
  capped: boolean;
};

type AnchorOptions = {
  limit?: number;
  clip?: boolean;
  contain?: boolean;
};

export type MenuPlacement = {
  anchorTop: number;
  anchorBottom: number;
  anchorLeft: number;
  anchorWidth: number;
  menuHeight: number;
  boundsTop: number;
  boundsBottom: number;
  viewportWidth: number;
  limit?: number;
  contain?: boolean;
};

/** Places a portaled menu under its trigger, or above it when the open list would be clipped. */
export function useAnchoredBox(
  anchor: RefObject<HTMLElement | null>,
  menu: RefObject<HTMLElement | null>,
  options?: AnchorOptions,
): AnchoredBox {
  const limit = options?.limit ?? menuCap;
  const clip = options?.clip ?? true;
  const contain = options?.contain ?? false;
  const [box, setBox] = useState<AnchoredBox>({
    top: 0,
    left: 0,
    width: 0,
    upward: false,
    maxHeight: limit,
    capped: !contain,
  });
  useLayoutEffect(() => {
    const place = (): void => {
      const node = anchor.current;
      if (node !== null) {
        setBox(readBox(node, menu.current, limit, clip, contain));
      }
    };
    place();
    const observed = menu.current;
    const observer = new ResizeObserver(place);
    if (observed !== null) {
      observer.observe(observed);
    }
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, clip, contain, limit, menu]);
  return box;
}

function readBox(
  anchor: HTMLElement,
  menu: HTMLElement | null,
  limit: number,
  clip: boolean,
  contain: boolean,
): AnchoredBox {
  const rect = anchor.getBoundingClientRect();
  const bounds = clip ? clipBounds(anchor) : { top: edge, bottom: window.innerHeight - edge };
  return menuPlacement({
    anchorTop: rect.top,
    anchorBottom: rect.bottom,
    anchorLeft: rect.left,
    anchorWidth: rect.width,
    menuHeight: menu?.scrollHeight ?? limit,
    boundsTop: bounds.top,
    boundsBottom: bounds.bottom,
    viewportWidth: window.innerWidth,
    limit,
    contain,
  });
}

/** Opens downward when the list fits, and upward when the space below is smaller. */
export function menuPlacement(input: MenuPlacement): AnchoredBox {
  const limit = input.limit ?? menuCap;
  const needed = Math.min(Math.max(input.menuHeight, 0), limit);
  const width = Math.max(input.anchorWidth, 160);
  const left = Math.max(edge, Math.min(input.anchorLeft, input.viewportWidth - width - edge));
  if (input.contain === true) {
    return containedBox(input, needed, left, width);
  }
  const spaceBelow = Math.max(0, input.boundsBottom - input.anchorBottom - gap);
  const spaceAbove = Math.max(0, input.anchorTop - input.boundsTop - gap);
  const upward = needed > spaceBelow && spaceAbove > spaceBelow;
  const maxHeight = Math.max(36, Math.min(limit, upward ? spaceAbove : spaceBelow));
  return {
    top: upward ? input.anchorTop - gap : input.anchorBottom + gap,
    left,
    width,
    upward,
    maxHeight,
    capped: true,
  };
}

/** Keeps a tall panel fully on screen instead of clipping it to the menu cap. */
function containedBox(
  input: MenuPlacement,
  needed: number,
  left: number,
  width: number,
): AnchoredBox {
  const available = Math.max(36, input.boundsBottom - input.boundsTop);
  const shown = Math.min(needed, available);
  const spaceBelow = input.boundsBottom - input.anchorBottom - gap;
  const spaceAbove = input.anchorTop - input.boundsTop - gap;
  let top = input.anchorBottom + gap;
  if (shown > spaceBelow && spaceAbove >= spaceBelow) {
    top = input.anchorTop - gap - shown;
  }
  if (top < input.boundsTop) {
    top = input.boundsTop;
  }
  if (top + shown > input.boundsBottom) {
    top = Math.max(input.boundsTop, input.boundsBottom - shown);
  }
  return { top, left, width, upward: false, maxHeight: shown, capped: shown < needed };
}

function clipBounds(anchor: HTMLElement): { top: number; bottom: number } {
  let top = edge;
  let bottom = window.innerHeight - edge;
  let node = anchor.parentElement;
  while (node !== null && node !== document.documentElement) {
    if (clipsVertically(node)) {
      const rect = node.getBoundingClientRect();
      top = Math.max(top, rect.top + edge);
      bottom = Math.min(bottom, rect.bottom - edge);
    }
    node = node.parentElement;
  }
  return { top, bottom };
}

function clipsVertically(node: HTMLElement): boolean {
  const overflow = getComputedStyle(node).overflowY;
  return overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden';
}

/** Fixed coordinates for a menu that grows down, or up from the trigger. */
export function anchoredStyle(box: AnchoredBox, size: 'width' | 'minWidth'): CSSProperties {
  const side = box.upward
    ? { top: 'auto', bottom: window.innerHeight - box.top }
    : { top: box.top, bottom: 'auto' };
  const clip = box.capped
    ? { maxHeight: box.maxHeight, overflow: 'auto' as const }
    : { overflow: 'visible' as const };
  return { ...side, left: box.left, ...clip, [size]: box.width };
}

export function useMenuDismiss(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onPointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      close();
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        close();
        blurActive();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close, menuRef, open, rootRef]);
}

/** Drops keyboard focus so ESC does not leave a colored ring on the trigger. */
export function blurActive(): void {
  const node = document.activeElement;
  if (node instanceof HTMLElement) node.blur();
}
