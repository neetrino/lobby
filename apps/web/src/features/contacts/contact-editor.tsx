'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { ContactAvatar, TypeBadge } from './contact-avatar';
import {
  canManageLifecycle,
  type Contact,
  type ContactDraft,
  type SessionPrincipal,
} from './contact';
import { contactErrorText } from './contact-error';
import { shortId } from './contact-format';
import type { ContactsRequestError } from './contacts-api';
import {
  AuditEvents,
  DetailTabs,
  DuplicateList,
  RelatedModules,
  type DetailTab,
} from './contact-detail-sections';
import { duplicatePeers } from './duplicate-notices';
import styles from './contacts.module.css';
import tableStyles from './contacts-table.module.css';
import panel from './contact-editor.module.css';
import { useContactAudit } from './use-contact-audit';

export function ContactEditor({
  mode,
  contact,
  draft,
  rows,
  session,
  pending,
  error,
  onDraft,
  onClose,
  onInvalid,
  onSave,
  onArchive,
  onRestore,
}: {
  mode: 'create' | 'edit';
  contact: Contact | null;
  draft: ContactDraft;
  rows: readonly Contact[];
  session: SessionPrincipal | null;
  pending: boolean;
  error: ContactsRequestError | null;
  onDraft: (draft: ContactDraft) => void;
  onClose: () => void;
  onInvalid: () => void;
  onSave: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const t = useTranslations('contacts');
  const panelRef = useRef<HTMLElement>(null);
  const [nameMissing, setNameMissing] = useState(false);
  const [tabState, setTabState] = useState<{ id: string; tab: DetailTab }>({
    id: '',
    tab: 'main',
  });
  const archived = contact?.archivedAt !== null && contact !== null;
  const manageable = contact !== null && session !== null && canManageLifecycle(session, contact);
  const canReadAudit = session?.user.role === 'OWNER' || session?.user.role === 'ADMIN';
  const audit = useContactAudit(contact?.id ?? null, canReadAudit);
  const peers = contact === null ? [] : duplicatePeers(contact, rows);
  const tab = tabState.id === contact?.id ? tabState.tab : 'main';

  useEffect(() => {
    panelRef.current?.scrollIntoView({ block: 'start' });
  }, [mode, contact?.id]);

  function submit(): void {
    if (draft.name.trim().length === 0) {
      setNameMissing(true);
      onInvalid();
      return;
    }
    setNameMissing(false);
    onSave();
  }

  return (
    <section
      ref={panelRef}
      className={styles.editor}
      aria-label={mode === 'create' ? t('createTitle') : contact?.name}
    >
      <EditorProfile mode={mode} contact={contact} draft={draft} onClose={onClose} />
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {contact === null ? null : (
          <DetailTabs
            tab={tab}
            duplicateCount={peers.length}
            onTab={(next) => {
              if (contact !== null) {
                setTabState({ id: contact.id, tab: next });
              }
            }}
          />
        )}
        {contact !== null && tab !== 'main' ? null : (
          <div className={panel.sheet}>
            <div className={panel.sectionHead}>
              <h3>{t('columns.details')}</h3>
              <span className={panel.hint}>{t('normalized')}</span>
            </div>
            <div className={panel.fields}>
              <EditorFields
                draft={draft}
                error={error}
                nameMissing={nameMissing}
                onDraft={onDraft}
              />
            </div>
          </div>
        )}
        {contact !== null && (tab === 'main' || tab === 'modules') ? <RelatedModules /> : null}
        {contact !== null && (tab === 'main' || tab === 'audit') ? (
          <AuditEvents events={audit.events} status={audit.status} />
        ) : null}
        {contact !== null && tab === 'duplicates' ? (
          <DuplicateList contact={contact} rows={rows} />
        ) : null}
        {nameMissing ? <p className={styles.errorText}>{t('errors.validation')}</p> : null}
        {error === null ? null : (
          <p className={styles.errorText}>{contactErrorText(t, error.code)}</p>
        )}
        <footer className={`${styles.editorActions} ${panel.footer}`}>
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

function EditorProfile({
  mode,
  contact,
  draft,
  onClose,
}: {
  mode: 'create' | 'edit';
  contact: Contact | null;
  draft: ContactDraft;
  onClose: () => void;
}) {
  const t = useTranslations('contacts');
  const archived = contact?.archivedAt !== null && contact !== null;
  const title = mode === 'create' ? t('newContact') : (contact?.name ?? draft.name);

  return (
    <header className={`${styles.editorHeader} ${panel.profile}`}>
      {contact === null ? null : (
        <ContactAvatar name={contact.name} type={contact.type} id={contact.id} />
      )}
      <div>
        <h2>{title}</h2>
        <p>
          <TypeBadge type={contact?.type ?? draft.type} />
          {contact === null ? null : <small title={contact.id}>ID: {shortId(contact.id)}</small>}
          {contact === null ? null : (
            <span className={archived ? tableStyles.statusArchived : tableStyles.statusActive}>
              {archived ? t('status.archived') : t('status.active')}
            </span>
          )}
        </p>
      </div>
      <button type="button" className={panel.close} onClick={onClose}>
        {t('close')}
      </button>
    </header>
  );
}

function EditorFields({
  draft,
  error,
  nameMissing,
  onDraft,
}: {
  draft: ContactDraft;
  error: ContactsRequestError | null;
  nameMissing: boolean;
  onDraft: (draft: ContactDraft) => void;
}) {
  const t = useTranslations('contacts');
  return (
    <>
      <label>
        {t('detailName')}
        <input
          value={draft.name}
          maxLength={200}
          required
          aria-invalid={nameMissing || error?.fields.includes('name')}
          onChange={(event) => onDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <label>
        {t('detailEmail')}
        <span className={panel.control}>
          <input
            type="email"
            value={draft.email}
            maxLength={254}
            aria-invalid={error?.fields.includes('email')}
            onChange={(event) => onDraft({ ...draft, email: event.target.value })}
          />
          {draft.email.includes('@') ? <CheckMark /> : null}
        </span>
      </label>
      <label>
        {t('detailPhone')}
        <span className={panel.control}>
          <input
            type="tel"
            value={draft.phone}
            maxLength={32}
            aria-invalid={error?.fields.includes('phone')}
            onChange={(event) => onDraft({ ...draft, phone: event.target.value })}
          />
          <PhoneMark />
        </span>
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
    </>
  );
}

function CheckMark() {
  return (
    <span className={panel.mark} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16">
        <circle cx="12" cy="12" r="8" />
        <path d="M8.5 12.5l2.2 2.2 4.8-5" />
      </svg>
    </span>
  );
}

function PhoneMark() {
  return (
    <span className={panel.mark} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path d="M8 4h3l1 4-2 1a12 12 0 0 0 5 5l1-2 4 1v3a2 2 0 0 1-2 2A16 16 0 0 1 6 6a2 2 0 0 1 2-2z" />
      </svg>
    </span>
  );
}
