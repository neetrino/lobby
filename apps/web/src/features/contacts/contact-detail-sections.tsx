'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

import { actionText, outcomeText } from '../audit/audit-labels';

import type { Contact } from './contact';
import { formatContactStamp, shortId } from './contact-format';
import type { ContactAuditEvent } from './contacts-api';
import { duplicatePeers } from './duplicate-notices';
import panel from './contact-editor.module.css';

export type DetailTab = 'main' | 'modules' | 'audit' | 'duplicates';

export function DetailTabs({
  tab,
  duplicateCount,
  onTab,
}: {
  tab: DetailTab;
  duplicateCount: number;
  onTab: (tab: DetailTab) => void;
}) {
  const t = useTranslations('contacts');
  const listRef = useRef<HTMLDivElement>(null);
  const line = useTabLine(listRef, tab);
  const duplicateLabel =
    duplicateCount > 0
      ? t('tabs.duplicatesCount', { count: duplicateCount })
      : t('tabs.duplicates');

  return (
    <div ref={listRef} className={panel.tabs} role="tablist">
      <TabButton active={tab === 'main'} label={t('tabs.main')} onClick={() => onTab('main')} />
      <TabButton
        active={tab === 'modules'}
        label={t('tabs.modules')}
        onClick={() => onTab('modules')}
      />
      <TabButton active={tab === 'audit'} label={t('tabs.audit')} onClick={() => onTab('audit')} />
      <TabButton
        active={tab === 'duplicates'}
        label={duplicateLabel}
        onClick={() => onTab('duplicates')}
      />
      <span className={panel.tabLine} style={line} />
    </div>
  );
}

function useTabLine(
  listRef: RefObject<HTMLDivElement | null>,
  tab: DetailTab,
): { width: number; transform: string } {
  const [line, setLine] = useState({ width: 0, transform: 'translateX(0)' });

  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null) {
      return undefined;
    }
    const place = (): void => {
      const active = list.querySelector<HTMLElement>('[aria-selected="true"]');
      if (active === null) {
        return;
      }
      setLine({
        width: active.offsetWidth,
        transform: `translateX(${active.offsetLeft}px)`,
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [listRef, tab]);

  return line;
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? panel.tabActive : panel.tab}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function RelatedModules() {
  const t = useTranslations('contacts');
  return (
    <section className={panel.block}>
      <div className={panel.sectionHead}>
        <h3>{t('relatedTitle')}</h3>
      </div>
      <div className={panel.cards}>
        <article className={panel.card}>
          <span>{t('activeDeals')}</span>
          <strong>0</strong>
          <small>{t('relatedEmpty')}</small>
        </article>
        <article className={panel.card}>
          <span>{t('nav.reservations')}</span>
          <strong>0</strong>
          <small>{t('relatedEmpty')}</small>
        </article>
      </div>
    </section>
  );
}

export function AuditEvents({
  events,
  status,
}: {
  events: readonly ContactAuditEvent[];
  status: 'idle' | 'loading' | 'ready' | 'forbidden' | 'error';
}) {
  const t = useTranslations('contacts');
  const locale = useLocale();
  return (
    <section className={panel.block}>
      <div className={panel.sectionHead}>
        <h3>{t('auditTitle')}</h3>
        <span className={panel.hint}>{t('immutableLog')}</span>
      </div>
      <AuditBody events={events} status={status} locale={locale} />
    </section>
  );
}

function AuditBody({
  events,
  status,
  locale,
}: {
  events: readonly ContactAuditEvent[];
  status: 'idle' | 'loading' | 'ready' | 'forbidden' | 'error';
  locale: string;
}) {
  const t = useTranslations('contacts');
  const audit = useTranslations('audit');
  if (status === 'loading' || status === 'idle') {
    return <p className={panel.note}>{t('loading')}</p>;
  }
  if (status === 'forbidden') {
    return <p className={panel.note}>{t('auditForbidden')}</p>;
  }
  if (status === 'error') {
    return <p className={panel.note}>{t('errors.generic')}</p>;
  }
  if (events.length === 0) {
    return <p className={panel.note}>{t('auditEmpty')}</p>;
  }
  return (
    <ul className={panel.events}>
      {events.map((event) => (
        <li key={event.id} className={panel.event}>
          <span className={panel.eventMark} aria-hidden="true">
            •
          </span>
          <div className={panel.eventCopy}>
            <strong>{actionText(audit, event.action)}</strong>
            <small>
              {event.actorRole === null
                ? outcomeText(audit, event.outcome)
                : t(`role.${event.actorRole}`)}
            </small>
          </div>
          <time dateTime={event.occurredAt}>
            {formatContactStamp(event.occurredAt, locale).date}
          </time>
        </li>
      ))}
    </ul>
  );
}

export function DuplicateList({ contact, rows }: { contact: Contact; rows: readonly Contact[] }) {
  const t = useTranslations('contacts');
  const peers = duplicatePeers(contact, rows);
  return (
    <section className={panel.block}>
      <h3>{t('tabs.duplicates')}</h3>
      {peers.length === 0 ? <p className={panel.note}>{t('duplicatesEmpty')}</p> : null}
      <ul className={panel.events}>
        {peers.map((peer) => (
          <li key={peer.id} className={panel.event}>
            <div>
              <strong>{peer.name}</strong>
              <small title={peer.id}>ID: {shortId(peer.id)}</small>
            </div>
            <span>{peer.phone ?? peer.email ?? '—'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
