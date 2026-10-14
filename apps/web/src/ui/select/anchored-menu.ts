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
};

/** Places a portaled menu under its trigger, or above it when the open list would be clipped. */
export function useAnchoredBox(
  anchor: RefObject<HTMLElement | null>,
  menu: RefObject<HTMLElement | null>,
): AnchoredBox {
  const [box, setBox] = useState<AnchoredBox>({
    top: 0,
    left: 0,
    width: 0,
    upward: false,
    maxHeight: menuCap,
  });
  useLayoutEffect(() => {
    const place = (): void => {
      const node = anchor.current;
      if (node === null) {
        return;
      }
      const rect = node.getBoundingClientRect();
      const bounds = clipBounds(node);
      const menuHeight = menu.current?.scrollHeight ?? menuCap;
      setBox(
        menuPlacement({
          anchorTop: rect.top,
          anchorBottom: rect.bottom,
          anchorLeft: rect.left,
          anchorWidth: rect.width,
          menuHeight,
          boundsTop: bounds.top,
          boundsBottom: bounds.bottom,
          viewportWidth: window.innerWidth,
        }),
      );
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, menu]);
  return box;
}

/** Opens downward when the list fits, and upward when the space below is smaller. */
export function menuPlacement(input: MenuPlacement): AnchoredBox {
  const width = Math.max(input.anchorWidth, 160);
  const left = Math.max(edge, Math.min(input.anchorLeft, input.viewportWidth - width - edge));
  const spaceBelow = Math.max(0, input.boundsBottom - input.anchorBottom - gap);
  const spaceAbove = Math.max(0, input.anchorTop - input.boundsTop - gap);
  const needed = Math.min(Math.max(input.menuHeight, 0), menuCap);
  const upward = needed > spaceBelow && spaceAbove > spaceBelow;
  const maxHeight = Math.max(36, Math.min(menuCap, upward ? spaceAbove : spaceBelow));
  return {
    top: upward ? input.anchorTop - gap : input.anchorBottom + gap,
    left,
    width,
    upward,
    maxHeight,
  };
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
  return { ...side, left: box.left, maxHeight: box.maxHeight, [size]: box.width };
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
