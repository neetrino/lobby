'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import {
  canManageLifecycle,
  type Contact,
  type ContactDraft,
  type SessionPrincipal,
} from './contact';
import { contactErrorText } from './contact-error';
import { formatContactDate, shortId } from './contact-format';
import type { ContactsRequestError } from './contacts-api';
import styles from './contacts.module.css';

export function ContactEditor({
  mode,
  contact,
  draft,
  session,
  pending,
  error,
  onDraft,
  onClose,
  onSave,
  onArchive,
  onRestore,
}: {
  mode: 'create' | 'edit';
  contact: Contact | null;
  draft: ContactDraft;
  session: SessionPrincipal | null;
  pending: boolean;
  error: ContactsRequestError | null;
  onDraft: (draft: ContactDraft) => void;
  onClose: () => void;
  onSave: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const [nameMissing, setNameMissing] = useState(false);
  const archived = contact?.archivedAt !== null && contact !== null;
  const manageable = contact !== null && session !== null && canManageLifecycle(session, contact);

  function submit(): void {
    if (draft.name.trim().length === 0) {
      setNameMissing(true);
      return;
    }
    setNameMissing(false);
    onSave();
  }

  return (
    <section
      className={styles.editor}
      aria-label={mode === 'create' ? t('createTitle') : contact?.name}
    >
      <header className={styles.editorHeader}>
        <div>
          <p>{mode === 'create' ? t('createTitle') : t(`type.${contact?.type ?? draft.type}`)}</p>
          <h2>{mode === 'create' ? t('newContact') : contact?.name}</h2>
          {contact === null ? null : <small title={contact.id}>{shortId(contact.id)}</small>}
        </div>
        <button type="button" onClick={onClose}>
          {t('close')}
        </button>
      </header>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label>
          {t('name')}
          <input
            value={draft.name}
            maxLength={200}
            required
            aria-invalid={nameMissing || error?.fields.includes('name')}
            onChange={(event) => onDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label>
          {t('kind')}
          <select
            value={draft.type}
            onChange={(event) =>
              onDraft({
                ...draft,
                type: event.target.value === 'organization' ? 'organization' : 'person',
              })
            }
          >
            <option value="person">{t('type.person')}</option>
            <option value="organization">{t('type.organization')}</option>
          </select>
        </label>
        <label>
          {t('email')}
          <input
            type="email"
            value={draft.email}
            maxLength={254}
            aria-invalid={error?.fields.includes('email')}
            onChange={(event) => onDraft({ ...draft, email: event.target.value })}
          />
        </label>
        <label>
          {t('phone')}
          <input
            type="tel"
            value={draft.phone}
            maxLength={32}
            aria-invalid={error?.fields.includes('phone')}
            onChange={(event) => onDraft({ ...draft, phone: event.target.value })}
          />
        </label>
        {contact === null ? null : (
          <dl className={styles.meta}>
            <div>
              <dt>{t('owner')}</dt>
              <dd title={contact.ownerUserId}>{shortId(contact.ownerUserId)}</dd>
            </div>
            <div>
              <dt>{t('created')}</dt>
              <dd>{formatContactDate(contact.createdAt, locale)}</dd>
            </div>
            <div>
              <dt>{t('updated')}</dt>
              <dd>{formatContactDate(contact.updatedAt, locale)}</dd>
            </div>
          </dl>
        )}
        {nameMissing ? <p className={styles.errorText}>{t('errors.validation')}</p> : null}
        {error === null ? null : (
          <p className={styles.errorText}>{contactErrorText(t, error.code)}</p>
        )}
        <footer className={styles.editorActions}>
          {manageable && !archived ? (
            <button
              type="button"
              className={styles.dangerButton}
              disabled={pending}
              onClick={onArchive}
            >
              {t('archive')}
            </button>
          ) : null}
          {manageable && archived ? (
            <button type="button" disabled={pending} onClick={onRestore}>
              {t('restore')}
            </button>
          ) : null}
          <button type="submit" className={styles.primaryButton} disabled={pending}>
            {t('save')}
          </button>
        </footer>
      </form>
    </section>
  );
}
