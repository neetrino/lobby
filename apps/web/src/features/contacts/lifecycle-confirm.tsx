'use client';

import { useTranslations } from 'next-intl';

import { ConfirmDialog } from '../../ui/confirm/confirm-dialog';
import type { Contact } from './contact';
import { contactErrorText } from './contact-error';
import type { ContactsRequestError } from './contacts-api';
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
  const title = action === 'archive' ? t('confirmArchiveTitle') : t('confirmRestoreTitle');
  return (
    <ConfirmDialog
      title={title}
      message={confirmCopy(t, action, contacts)}
      confirmLabel={action === 'archive' ? t('archive') : t('restore')}
      cancelLabel={t('cancel')}
      tone={action === 'archive' ? 'danger' : 'primary'}
      pending={pending}
      closeOnConfirm={false}
      onConfirm={onConfirm}
      onClose={onCancel}
    >
      {contacts.length < 2 ? null : (
        <ul className={styles.names}>
          {contacts.map((contact) => (
            <li key={contact.id}>{contact.name}</li>
          ))}
        </ul>
      )}
      {error === null ? null : <p className={appStyles.errorText}>{contactErrorText(t, error.code)}</p>}
    </ConfirmDialog>
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
