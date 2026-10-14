'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { readContact } from '../contacts/contacts-api';
import { ContactsShell } from '../contacts/contacts-shell';
import shell from '../contacts/contacts.module.css';
import { useSession } from '../contacts/use-contact-list';
import { readTeamDirectory } from '../team/team-api';
import glass from '../../ui/glass/glass.module.css';
import { DateField } from '../../ui/calendar/calendar';
import { FilterMenu } from '../../ui/filter-menu/filter-menu';
import { FilterField, SearchFilters } from '../../ui/search-filters/search-filters';
import { SegmentedControl } from '../../ui/segmented-control/segmented-control';
import {
  cancelReservation,
  createReservation,
  listDiningTables,
  listReservations,
  listVenues,
  readHistory,
  readReservation,
  ReservationRequestError,
  transitionReservation,
  updateReservation,
  type ReservationDraft,
} from './reservations-api';
import { ReservationDrawer } from './reservations-drawer';
import { ReservationForm } from './reservations-form';
import {
  RESERVATION_STATUSES,
  canCreateReservation,
  canUpdateReservation,
  shiftDay,
  todayInput,
  type DiningTable,
  type ReservationDetail,
  type ReservationSummary,
  type StatusHistoryItem,
  type Venue,
} from './reservations-model';
import { ReservationViews } from './reservations-views';
import styles from './reservations.module.css';

type Member = { id: string; name: string };
type ViewName = 'list' | 'calendar' | 'timeline';
type LoadedDetail = {
  id: string;
  detail: ReservationDetail | null;
  history: StatusHistoryItem[];
};
type NamedContact = { id: string; name: string | null };

export function ReservationsWorkspace() {
  const t = useTranslations('reservations');
  const locale = useLocale();
  const router = useRouter();
  const { session, error: sessionError } = useSession();
  const role = session?.user.role;
  const canCreate = role !== undefined && canCreateReservation(role);
  const canUpdate = role !== undefined && canUpdateReservation(role);
  const board = useBoard();
  const detail = useDetail(board.selectedId, board.revision);

  useEffect(() => {
    if (sessionError?.status === 401) router.replace(`/${locale}/login`);
  }, [locale, router, sessionError]);

  return (
    <div className={shell.app}>
      <ContactsShell session={session} current="reservations" />
      <main className={`${shell.main} ${glass.canvas}`}>
        <div className={board.view === 'calendar' ? `${styles.page} ${styles.pageFit}` : styles.page}>
          <Header
            day={board.fromDay}
            locationId={board.locationId}
            venues={board.venues}
            canCreate={canCreate}
            onDay={(day) => board.setRange(day, day)}
            onShift={board.shift}
            onLocation={board.setLocationId}
            onCreate={() => board.setEditing('create')}
          />
          <Filters
            fromDay={board.fromDay}
            toDay={board.toDay}
            status={board.status}
            view={board.view}
            assigneeId={board.assigneeId}
            search={board.search}
            members={board.members}
            onFrom={(day) => board.setRange(day, board.toDay)}
            onTo={(day) => board.setRange(board.fromDay, day)}
            onStatus={board.setStatus}
            onView={board.setView}
            onAssignee={board.setAssigneeId}
            onSearch={board.setSearch}
          />
          {board.failed === null ? null : (
            <p className={styles.error} role="alert">
              {messageFor(t, board.failed)}
            </p>
          )}
          {board.loading ? <p>{t('loading')}</p> : null}
          {!board.loading && board.rows.length === 0 ? (
            <p className={styles.muted}>{t('empty')}</p>
          ) : null}
          <ReservationViews
            view={board.view}
            rows={board.rows}
            names={{
              venues: board.venues,
              tables: board.tables,
              locale,
              onOpen: board.setSelectedId,
            }}
          />
          <Pager
            hasPrevious={board.cursorStack.length > 0}
            hasNext={board.nextCursor !== null}
            onPrevious={board.previousPage}
            onNext={board.nextPage}
          />
        </div>
        {detail.detail === null ? null : (
          <ReservationDrawer
            detail={detail.detail}
            history={detail.history}
            venueName={nameOf(board.venues, detail.detail.locationId)}
            tableName={tableOf(board.tables, detail.detail.tableId)}
            assigneeName={memberOf(board.members, detail.detail.assignedUserId)}
            contactName={detail.contactName ?? t('noContact')}
            canUpdate={canUpdate}
            pending={board.pending}
            error={
              board.actionError === null || board.editing !== null
                ? null
                : messageFor(t, board.actionError)
            }
            onClose={() => board.setSelectedId(null)}
            onEdit={() => board.setEditing('edit')}
            onCancel={(reason) =>
              void board.run(() => cancelReservation(detail.detail!.id, reason))
            }
            onTransition={(action) =>
              void board.run(() => transitionReservation(detail.detail!.id, action))
            }
          />
        )}
        {board.editing === null ? null : (
          <ReservationForm
            detail={board.editing === 'edit' ? detail.detail : null}
            venues={board.venues}
            members={board.members}
            pending={board.pending}
            error={board.actionError === null ? null : messageFor(t, board.actionError)}
            onClose={() => board.setEditing(null)}
            onSubmit={(draft) => void board.save(draft, detail.detail)}
          />
        )}
      </main>
    </div>
  );
}

