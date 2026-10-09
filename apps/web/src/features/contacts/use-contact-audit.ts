'use client';

import { useEffect, useState } from 'react';

import { listContactAudit, type ContactAuditEvent } from './contacts-api';

type AuditStatus = 'idle' | 'loading' | 'ready' | 'forbidden' | 'error';

type AuditSnapshot = {
  id: string;
  events: ContactAuditEvent[];
  status: Exclude<AuditStatus, 'idle' | 'forbidden'>;
};

/** Loads the contact's audit rows. Members do not call the audit API. */
export function useContactAudit(
  contactId: string | null,
  canRead: boolean,
): { events: ContactAuditEvent[]; status: AuditStatus } {
  const [snapshot, setSnapshot] = useState<AuditSnapshot | null>(null);

  useEffect(() => {
    if (contactId === null || !canRead) {
      return;
    }
    const controller = new AbortController();
    let active = true;
    listContactAudit(contactId, controller.signal)
      .then((events) => {
        if (active) {
          setSnapshot({ id: contactId, events, status: 'ready' });
        }
      })
      .catch(() => {
        if (!active || controller.signal.aborted) {
          return;
        }
        setSnapshot({ id: contactId, events: [], status: 'error' });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [contactId, canRead]);

  return visibleAudit(contactId, canRead, snapshot);
}

function visibleAudit(
  contactId: string | null,
  canRead: boolean,
  snapshot: AuditSnapshot | null,
): { events: ContactAuditEvent[]; status: AuditStatus } {
  if (contactId === null) {
    return { events: [], status: 'idle' };
  }
  if (!canRead) {
    return { events: [], status: 'forbidden' };
  }
  if (snapshot === null || snapshot.id !== contactId) {
    return { events: [], status: 'loading' };
  }
  return { events: snapshot.events, status: snapshot.status };
}
