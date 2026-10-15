'use client';

import { useEffect, useMemo, useState } from 'react';
import { auditResourceTypes } from '@lobby/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { ContactsShell } from '../contacts/contacts-shell';
import shell from '../contacts/contacts.module.css';
import { useSession } from '../contacts/use-contact-list';
import { DateField } from '../../ui/calendar/calendar';
import { SheetFrame } from '../../ui/side-sheet/side-sheet';
import { FilterMenu } from '../../ui/filter-menu/filter-menu';
import { FilterField, SearchFilters } from '../../ui/search-filters/search-filters';
import { OverlayPortal } from '../contacts/overlay-portal';
import glass from '../../ui/glass/glass.module.css';
import {
  AuditRequestError,
  listAuditEvents,
  readAuditEvent,
  type AuditDetail,
  type AuditEvent,
} from './audit-api';
import { actionText, changeLines, outcomeText, resourceText, roleText } from './audit-labels';
import styles from './audit.module.css';

type Filters = {
  search: string;
  outcome: string;
  actorType: string;
  resourceType: string;
  from: string;
  to: string;
};
const initialFilters: Filters = {
  search: '',
  outcome: '',
  actorType: '',
  resourceType: '',
  from: '',
  to: '',
};

export function AuditWorkspace() {
  const t = useTranslations('audit');
  const locale = useLocale();
  const router = useRouter();
  const { session, error: sessionError } = useSession();
  const [filters, setFilters] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'forbidden' | 'failed'>('loading');
  const [selected, setSelected] = useState<AuditDetail | null>(null);

  useEffect(() => {
    if (sessionError?.status === 401) router.replace(`/${locale}/login`);
  }, [locale, router, sessionError]);

  const canRead = session?.user.role === 'OWNER' || session?.user.role === 'ADMIN';
  useEffect(() => {
    if (session === null) return undefined;
    if (!canRead) {
      queueMicrotask(() => setStatus('forbidden'));
      return undefined;
    }
    const controller = new AbortController();
    void listAuditEvents(queryOf(applied, cursor), controller.signal)
      .then((page) => {
        setEvents(page.data);
        setNextCursor(page.page.nextCursor);
        setStatus('ready');
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setStatus(
          reason instanceof AuditRequestError && reason.status === 403 ? 'forbidden' : 'failed',
        );
      });
    return () => controller.abort();
  }, [applied, canRead, cursor, session]);

  const counts = useMemo(
    () => ({
      total: events.length,
      success: events.filter((event) => event.outcome === 'SUCCESS').length,
      denied: events.filter((event) => event.outcome === 'DENIED').length,
      integrations: events.filter((event) => event.actor.type === 'INTEGRATION').length,
    }),
    [events],
  );

  function apply(): void {
    setStatus('loading');
    setCursor(null);
    setCursorStack([]);
    setApplied(filters);
    setSelected(null);
  }

  function clear(): void {
    setFilters(initialFilters);
    setStatus('loading');
    setCursor(null);
    setCursorStack([]);
    setApplied(initialFilters);
  }

  function open(id: string): void {
    const controller = new AbortController();
    void readAuditEvent(id, controller.signal)
      .then(setSelected)
      .catch(() => setStatus('failed'));
  }

  return (
    <div className={shell.app}>
      <ContactsShell session={session} current="audit" />
      <main className={`${shell.main} ${glass.canvas}`}>
        <div className={styles.page}>
          <header className={styles.header}>
            <div>
              <p>{t('eyebrow')}</p>
              <h1>{t('title')}</h1>
              <span>{t('subtitle')}</span>
            </div>
            <span className={styles.scope}>{t('tenantScope')}</span>
          </header>
          {status === 'forbidden' ? <div className={styles.notice}>{t('forbidden')}</div> : null}
          {status === 'failed' ? <div className={styles.error}>{t('failed')}</div> : null}
          {canRead ? (
            <>
              <section className={styles.metrics} aria-label={t('pageSummary')}>
                <Metric label={t('events')} value={counts.total} tone="blue" />
                <Metric label={t('successful')} value={counts.success} tone="green" />
                <Metric label={t('denied')} value={counts.denied} tone="red" />
                <Metric label={t('integrations')} value={counts.integrations} tone="violet" />
              </section>
              <div className={styles.search}>
              <SearchFilters
                white
                value={filters.search}
                onChange={(search) => setFilters({ ...filters, search })}
                placeholder={t('search')}
                label={t('search')}
                resetLabel={t('clear')}
                applyLabel={t('apply')}
                onReset={clear}
                onApply={apply}
              >
                <FilterField label={t('outcome')}>
                  <FilterMenu
                    field
                    label={t('outcome')}
                    value={filters.outcome}
                    options={[
                      { value: '', label: t('allOutcomes') },
                      { value: 'SUCCESS', label: outcomeText(t, 'SUCCESS') },
                      { value: 'DENIED', label: outcomeText(t, 'DENIED') },
                      { value: 'FAILURE', label: outcomeText(t, 'FAILURE') },
                    ]}
                    onChange={(outcome) => setFilters({ ...filters, outcome })}
                  />
                </FilterField>
                <FilterField label={t('actorType')}>
                  <FilterMenu
                    field
                    label={t('actorType')}
                    value={filters.actorType}
                    options={[
                      { value: '', label: t('allActors') },
                      { value: 'USER', label: t('user') },
                      { value: 'INTEGRATION', label: t('integration') },
                    ]}
                    onChange={(actorType) => setFilters({ ...filters, actorType })}
                  />
                </FilterField>
                <FilterField label={t('from')}>
                  <DateField
                    label={t('from')}
                    value={filters.from}
                    onChange={(from) => setFilters({ ...filters, from })}
                  />
                </FilterField>
                <FilterField label={t('to')}>
                  <DateField
                    label={t('to')}
                    value={filters.to}
                    onChange={(to) => setFilters({ ...filters, to })}
                  />
                </FilterField>
              </SearchFilters>
              <FilterMenu
                white
                label={t('resourceType')}
                value={filters.resourceType}
                options={[
                  { value: '', label: t('allResources') },
                  ...auditResourceTypes.map((type) => ({
                    value: type,
                    label: resourceText(t, type),
                  })),
                ]}
                onChange={(resourceType) => setFilters({ ...filters, resourceType })}
              />
              </div>
              <section className={styles.content}>
                <div className={styles.tableCard}>
                  {status === 'loading' ? <p className={styles.state}>{t('loading')}</p> : null}
                  {status === 'ready' && events.length === 0 ? (
                    <p className={styles.state}>{t('empty')}</p>
                  ) : null}
                  {events.length > 0 ? (
                    <AuditTable events={events} locale={locale} onOpen={open} t={t} />
                  ) : null}
                  <div className={styles.pager}>
                    <button
                      type="button"
                      disabled={cursorStack.length === 0}
                      onClick={() => {
                        const previous = cursorStack.at(-1) ?? null;
                        setStatus('loading');
                        setCursorStack((items) => items.slice(0, -1));
                        setCursor(previous);
                      }}
                    >
                      {t('previous')}
                    </button>
                    <span>{t('pageSummary')}</span>
                    <button
                      type="button"
                      disabled={nextCursor === null}
                      onClick={() => {
                        if (nextCursor === null) return;
                        setStatus('loading');
                        setCursorStack((items) => [...items, cursor]);
                        setCursor(nextCursor);
                      }}
                    >
                      {t('next')}
                    </button>
                  </div>
                </div>
              </section>
              {selected === null ? null : (
                <Detail
                  event={selected}
                  locale={locale}
                  onClose={() => setSelected(null)}
                  t={t}
                />
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className={`${styles.metric} ${styles[tone]}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </article>
  );
}

function AuditTable({
  events,
  locale,
  onOpen,
  t,
}: {
  events: AuditEvent[];
  locale: string;
  onOpen: (id: string) => void;
  t: ReturnType<typeof useTranslations<'audit'>>;
}) {
  return (
    <div className={styles.tableWrap}>
      <table>
        <thead>
          <tr>
            <th>{t('time')}</th>
            <th>{t('actor')}</th>
            <th>{t('action')}</th>
            <th>{t('resource')}</th>
            <th>{t('outcome')}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr
              key={event.id}
              tabIndex={0}
              onClick={() => onOpen(event.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onOpen(event.id);
              }}
            >
              <td>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(event.occurredAt))}
              </td>
              <td>
                <strong>{event.actor.name ?? t('system')}</strong>
                <small>{roleText(t, event.actor) ?? t('user')}</small>
              </td>
              <td>
                <strong>{actionText(t, event.action)}</strong>
                <small>{resourceText(t, event.resource.type)}</small>
              </td>
              <td>
                <strong>{event.resource.label ?? resourceText(t, event.resource.type)}</strong>
              </td>
              <td>
                <span className={`${styles.badge} ${styles[event.outcome.toLowerCase()]}`}>
                  {outcomeText(t, event.outcome)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Detail({
  event,
  locale,
  onClose,
  t,
}: {
  event: AuditDetail;
  locale: string;
  onClose: () => void;
  t: ReturnType<typeof useTranslations<'audit'>>;
}) {
  const title = actionText(t, event.action);
  return (
    <OverlayPortal onDismiss={onClose}>
      <SheetFrame label={title} closeLabel={t('close')}>
        <aside className={styles.detail}>
          <header className={styles.detailHead}>
            <span>{t('eventDetail')}</span>
            <h2>{title}</h2>
          </header>
          <div className={styles.detailBody}>
            <dl>
              <dt>{t('time')}</dt>
              <dd>
                {new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'medium' }).format(
                  new Date(event.occurredAt),
                )}
              </dd>
              <dt>{t('actor')}</dt>
              <dd>{actorLine(t, event.actor)}</dd>
              <dt>{t('resource')}</dt>
              <dd>
                {event.resource.label ?? resourceText(t, event.resource.type)}
                {event.resource.label === null ? null : (
                  <small>{resourceText(t, event.resource.type)}</small>
                )}
              </dd>
              <dt>{t('outcome')}</dt>
              <dd>{outcomeText(t, event.outcome)}</dd>
              <dt>{t('reason')}</dt>
              <dd>{event.reason ?? t('noReason')}</dd>
            </dl>
            <h3>{t('changes')}</h3>
            <ChangeList t={t} changes={event.changes} />
          </div>
        </aside>
      </SheetFrame>
    </OverlayPortal>
  );
}

function actorLine(
  t: ReturnType<typeof useTranslations<'audit'>>,
  actor: AuditEvent['actor'],
): string {
  const name = actor.name ?? t('system');
  const role = roleText(t, actor);
  return role === null || role === name ? name : `${name} · ${role}`;
}

function ChangeList({
  t,
  changes,
}: {
  t: ReturnType<typeof useTranslations<'audit'>>;
  changes: unknown;
}) {
  const lines = changeLines(t, changes);
  if (lines.length === 0) return <p className={styles.changes}>{t('noChanges')}</p>;
  return (
    <ul className={styles.changes}>
      {lines.map((line, index) => (
        <li key={`${line.label}-${index}`}>
          <strong>{line.label}</strong>
          <span>{line.value}</span>
        </li>
      ))}
    </ul>
  );
}

function queryOf(filters: Filters, cursor: string | null): URLSearchParams {
  const query = new URLSearchParams({ limit: '25', sort: 'desc' });
  if (filters.search.trim() !== '') query.set('search', filters.search.trim());
  if (filters.outcome !== '') query.set('outcome', filters.outcome);
  if (filters.actorType !== '') query.set('actorType', filters.actorType);
  if (filters.resourceType.trim() !== '') query.set('resourceType', filters.resourceType.trim());
  if (filters.from !== '') query.set('from', new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to !== '') query.set('to', new Date(`${filters.to}T23:59:59.999`).toISOString());
  if (cursor !== null) query.set('cursor', cursor);
  return query;
}
