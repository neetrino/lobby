'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { ContactListFilters } from './contact';
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
  const listError = list.error ?? editor.error;
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
          duplicateCount={editor.warnings.length}
          onSearch={setSearch}
          onChange={changeFilters}
          onCreate={editor.openCreate}
        />
        <div className={styles.body}>
          {editor.warnings.length === 0 ? null : (
            <div className={styles.warning} role="status">
              <div>
                <strong>{t('duplicateTitle')}</strong>
                <p>{t('duplicateBody')}</p>
              </div>
              <div className={styles.warningActions}>
                {editor.warnings.map((warning) => (
                  <button
                    key={warning.contactId}
                    type="button"
                    onClick={() => void editor.openDuplicate(warning.contactId)}
                  >
                    {t('openDuplicate', { id: warning.contactId.slice(0, 8) })}
                  </button>
                ))}
                <button type="button" onClick={editor.dismissWarnings}>
                  {t('dismiss')}
                </button>
              </div>
            </div>
          )}
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
              onArchive={(contact) => void editor.changeArchive(contact, true)}
              onRestore={(contact) => void editor.changeArchive(contact, false)}
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
