'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import type { ContactListFilters } from './contact';
import { contactsQueryString, filtersWithoutCursor, parseContactFilters } from './contacts-query';

export function useContactFilters(): {
  filters: ContactListFilters;
  query: string;
  replace: (filters: ContactListFilters) => void;
  replaceWithoutCursor: (filters: ContactListFilters) => void;
} {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filters = useMemo(() => parseContactFilters(params), [params]);

  const replace = useCallback(
    (next: ContactListFilters) => {
      const query = contactsQueryString(next);
      router.replace(query.length === 0 ? pathname : `${pathname}?${query}`, { scroll: false });
    },
    [pathname, router],
  );

  const replaceWithoutCursor = useCallback(
    (next: ContactListFilters) => {
      replace(filtersWithoutCursor(next));
    },
    [replace],
  );

  return { filters, query: contactsQueryString(filters), replace, replaceWithoutCursor };
}
