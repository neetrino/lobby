'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { listContacts } from '../contacts/contacts-api';
import type { Contact } from '../contacts/contact';
import { OverlayPortal } from '../contacts/overlay-portal';
import {
  listAvailableTables,
  ReservationRequestError,
  type ReservationDraft,
} from './reservations-api';
import {
  STAFF_SOURCES,
  toLocalInput,
  type DiningTable,
  type ReservationDetail,
  type StaffSource,
  type Venue,
} from './reservations-model';
import styles from './reservations.module.css';

type Member = { id: string; name: string };

export function ReservationForm({
  detail,
  venues,
  members,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  detail: ReservationDetail | null;
  venues: Venue[];
  members: Member[];
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (draft: ReservationDraft) => void;
}) {
  const t = useTranslations('reservations');
  const [draft, setDraft] = useState<ReservationDraft>(draftFrom(detail, venues[0]?.id ?? ''));
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tablesNote, setTablesNote] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void listContacts('limit=100&sort=asc', controller.signal)
      .then((page) => setContacts(page.data))
      .catch(() => setContacts([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (draft.locationId === '' || draft.startsAt === '') return undefined;
    const controller = new AbortController();
    const startsAt = new Date(draft.startsAt).toISOString();
    void listAvailableTables({
      locationId: draft.locationId,
      startsAt,
      durationMinutes: draft.durationMinutes,
      guestCount: draft.guestCount,
      ...(detail === null ? {} : { excludeReservationId: detail.id }),
    }, controller.signal)
      .then((next) => {
        setTables(next);
        setTablesNote(next.length === 0 ? t('noTables') : null);
      })
      .catch((reason: unknown) => {
        if (reason instanceof ReservationRequestError && reason.code !== 'REQUEST_FAILED') {
          setTables([]);
          setTablesNote(t('noTables'));
        }
      });
    return () => controller.abort();
  }, [detail, draft.durationMinutes, draft.guestCount, draft.locationId, draft.startsAt, t]);

  return (
    <OverlayPortal onDismiss={onClose}>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(draft);
        }}
      >
        <h2>{detail === null ? t('createTitle') : t('editTitle')}</h2>
        <label>{t('location')}
          <select value={draft.locationId} onChange={(event) => setDraft({ ...draft, locationId: event.target.value, tableId: '' })}>
            {venues.map((venue) => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
          </select>
        </label>
        <label>{t('starts')}
          <input type="datetime-local" required value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} />
        </label>
        <label>{t('duration')}
          <input type="number" min={1} max={1440} required value={draft.durationMinutes} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })} />
        </label>
        <label>{t('guests')}
          <input type="number" min={1} max={100} required value={draft.guestCount} onChange={(event) => setDraft({ ...draft, guestCount: Number(event.target.value) })} />
        </label>
        <label>{t('table')}
          <select required value={draft.tableId} onChange={(event) => setDraft({ ...draft, tableId: event.target.value })}>
            <option value="">{t('chooseTable')}</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>{table.name} · {table.minCapacity}–{table.capacity}</option>
            ))}
          </select>
        </label>
        {tablesNote === null ? null : <p className={styles.muted}>{tablesNote}</p>}
        <label>{t('name')}
          <input required maxLength={200} value={draft.customerName} onChange={(event) => setDraft({ ...draft, customerName: event.target.value })} />
        </label>
        <label>{t('phone')}
          <input value={draft.phone} maxLength={32} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} />
        </label>
        <label>{t('email')}
          <input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
        </label>
        <label>{t('contact')}
          <select value={draft.contactId} onChange={(event) => setDraft({ ...draft, contactId: event.target.value })}>
            <option value="">{t('noContact')}</option>
            {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}
          </select>
        </label>
        <label>{t('assignee')}
          <select value={draft.assignedUserId} onChange={(event) => setDraft({ ...draft, assignedUserId: event.target.value })}>
            <option value="">{t('allAssignees')}</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </label>
        {detail === null ? (
          <label>{t('source')}
            <select value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value as StaffSource })}>
              {STAFF_SOURCES.map((source) => <option key={source} value={source}>{t(`sources.${source}`)}</option>)}
            </select>
          </label>
        ) : null}
        <label>{t('note')}
          <textarea maxLength={500} value={draft.customerNote} onChange={(event) => setDraft({ ...draft, customerNote: event.target.value })} />
        </label>
        {error === null ? null : <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="button" onClick={onClose}>{t('close')}</button>
          <button type="submit" disabled={pending || draft.tableId === ''}>{detail === null ? t('new') : t('save')}</button>
        </div>
      </form>
    </OverlayPortal>
  );
}

function draftFrom(detail: ReservationDetail | null, locationId: string): ReservationDraft {
  if (detail === null) {
    return {
      locationId,
      tableId: '',
      startsAt: '',
      durationMinutes: 90,
      guestCount: 2,
      customerName: '',
      phone: '',
      email: '',
      contactId: '',
      assignedUserId: '',
      customerNote: '',
      source: 'STAFF',
    };
  }
  return {
    locationId: detail.locationId,
    tableId: detail.tableId ?? '',
    startsAt: toLocalInput(detail.startsAt),
    durationMinutes: detail.durationMinutes,
    guestCount: detail.guestCount,
    customerName: detail.customerName,
    phone: detail.customerPhone ?? '',
    email: detail.customerEmail ?? '',
    contactId: detail.contactId ?? '',
    assignedUserId: detail.assignedUserId ?? '',
    customerNote: detail.customerNote ?? '',
    source: 'STAFF',
  };
}
