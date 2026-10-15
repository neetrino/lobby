'use client';

import { useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { SheetChrome, SheetFrame } from '../../ui/side-sheet/side-sheet';
import { OverlayPortal } from '../contacts/overlay-portal';
import {
  allowedActions,
  canCancelReservation,
  canEditReservation,
  formatTime,
  formatWhen,
  type ReservationDetail,
  type ReservationTransitionAction,
  type StatusHistoryItem,
} from './reservations-model';
import { StatusBadge } from './reservations-views';
import styles from './reservations.module.css';

export function ReservationDrawer({
  detail,
  history,
  venueName,
  tableName,
  assigneeName,
  contactName,
  canUpdate,
  pending,
  error,
  onClose,
  onEdit,
  onCancel,
  onTransition,
}: {
  detail: ReservationDetail;
  history: StatusHistoryItem[];
  venueName: string;
  tableName: string;
  assigneeName: string;
  contactName: string;
  canUpdate: boolean;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onEdit: () => void;
  onCancel: (reason: string) => void;
  onTransition: (action: ReservationTransitionAction) => void;
}) {
  const t = useTranslations('reservations');
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  return (
    <OverlayPortal onDismiss={onClose}>
      <SheetFrame label={t('details')} closeLabel={t('close')}>
        <SheetChrome
          as="aside"
          title={detail.customerName}
          footer={
            <ReservationActions
              status={detail.status}
              canUpdate={canUpdate}
              pending={pending}
              onEdit={onEdit}
              onCancel={() => setConfirming(true)}
              onTransition={onTransition}
            />
          }
        >
          <StatusBadge status={detail.status} />
            <FactSection title={t('sections.guest')}>
              <Fact label={t('name')} value={detail.customerName} />
              <Fact label={t('phone')} value={detail.customerPhone ?? '—'} />
              <Fact label={t('email')} value={detail.customerEmail ?? '—'} />
              <Fact label={t('note')} value={detail.customerNote ?? '—'} />
            </FactSection>
            <FactSection title={t('sections.when')}>
              <Fact label={t('starts')} value={formatWhen(detail.startsAt, locale)} />
              <Fact label={t('ends')} value={formatWhen(detail.endsAt, locale)} />
              <Fact label={t('duration')} value={t('minutes', { count: detail.durationMinutes })} />
            </FactSection>
            <FactSection title={t('sections.seating')}>
              <Fact label={t('location')} value={venueName} />
              <Fact label={t('table')} value={tableName} />
              <Fact label={t('party')} value={String(detail.guestCount)} />
            </FactSection>
            <FactSection title={t('sections.people')}>
              <Fact label={t('contact')} value={contactName} />
              <Fact label={t('assignee')} value={assigneeName} />
            </FactSection>
            <section className={styles.section}>
              <h3>{t('source')}</h3>
              <p className={styles.source}>{sourceLabel(t, detail.source)}</p>
            </section>
            <section className={styles.section}>
              <h3>{t('history')}</h3>
              {history.length === 0 ? (
                <p className={styles.muted}>{t('historyEmpty')}</p>
              ) : (
                <ol className={styles.history}>
                  {history.map((item) => (
                    <li key={item.id}>
                      <StatusBadge status={item.toStatus} />
                      <div>
                        <span>{formatTime(item.createdAt, locale)}</span>
                        {item.changedByName === null ? null : (
                          <span>{t('by', { name: item.changedByName })}</span>
                        )}
                        {item.reason === null ? null : <small>{item.reason}</small>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            {error === null ? null : (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
          {confirming ? (
            <CancelDialog
              pending={pending}
              onClose={() => setConfirming(false)}
              onConfirm={(reason) => {
                setConfirming(false);
                onCancel(reason);
              }}
            />
          ) : null}
        </SheetChrome>
      </SheetFrame>
    </OverlayPortal>
  );
}

export function ReservationActions({
  status,
  canUpdate,
  pending,
  onEdit,
  onCancel,
  onTransition,
}: {
  status: string;
  canUpdate: boolean;
  pending: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onTransition: (action: ReservationTransitionAction) => void;
}) {
  const t = useTranslations('reservations');
  if (!canUpdate) return null;
  return (
    <div className={styles.actions}>
      {allowedActions(status).map((action) => (
        <button key={action} type="button" disabled={pending} onClick={() => onTransition(action)}>
          {t(`transition.${action === 'no-show' ? 'noShow' : action}`)}
        </button>
      ))}
      {canEditReservation(status) ? (
        <button type="button" disabled={pending} onClick={onEdit}>
          {t('edit')}
        </button>
      ) : null}
      {canCancelReservation(status) ? (
        <button type="button" className={styles.danger} disabled={pending} onClick={onCancel}>
          {t('cancel')}
        </button>
      ) : null}
    </div>
  );
}

function CancelDialog({
  pending,
  onClose,
  onConfirm,
}: {
  pending: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const t = useTranslations('reservations');
  const [reason, setReason] = useState('');
  return (
    <OverlayPortal onDismiss={onClose} raised>
      <form
        className={styles.confirm}
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm(reason);
        }}
      >
        <h2>{t('cancelTitle')}</h2>
        <label>
          {t('cancelReason')}
          <input
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <div className={styles.actions}>
          <button type="button" onClick={onClose}>
            {t('keep')}
          </button>
          <button type="submit" className={styles.danger} disabled={pending}>
            {t('confirmCancel')}
          </button>
        </div>
      </form>
    </OverlayPortal>
  );
}

function FactSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h3>{title}</h3>
      <dl className={styles.facts}>{children}</dl>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function sourceLabel(
  t: ReturnType<typeof useTranslations<'reservations'>>,
  source: string,
): string {
  if (
    source === 'STAFF' ||
    source === 'PHONE' ||
    source === 'WALK_IN' ||
    source === 'WEBSITE' ||
    source === 'INSTAGRAM' ||
    source === 'WHATSAPP' ||
    source === 'TELEGRAM'
  ) {
    return t(`sources.${source}`);
  }
  return source;
}
