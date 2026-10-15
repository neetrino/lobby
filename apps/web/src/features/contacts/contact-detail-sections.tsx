'use client';

import { Copy, Layers, ScrollText, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

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
  const duplicateLabel =
    duplicateCount > 0
      ? t('tabs.duplicatesCount', { count: duplicateCount })
      : t('tabs.duplicates');

  return (
    <div className={panel.tabs} role="tablist">
      <TabButton
        active={tab === 'main'}
        label={t('tabs.main')}
        icon={<UserRound aria-hidden="true" />}
        onClick={() => onTab('main')}
      />
      <TabButton
        active={tab === 'modules'}
        label={t('tabs.modules')}
        icon={<Layers aria-hidden="true" />}
        onClick={() => onTab('modules')}
      />
      <TabButton
        active={tab === 'audit'}
        label={t('tabs.audit')}
        icon={<ScrollText aria-hidden="true" />}
        onClick={() => onTab('audit')}
      />
      <TabButton
        active={tab === 'duplicates'}
        label={duplicateLabel}
        icon={<Copy aria-hidden="true" />}
        onClick={() => onTab('duplicates')}
      />
    </div>
  );
}

function TabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
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
      {icon}
      {label}
    </button>
  );
}

export function RelatedModules() {
  const t = useTranslations('contacts');
  return (
    <fieldset className={panel.block}>
      <legend>{t('relatedTitle')}</legend>
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
    </fieldset>
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
    <fieldset className={panel.block}>
      <legend>{t('auditTitle')}</legend>
      <AuditBody events={events} status={status} locale={locale} />
    </fieldset>
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
    <fieldset className={panel.block}>
      <legend>{t('tabs.duplicates')}</legend>
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
    </fieldset>
  );
}
