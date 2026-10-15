'use client';

import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import styles from './pagination.module.css';

/**
 * List pager. `page` is 1-based.
 * The circles are the current page and the next two, clamped to `pageCount`.
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
}): ReactElement {
  const t = useTranslations('pagination');
  const count = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), count);
  return (
    <nav className={styles.root} aria-label={t('pages')}>
      <button
        type="button"
        className={styles.step}
        disabled={current <= 1}
        onClick={() => onPage(1)}
      >
        {t('first')}
      </button>
      {pageWindow(current, count).map((number) => (
        <button
          key={number}
          type="button"
          className={number === current ? styles.current : styles.num}
          aria-current={number === current ? 'page' : undefined}
          onClick={() => onPage(number)}
        >
          {number}
        </button>
      ))}
      <button
        type="button"
        className={styles.step}
        disabled={current >= count || !endKnown}
        onClick={() => onPage(count)}
      >
        {t('last')}
      </button>
    </nav>
  );
}

function pageWindow(page: number, pageCount: number): number[] {
  const numbers: number[] = [];
  const last = Math.min(pageCount, page + 2);
  for (let number = page; number <= last; number += 1) numbers.push(number);
  return numbers;
}
