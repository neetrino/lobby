'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { ContactListFilters, ContactWarning } from './contact';
import { duplicateNotices } from './duplicate-notices';
import { ContactEditor } from './contact-editor';
import { contactErrorText } from './contact-error';
import { ContactsShell } from './contacts-shell';
import { ContactsTable } from './contacts-table';
import { ContactsToolbar, useContactSearch } from './contacts-toolbar';
import { ContactsTop } from './contacts-top';
import styles from './contacts.module.css';
import { useContactEditor } from './use-contact-editor';
import { useContactFilters } from './use-contact-filters';
import { useContactList, useSession } from './use-contact-list';

export function ContactsWorkspace() {
  const t = useTranslations('contacts');
  const { filters, query, replace, replaceWithoutCursor } = useContactFilters();
  const list = useContactList(query);
  const { session } = useSession();
  const editor = useContactEditor(list.reload);
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [noticeHidden, setNoticeHidden] = useState(false);
  const listError = list.error ?? editor.error;
  const notices = visibleNotices(editor.warnings, duplicateNotices(list.rows), noticeHidden);
  const { search, setSearch } = useContactSearch(filters, changeFilters);

  function changeFilters(next: ContactListFilters): void {
    setHistory([]);
    replaceWithoutCursor(next);
  }

  function showNext(): void {
    if (list.nextCursor === null) {
      return;
    }
    setHistory((stack) => [...stack, filters.cursor]);
    replace({ ...filters, cursor: list.nextCursor });
  }

  function showPrevious(): void {
    const prior = history.at(-1);
    if (history.length === 0) {
      return;
    }
    setHistory((stack) => stack.slice(0, -1));
    replace(prior === undefined ? withoutCursor(filters) : { ...filters, cursor: prior });
  }

  return (
    <div className={styles.app}>
      <ContactsShell session={session} />
      <main className={styles.main}>
        <ContactsTop
          filters={filters}
          session={session}
          search={search}
          duplicateCount={notices.length}
          onSearch={setSearch}
          onChange={changeFilters}
          onCreate={editor.openCreate}
        />
        <div className={styles.body}>
          <DuplicateNotice
            notices={notices}
            onOpen={(contactId) => void editor.openDuplicate(contactId)}
            onDismiss={() => {
              setNoticeHidden(true);
              editor.dismissWarnings();
            }}
          />
          {listError === null || editor.mode !== 'closed' ? null : (
            <p className={styles.errorBanner} role="alert">
              {contactErrorText(t, listError.code)}
            </p>
          )}
          <ContactsToolbar
            filters={filters}
            search={search}
            onSearch={setSearch}
            onChange={changeFilters}
          />
          <div className={styles.workspace}>
            <ContactsTable
              rows={list.rows}
              selectedId={editor.contact?.id ?? null}
              session={session}
              status={list.status}
              pending={list.pending}
              nextCursor={list.nextCursor}
              hasPrevious={history.length > 0}
              onOpen={editor.openContact}
              onArchive={(contact) => editor.changeArchive(contact, true)}
              onRestore={(contact) => editor.changeArchive(contact, false)}
              onNext={showNext}
              onPrevious={showPrevious}
            />
            {editor.mode === 'closed' ? null : (
              <ContactEditor
                mode={editor.mode}
                contact={editor.contact}
                draft={editor.draft}
                session={session}
                pending={editor.pending}
                error={editor.error}
                onDraft={editor.setDraft}
                onClose={editor.close}
                onSave={() => void editor.save()}
                onArchive={() => {
                  if (editor.contact !== null) {
                    void editor.changeArchive(editor.contact, true);
                  }
                }}
                onRestore={() => {
                  if (editor.contact !== null) {
                    void editor.changeArchive(editor.contact, false);
                  }
                }}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function visibleNotices(
  saved: readonly ContactWarning[],
  listed: readonly ContactWarning[],
  hidden: boolean,
): ContactWarning[] {
  if (saved.length > 0) {
    return [...saved];
  }
  return hidden ? [] : [...listed];
}

function DuplicateNotice({
  notices,
  onOpen,
  onDismiss,
}: {
  notices: readonly ContactWarning[];
  onOpen: (contactId: string) => void;
  onDismiss: () => void;
}) {
  const t = useTranslations('contacts');
  const duplicate = notices[0];
  if (duplicate === undefined) {
    return null;
  }
  return (
    <div className={styles.warning} role="status">
      <span className={styles.warningMark} aria-hidden="true">
        !
      </span>
      <div className={styles.warningCopy}>
        <span className={styles.warningCode}>POSSIBLE_DUPLICATE {t('duplicateNotice')}</span>
        <p>{t('duplicateBody', { count: notices.length })}</p>
      </div>
      <button
        type="button"
        className={styles.warningView}
        onClick={() => onOpen(duplicate.contactId)}
      >
        {t('viewDuplicates')}
      </button>
      <button
        type="button"
        className={styles.warningClose}
        aria-label={t('dismiss')}
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}

function withoutCursor(filters: ContactListFilters): ContactListFilters {
  return {
    search: filters.search,
    archived: filters.archived,
    sort: filters.sort,
    limit: filters.limit,
  };
}

export function ContactsLoading() {
  const t = useTranslations('contacts');
  return <p className={styles.note}>{t('loading')}</p>;
}
