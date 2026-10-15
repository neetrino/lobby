'use client';

import type { ReactElement } from 'react';

import { Pagination } from '../../ui/pagination/pagination';
import styles from './contacts.module.css';

export function ContactPager({
  page,
  total,
  limit,
  hasNext,
  onPage,
}: {
  page: number;
  total: number | null;
  limit: number;
  hasNext: boolean;
  onPage: (page: number) => void;
}): ReactElement {
  const pageCount =
    total === null ? page + (hasNext ? 1 : 0) : Math.max(1, Math.ceil(total / limit));
  return (
    <footer className={styles.pager}>
      <Pagination
        page={page}
        pageCount={pageCount}
        endKnown={total !== null || !hasNext}
        onPage={onPage}
      />
    </footer>
  );
}
