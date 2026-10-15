'use client';

import { useTranslations } from 'next-intl';
import { useRef, type ReactElement, type RefObject } from 'react';

import styles from './pagination.module.css';

/**
 * List pager. `page` is 1-based.
 * The circles are the previous page, the current page, and the next page.
 * Hidden when the list has a single page and nothing can be changed.
 * `endKnown` stays false while a cursor list has not reached the last page.
 */
export function Pagination({
  page,
  pageCount,
  endKnown = true,
  onPage,
}: {
  page: number;
  pageCount: number;
  endKnown?: boolean;
  onPage: (page: number) => void;
}): ReactElement | null {
  const t = useTranslations('pagination');
  const rootRef = useRef<HTMLElement>(null);
  const count = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), count);
  if (count <= 1 && endKnown && current <= 1) return null;
  return (
    <nav ref={rootRef} className={styles.root} aria-label={t('pages')}>
      <button
        type="button"
        className={styles.step}
        disabled={current <= 1}
        onClick={() => changePage(1, current, onPage, rootRef)}
      >
        {t('first')}
      </button>
      {pageWindow(current, count).map((number) => (
        <button
          key={number}
          type="button"
          className={number === current ? styles.current : styles.num}
          aria-current={number === current ? 'page' : undefined}
          onClick={() => changePage(number, current, onPage, rootRef)}
        >
          {number}
        </button>
      ))}
      <button
        type="button"
        className={styles.step}
        disabled={current >= count || !endKnown}
        onClick={() => changePage(count, current, onPage, rootRef)}
      >
        {t('last')}
      </button>
    </nav>
  );
}

function changePage(
  next: number,
  current: number,
  onPage: (page: number) => void,
  rootRef: RefObject<HTMLElement | null>,
): void {
  if (next === current) return;
  onPage(next);
  window.requestAnimationFrame(() => scrollPageTop(rootRef.current));
}

const scrollMs = 420;

function scrollPageTop(from: HTMLElement | null): void {
  const scroller = nearestScroller(from);
  if (scroller === null) {
    window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' });
    return;
  }
  animateScroll(scroller);
}

function animateScroll(node: HTMLElement): void {
  const start = node.scrollTop;
  if (start <= 0) return;
  if (reduceMotion()) {
    node.scrollTop = 0;
    return;
  }
  const begun = performance.now();
  function frame(now: number): void {
    const t = Math.min(1, (now - begun) / scrollMs);
    node.scrollTop = start * (1 - easeOut(t));
    if (t < 1) window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 4;
}

function reduceMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function nearestScroller(from: HTMLElement | null): HTMLElement | null {
  let node = from?.parentElement ?? null;
  let fallback: HTMLElement | null = null;
  while (node !== null) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      if (node.scrollTop > 0) return node;
      fallback ??= node;
    }
    node = node.parentElement;
  }
  return fallback;
}

function pageWindow(page: number, pageCount: number): number[] {
  const start = Math.max(1, Math.min(page - 1, pageCount - 2));
  const last = Math.min(pageCount, start + 2);
  const numbers: number[] = [];
  for (let number = start; number <= last; number += 1) numbers.push(number);
  return numbers;
}
