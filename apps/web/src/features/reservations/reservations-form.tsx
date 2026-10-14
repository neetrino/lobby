'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { listContacts } from '../contacts/contacts-api';
import type { Contact } from '../contacts/contact';
import { DateField } from '../../ui/calendar/calendar';
import { Select, type SelectOption } from '../../ui/select/select';
import { SheetFrame } from '../../ui/side-sheet/side-sheet';
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
    void listAvailableTables(
      {
        locationId: draft.locationId,
        startsAt,
        durationMinutes: draft.durationMinutes,
        guestCount: draft.guestCount,
        ...(detail === null ? {} : { excludeReservationId: detail.id }),
      },
      controller.signal,
    )
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

  const title = detail === null ? t('createTitle') : t('editTitle');
  return (
    <OverlayPortal onDismiss={onClose}>
      <SheetFrame label={title} closeLabel={t('close')}>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(draft);
          }}
        >
          <header className={styles.formHead}>
            <h2>{title}</h2>
          </header>
          <div className={styles.formBody}>
            <fieldset>
              <legend>{t('sections.guest')}</legend>
              <label>
                {t('name')}
                <input
                  required
                  maxLength={200}
                  value={draft.customerName}
                  onChange={(event) => setDraft({ ...draft, customerName: event.target.value })}
                />
              </label>
              <label>
                {t('phone')}
                <input
                  value={draft.phone}
                  maxLength={32}
                  onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
                />
              </label>
              <label>
                {t('email')}
                <input
                  type="email"
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                />
              </label>
              <label>
                {t('note')}
                <textarea
                  maxLength={500}
                  value={draft.customerNote}
                  onChange={(event) => setDraft({ ...draft, customerNote: event.target.value })}
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>{t('sections.when')}</legend>
              <div className={styles.fieldRow}>
                <label>
                  {t('starts')}
                  <DateField
                    mode="datetime"
                    required
                    value={draft.startsAt}
                    onChange={(startsAt) => setDraft({ ...draft, startsAt })}
                  />
                </label>
                <label>
                  {t('duration')}
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    required
                    value={draft.durationMinutes}
                    onChange={(event) =>
                      setDraft({ ...draft, durationMinutes: Number(event.target.value) })
                    }
                  />
                </label>
              </div>
            </fieldset>
            <fieldset>
              <legend>{t('sections.seating')}</legend>
              <label>
                {t('location')}
                <Select
                  value={draft.locationId}
                  options={venues.map((venue) => ({ value: venue.id, label: venue.name }))}
                  onChange={(locationId) => setDraft({ ...draft, locationId, tableId: '' })}
                />
              </label>
              <label>
                {t('guests')}
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={draft.guestCount}
                  onChange={(event) =>
                    setDraft({ ...draft, guestCount: Number(event.target.value) })
                  }
                />
              </label>
              <label>
                {t('table')}
                <Select
                  required
                  value={draft.tableId}
                  options={tableOptions(t('chooseTable'), tables)}
                  onChange={(tableId) => setDraft({ ...draft, tableId })}
                />
              </label>
              {tablesNote === null ? null : <p className={styles.muted}>{tablesNote}</p>}
            </fieldset>
            <fieldset>
              <legend>{t('sections.people')}</legend>
              <label>
                {t('contact')}
                <Select
                  value={draft.contactId}
                  options={namedOptions(t('noContact'), contacts)}
                  onChange={(contactId) => setDraft({ ...draft, contactId })}
                />
              </label>
              <label>
                {t('assignee')}
                <Select
                  value={draft.assignedUserId}
                  options={namedOptions(t('allAssignees'), members)}
                  onChange={(assignedUserId) => setDraft({ ...draft, assignedUserId })}
                />
              </label>
            </fieldset>
            {detail === null ? (
              <fieldset>
                <legend>{t('source')}</legend>
                <label>
                  {t('source')}
                  <Select
                    value={draft.source}
                    options={STAFF_SOURCES.map((source) => ({
                      value: source,
                      label: t(`sources.${source}`),
                    }))}
                    onChange={(next) => {
                      const source = staffSource(next);
                      if (source !== null) {
                        setDraft({ ...draft, source });
                      }
                    }}
                  />
                </label>
              </fieldset>
            ) : null}
            {error === null ? null : <p className={styles.error}>{error}</p>}
          </div>
          <div className={styles.formFoot}>
            <button
              type="submit"
              className={styles.primary}
              disabled={pending || draft.tableId === ''}
            >
              {detail === null ? t('new') : t('save')}
            </button>
          </div>
        </form>
      </SheetFrame>
    </OverlayPortal>
  );
}

function namedOptions(
  emptyLabel: string,
  rows: readonly { id: string; name: string }[],
): SelectOption[] {
  return [
    { value: '', label: emptyLabel },
    ...rows.map((row) => ({ value: row.id, label: row.name })),
  ];
}

function tableOptions(emptyLabel: string, tables: readonly DiningTable[]): SelectOption[] {
  return [
    { value: '', label: emptyLabel },
    ...tables.map((table) => ({
      value: table.id,
      label: `${table.name} · ${table.minCapacity}–${table.capacity}`,
    })),
  ];
}

function staffSource(value: string): StaffSource | null {
  return STAFF_SOURCES.find((source) => source === value) ?? null;
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
