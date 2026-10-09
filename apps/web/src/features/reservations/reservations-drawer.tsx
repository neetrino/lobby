'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { OverlayPortal } from '../contacts/overlay-portal';
import {
  allowedActions,
  canCancelReservation,
  canEditReservation,
  formatTime,
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
  onClose: () => void;
  onEdit: () => void;
  onCancel: (reason: string) => void;
  onTransition: (action: ReservationTransitionAction) => void;
}) {
  const t = useTranslations('reservations');
  const locale = useLocale();
  const [confirming, setConfirming] = useState(false);
  return (
    <aside className={styles.drawer} role="dialog" aria-label={t('details')}>
      <header className={styles.drawerHead}>
        <div>
          <h2>{detail.customerName}</h2>
          <StatusBadge status={detail.status} />
        </div>
        <button type="button" className={styles.textButton} onClick={onClose}>{t('close')}</button>
      </header>
      <dl className={styles.facts}>
        <div><dt>{t('time')}</dt><dd>{formatTime(detail.startsAt, locale)}</dd></div>
        <div><dt>{t('duration')}</dt><dd>{t('minutes', { count: detail.durationMinutes })}</dd></div>
        <div><dt>{t('party')}</dt><dd>{detail.guestCount}</dd></div>
        <div><dt>{t('location')}</dt><dd>{venueName}</dd></div>
        <div><dt>{t('table')}</dt><dd>{tableName}</dd></div>
        <div><dt>{t('phone')}</dt><dd>{detail.customerPhone ?? '—'}</dd></div>
        <div><dt>{t('email')}</dt><dd>{detail.customerEmail ?? '—'}</dd></div>
        <div><dt>{t('contact')}</dt><dd>{contactName}</dd></div>
        <div><dt>{t('assignee')}</dt><dd>{assigneeName}</dd></div>
        <div><dt>{t('source')}</dt><dd>{sourceLabel(t, detail.source)}</dd></div>
        <div><dt>{t('note')}</dt><dd>{detail.customerNote ?? '—'}</dd></div>
      </dl>
      <section>
        <h3>{t('history')}</h3>
        {history.length === 0 ? <p className={styles.muted}>{t('historyEmpty')}</p> : (
          <ol className={styles.history}>
            {history.map((item) => (
              <li key={item.id}>
                <StatusBadge status={item.toStatus} />
                <span>{formatTime(item.createdAt, locale)}</span>
                {item.changedByName === null ? null : <span>{t('by', { name: item.changedByName })}</span>}
                {item.reason === null ? null : <span>{item.reason}</span>}
              </li>
            ))}
          </ol>
        )}
      </section>
      <ReservationActions
        status={detail.status}
        canUpdate={canUpdate}
        pending={pending}
        onEdit={onEdit}
        onCancel={() => setConfirming(true)}
        onTransition={onTransition}
      />
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
    </aside>
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
        <button type="button" disabled={pending} onClick={onEdit}>{t('edit')}</button>
      ) : null}
      {canCancelReservation(status) ? (
        <button type="button" className={styles.danger} disabled={pending} onClick={onCancel}>{t('cancel')}</button>
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
          <input value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className={styles.actions}>
          <button type="button" onClick={onClose}>{t('keep')}</button>
          <button type="submit" className={styles.danger} disabled={pending}>{t('confirmCancel')}</button>
        </div>
      </form>
    </OverlayPortal>
  );
}

function sourceLabel(t: ReturnType<typeof useTranslations<'reservations'>>, source: string): string {
  if (source === 'STAFF' || source === 'PHONE' || source === 'WALK_IN' || source === 'WEBSITE' || source === 'INSTAGRAM' || source === 'WHATSAPP' || source === 'TELEGRAM') {
    return t(`sources.${source}`);
  }
  return source;
}
