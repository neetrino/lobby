'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import type { Contact } from './contact';
import { contactErrorText } from './contact-error';
import type { ContactsRequestError } from './contacts-api';
import { OverlayPortal } from './overlay-portal';
import type { LifecycleAction } from './use-lifecycle-prompt';
import appStyles from './contacts.module.css';
import styles from './lifecycle-confirm.module.css';

export function LifecycleConfirm({
  contacts,
  action,
  pending,
  error,
  onConfirm,
  onCancel,
}: {
  contacts: readonly Contact[];
  action: LifecycleAction;
  pending: boolean;
  error: ContactsRequestError | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('contacts');
  const panelRef = useRef<HTMLElement>(null);
  const title = action === 'archive' ? t('confirmArchiveTitle') : t('confirmRestoreTitle');

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <OverlayPortal raised onDismiss={pending ? undefined : onCancel}>
      <section
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lifecycle-confirm-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !pending) {
            onCancel();
          }
        }}
      >
        <h2 id="lifecycle-confirm-title">{title}</h2>
        <p>{confirmCopy(t, action, contacts)}</p>
        {contacts.length < 2 ? null : (
          <ul className={styles.names}>
            {contacts.map((contact) => (
              <li key={contact.id}>{contact.name}</li>
            ))}
          </ul>
        )}
        {error === null ? null : (
          <p className={appStyles.errorText}>{contactErrorText(t, error.code)}</p>
        )}
        <footer className={styles.actions}>
          <button
            type="button"
            className={appStyles.secondaryButton}
            disabled={pending}
            onClick={onCancel}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            className={action === 'archive' ? appStyles.dangerButton : appStyles.primaryButton}
            disabled={pending}
            onClick={onConfirm}
          >
            {action === 'archive' ? t('archive') : t('restore')}
          </button>
        </footer>
      </section>
    </OverlayPortal>
  );
}

function confirmCopy(
  t: ReturnType<typeof useTranslations<'contacts'>>,
  action: LifecycleAction,
  contacts: readonly Contact[],
): string {
  const one = contacts.length === 1 ? contacts[0] : undefined;
  if (one !== undefined) {
    return action === 'archive'
      ? t('confirmArchiveOne', { name: one.name })
      : t('confirmRestoreOne', { name: one.name });
  }
  return action === 'archive'
    ? t('confirmArchiveMany', { count: contacts.length })
    : t('confirmRestoreMany', { count: contacts.length });
}
