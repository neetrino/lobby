'use client';

import { useEffect, useState } from 'react';

import { readActiveContactCount } from './contacts-api';

/** Active contacts in the tenant, refreshed after each list load. */
export function useActiveContactCount(revision: number): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (revision < 0) {
      return;
    }
    const controller = new AbortController();
    readActiveContactCount(controller.signal)
      .then((value) => {
        setCount(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCount(null);
        }
      });
    return () => controller.abort();
  }, [revision]);

  return count;
}