function useBoard() {
  const today = todayInput();
  const [fromDay, setFromDay] = useState(today);
  const [toDay, setToDay] = useState(today);
  const [status, setStatus] = useState('');
  const [locationId, setLocationId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<ViewName>('list');
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([]);
  const [rows, setRows] = useState<ReservationSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<'create' | 'edit' | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const listKey = [
    fromDay,
    toDay,
    status,
    locationId,
    assigneeId,
    search,
    cursor ?? '',
    String(revision),
  ].join('\0');
  const [requestedKey, setRequestedKey] = useState(listKey);
  if (requestedKey !== listKey) {
    setRequestedKey(listKey);
    setLoading(true);
  }

  useEffect(() => {
    const controller = new AbortController();
    void listReservations(
      { fromDay, toDay, status, locationId, assigneeId, search, cursor },
      controller.signal,
    )
      .then((page) => {
        setRows(page.rows);
        setNextCursor(page.nextCursor);
        setFailed(null);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setFailed(codeOf(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [assigneeId, cursor, fromDay, locationId, revision, search, status, toDay]);

  useEffect(() => {
    const controller = new AbortController();
    void listVenues(controller.signal)
      .then(setVenues)
      .catch(() => setVenues([]));
    void readTeamDirectory(controller.signal)
      .then((directory) =>
        setMembers(directory.members.map((member) => ({ id: member.id, name: member.name }))),
      )
      .catch(() => setMembers([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const ids = locationId === '' ? venues.map((venue) => venue.id) : [locationId];
    void Promise.all(ids.map((id) => listDiningTables(id, controller.signal)))
      .then((groups) => setTables(groups.flat()))
      .catch(() => setTables([]));
    return () => controller.abort();
  }, [locationId, venues]);

  function resetPage(): void {
    setCursor(null);
    setCursorStack([]);
  }

  async function run(action: () => Promise<unknown>): Promise<void> {
    setPending(true);
    setActionError(null);
    try {
      await action();
      setRevision((value) => value + 1);
    } catch (reason: unknown) {
      setActionError(codeOf(reason));
    } finally {
      setPending(false);
    }
  }

  async function save(draft: ReservationDraft, current: ReservationDetail | null): Promise<void> {
    await run(async () => {
      if (editing === 'edit' && current !== null) await updateReservation(current.id, draft);
      else await createReservation(draft);
      setEditing(null);
    });
  }

  return {
    fromDay,
    toDay,
    status,
    locationId,
    assigneeId,
    search,
    view,
    rows,
    nextCursor,
    venues,
    tables,
    members,
    selectedId,
    editing,
    loading,
    failed,
    pending,
    actionError,
    cursorStack,
    revision,
    setRange: (from: string, to: string) => {
      setFromDay(from);
      setToDay(to);
      resetPage();
    },
    shift: (delta: number) => {
      setFromDay(shiftDay(fromDay, delta));
      setToDay(shiftDay(toDay, delta));
      resetPage();
    },
    setStatus: (value: string) => {
      setStatus(value);
      resetPage();
    },
    setLocationId: (value: string) => {
      setLocationId(value);
      resetPage();
    },
    setAssigneeId: (value: string) => {
      setAssigneeId(value);
      resetPage();
    },
    setSearch: (value: string) => {
      setSearch(value);
      resetPage();
    },
    setView,
    setSelectedId,
    setEditing,
    run,
    save,
    previousPage: () => {
      const previous = cursorStack.at(-1) ?? null;
      setCursorStack((stack) => stack.slice(0, -1));
      setCursor(previous);
    },
    nextPage: () => {
      if (nextCursor === null) return;
      setCursorStack((stack) => [...stack, cursor]);
      setCursor(nextCursor);
    },
  };
}

function useDetail(
  id: string | null,
  revision: number,
): {
  detail: ReservationDetail | null;
  history: StatusHistoryItem[];
  contactName: string | null;
} {
  const [loaded, setLoaded] = useState<LoadedDetail | null>(null);
  const [namedContact, setNamedContact] = useState<NamedContact | null>(null);
  const detail = loaded?.id === id ? loaded.detail : null;
  const history = loaded?.id === id ? loaded.history : [];
  const contactId = detail?.contactId ?? null;
  const contactName =
    namedContact !== null && namedContact.id === contactId ? namedContact.name : null;
  useEffect(() => {
    if (id === null) return undefined;
    const controller = new AbortController();
    const reservationId = id;
    void Promise.all([
      readReservation(reservationId, controller.signal).catch(() => null),
      readHistory(reservationId, controller.signal).catch(() => []),
    ]).then(([nextDetail, nextHistory]) => {
      if (!controller.signal.aborted) {
        setLoaded({ id: reservationId, detail: nextDetail, history: nextHistory });
      }
    });
    return () => controller.abort();
  }, [id, revision]);
  useEffect(() => {
    if (contactId === null) return undefined;
    const controller = new AbortController();
    const requestedId = contactId;
    void readContact(requestedId, controller.signal)
      .then((contact) => setNamedContact({ id: requestedId, name: contact.name }))
      .catch(() => setNamedContact({ id: requestedId, name: null }));
    return () => controller.abort();
  }, [contactId]);
  return { detail, history, contactName };
}

function Header(props: {
  day: string;
  locationId: string;
  venues: Venue[];
  canCreate: boolean;
  onDay: (day: string) => void;
  onShift: (delta: number) => void;
  onLocation: (id: string) => void;
  onCreate: () => void;
}) {
  const t = useTranslations('reservations');
  return (
    <header className={styles.header}>
      <h1>{t('title')}</h1>
      <div className={styles.controls}>
        <div className={styles.dateControls}>
          <button type="button" aria-label={t('previousDay')} onClick={() => props.onShift(-1)}>
            ‹
          </button>
          <DateField fit label={t('date')} value={props.day} onChange={props.onDay} />
          <button type="button" aria-label={t('nextDay')} onClick={() => props.onShift(1)}>
            ›
          </button>
        </div>
        <FilterMenu
          label={t('location')}
          value={props.locationId}
          options={[
            { value: '', label: t('allLocations') },
            ...props.venues.map((venue) => ({ value: venue.id, label: venue.name })),
          ]}
          onChange={props.onLocation}
        />
        {props.canCreate ? (
          <button
            type="button"
            className={`${styles.create} ${glass.button} ${glass.primary}`}
            onClick={props.onCreate}
          >
            {t('createShort')}
          </button>
        ) : null}
      </div>
    </header>
  );
}

function ViewSwitch({ view, onView }: { view: ViewName; onView: (view: ViewName) => void }) {
  const t = useTranslations('reservations');
  const views = ['calendar', 'timeline', 'list'] as const;
  return (
    <SegmentedControl
      label={t('views')}
      value={view}
      options={views.map((name) => ({ value: name, label: t(name) }))}
      onChange={onView}
    />
  );
}

function Filters(props: {
  fromDay: string;
  toDay: string;
  status: string;
  view: ViewName;
  assigneeId: string;
  search: string;
  members: Member[];
  onFrom: (day: string) => void;
  onTo: (day: string) => void;
  onStatus: (status: string) => void;
  onView: (view: ViewName) => void;
  onAssignee: (id: string) => void;
  onSearch: (search: string) => void;
}) {
  const t = useTranslations('reservations');
  const { onSearch } = props;
  const [draft, setDraft] = useState(props.search);
  useEffect(() => {
    const timer = window.setTimeout(() => onSearch(draft.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [draft, onSearch]);
  return (
    <div className={styles.searchRow}>
    <SearchFilters
      value={draft}
      onChange={setDraft}
      placeholder={t('search')}
      label={t('search')}
      resetLabel={t('reset')}
      applyLabel={t('apply')}
      columns={3}
      onReset={() => resetReservationFilters(setDraft, props.onStatus, props.onAssignee)}
      onApply={() => undefined}
    >
      <FilterField label={t('from')}>
        <DateField fit label={t('from')} value={props.fromDay} onChange={props.onFrom} />
      </FilterField>
      <FilterField label={t('to')}>
        <DateField fit label={t('to')} value={props.toDay} onChange={props.onTo} />
      </FilterField>
      <FilterField label={t('assignee')}>
        <FilterMenu
          field
          label={t('assignee')}
          value={props.assigneeId}
          options={[
            { value: '', label: t('allAssignees') },
            ...props.members.map((member) => ({ value: member.id, label: member.name })),
          ]}
          onChange={props.onAssignee}
        />
      </FilterField>
    </SearchFilters>
    <FilterMenu
      label={t('status')}
      value={props.status}
      options={[
        { value: '', label: t('allStatuses') },
        ...RESERVATION_STATUSES.map((status) => ({
          value: status,
          label: t(`statuses.${status}`),
        })),
      ]}
      onChange={props.onStatus}
    />
    <ViewSwitch view={props.view} onView={props.onView} />
    </div>
  );
}

function resetReservationFilters(
  setDraft: (value: string) => void,
  onStatus: (status: string) => void,
  onAssignee: (id: string) => void,
): void {
  setDraft('');
  onStatus('');
  onAssignee('');
}

function Pager({
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const t = useTranslations('reservations');
  return (
    <div className={styles.pager}>
      <button type="button" disabled={!hasPrevious} onClick={onPrevious}>
        {t('previousPage')}
      </button>
      <button type="button" disabled={!hasNext} onClick={onNext}>
        {t('nextPage')}
      </button>
    </div>
  );
}

function messageFor(t: ReturnType<typeof useTranslations<'reservations'>>, code: string): string {
  if (code === 'RESERVATION_MODULE_DISABLED') return t('moduleDisabled');
  if (code === 'RESERVATION_TIME_CONFLICT') return t('conflict');
  if (code === 'RESERVATION_INVALID_TRANSITION') return t('invalidTransition');
  if (code === 'RESERVATION_NOT_EDITABLE') return t('notEditable');
  if (code === 'RESERVATION_OUTSIDE_WORKING_HOURS') return t('hours');
  if (code === 'RESERVATION_START_NOT_IN_FUTURE') return t('future');
  if (code === 'RESERVATION_TABLE_CAPACITY_EXCEEDED') return t('capacity');
  return t('generic');
}

function codeOf(reason: unknown): string {
  return reason instanceof ReservationRequestError ? reason.code : 'REQUEST_FAILED';
}

function nameOf(venues: Venue[], id: string): string {
  return venues.find((venue) => venue.id === id)?.name ?? id.slice(0, 8);
}

function tableOf(tables: DiningTable[], id: string | null): string {
  if (id === null) return '—';
  return tables.find((table) => table.id === id)?.name ?? id.slice(0, 8);
}

function memberOf(members: Member[], id: string | null): string {
  if (id === null) return '—';
  return members.find((member) => member.id === id)?.name ?? id.slice(0, 8);
}
