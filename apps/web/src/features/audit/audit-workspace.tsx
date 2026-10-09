'use client';

import { useEffect, useMemo, useState } from 'react';
import { auditResourceTypes } from '@lobby/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { ContactsShell } from '../contacts/contacts-shell';
import shell from '../contacts/contacts.module.css';
import { useSession } from '../contacts/use-contact-list';
import glass from '../../ui/glass/glass.module.css';
import {
  AuditRequestError,
  listAuditEvents,
  readAuditEvent,
  type AuditDetail,
  type AuditEvent,
} from './audit-api';
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
              <section className={styles.filterPanel}>
                <input
                  aria-label={t('search')}
                  placeholder={t('search')}
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
                <select
                  aria-label={t('outcome')}
                  value={filters.outcome}
                  onChange={(e) => setFilters({ ...filters, outcome: e.target.value })}
                >
                  <option value="">{t('allOutcomes')}</option>
                  <option value="SUCCESS">{t('success')}</option>
                  <option value="DENIED">{t('denied')}</option>
                  <option value="FAILURE">{t('failure')}</option>
                </select>
                <select
                  aria-label={t('actorType')}
                  value={filters.actorType}
                  onChange={(e) => setFilters({ ...filters, actorType: e.target.value })}
                >
                  <option value="">{t('allActors')}</option>
                  <option value="USER">{t('user')}</option>
                  <option value="INTEGRATION">{t('integration')}</option>
                </select>
                <select
                  aria-label={t('resourceType')}
                  value={filters.resourceType}
                  onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
                >
                  <option value="">{t('allResources')}</option>
                  {auditResourceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                <label>
                  {t('from')}
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                  />
                </label>
                <label>
                  {t('to')}
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                  />
                </label>
                <button type="button" className={styles.apply} onClick={apply}>
                  {t('apply')}
                </button>
                <button type="button" onClick={clear}>
                  {t('clear')}
                </button>
              </section>
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
                {selected === null ? (
                  <aside className={styles.emptyDetail}>
                    <strong>{t('selectEvent')}</strong>
                    <span>{t('selectHint')}</span>
                  </aside>
                ) : (
                  <Detail
                    event={selected}
                    locale={locale}
                    onClose={() => setSelected(null)}
                    t={t}
                  />
                )}
              </section>
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
                <small>{event.actor.role ?? event.actor.type}</small>
              </td>
              <td>
                <code>{event.action}</code>
                <small>{event.module}</small>
              </td>
              <td>
                <strong>{event.resource.label ?? event.resource.type}</strong>
                <small>{event.resource.id.slice(0, 8)}</small>
              </td>
              <td>
                <span className={`${styles.badge} ${styles[event.outcome.toLowerCase()]}`}>
                  {event.outcome}
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
  return (
    <aside className={styles.detail}>
      <div className={styles.detailHead}>
        <div>
          <span>{t('eventDetail')}</span>
          <h2>{event.action}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label={t('close')}>
          ×
        </button>
      </div>
      <dl>
        <dt>{t('time')}</dt>
        <dd>
          {new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'medium' }).format(
            new Date(event.occurredAt),
          )}
        </dd>
        <dt>{t('actor')}</dt>
        <dd>
          {event.actor.name ?? t('system')} · {event.actor.role ?? event.actor.type}
        </dd>
        <dt>{t('resource')}</dt>
        <dd>
          {event.resource.label ?? event.resource.type}
          <small>{event.resource.id}</small>
        </dd>
        <dt>{t('outcome')}</dt>
        <dd>{event.outcome}</dd>
        <dt>{t('requestId')}</dt>
        <dd>
          <code>{event.requestId}</code>
        </dd>
        <dt>{t('reason')}</dt>
        <dd>{event.reason ?? '—'}</dd>
      </dl>
      <h3>{t('changes')}</h3>
      <pre>{event.changes === null ? t('noChanges') : JSON.stringify(event.changes, null, 2)}</pre>
    </aside>
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
