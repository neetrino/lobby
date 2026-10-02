'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Contact, SessionPrincipal } from './contact';
import { ContactsRequestError, listContacts, readSession, toRequestError } from './contacts-api';

type ListSnapshot = {
  query: string;
  token: number;
  status: 'loading' | 'ready' | 'error';
  rows: Contact[];
  nextCursor: string | null;
  error: ContactsRequestError | null;
};

export function useContactList(query: string): {
  rows: Contact[];
  nextCursor: string | null;
  status: 'loading' | 'ready' | 'error';
  error: ContactsRequestError | null;
  pending: boolean;
  revision: number;
  reload: () => void;
} {
  const [reloadToken, setReloadToken] = useState(0);
  const [snapshot, setSnapshot] = useState<ListSnapshot>({
    query: '',
    token: -1,
    status: 'loading',
    rows: [],
    nextCursor: null,
    error: null,
  });
  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requested = query;
    const token = reloadToken;
    listContacts(requested, controller.signal)
      .then((page) => {
        setSnapshot({
          query: requested,
          token,
          status: 'ready',
          rows: page.data,
          nextCursor: page.page.nextCursor,
          error: null,
        });
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setSnapshot({
          query: requested,
          token,
          status: 'error',
          rows: [],
          nextCursor: null,
          error: toRequestError(caught),
        });
      });
    return () => controller.abort();
  }, [query, reloadToken]);

  const settled = snapshot.query === query && snapshot.token === reloadToken;
  const pending = snapshot.token >= 0 && !settled;
  return {
    rows: snapshot.rows,
    nextCursor: settled ? snapshot.nextCursor : null,
    status: snapshot.token < 0 ? 'loading' : snapshot.status,
    error: snapshot.token < 0 ? null : snapshot.error,
    pending,
    revision: snapshot.token,
    reload,
  };
}

export function useSession(): {
  session: SessionPrincipal | null;
  error: ContactsRequestError | null;
} {
  const [session, setSession] = useState<SessionPrincipal | null>(null);
  const [error, setError] = useState<ContactsRequestError | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    readSession(controller.signal)
      .then((principal) => {
        setSession(principal);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!controller.signal.aborted) {
          setError(toRequestError(caught));
        }
      });
    return () => controller.abort();
  }, []);

  return { session, error };
}
