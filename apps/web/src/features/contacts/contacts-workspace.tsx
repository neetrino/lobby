'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { ActionToastView, type ActionToast } from './action-toast';
import type { ContactListFilters, ContactWarning } from './contact';
import { duplicateNotices } from './duplicate-notices';
import { ContactEditor } from './contact-editor';
import { CsvExportLimitError, downloadContactsCsv } from './export-contacts-csv';
import { contactErrorText } from './contact-error';
import { toRequestError } from './contacts-api';
import { ContactsShell } from './contacts-shell';
import { ContactsTable } from './contacts-table';
import { ContactsToolbar, useContactSearch } from './contacts-toolbar';
import { ContactsTop } from './contacts-top';
import { LifecycleConfirm } from './lifecycle-confirm';
import { EditorOverlay } from './overlay-portal';
import styles from './contacts.module.css';
import { useContactEditor } from './use-contact-editor';
import { useContactFilters } from './use-contact-filters';
import { useActiveContactCount } from './use-active-contact-count';
import { useContactList, useSession } from './use-contact-list';
import { useLifecyclePrompt, type LifecycleAction } from './use-lifecycle-prompt';

export function ContactsWorkspace() {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const router = useRouter();
  const { filters, query, replace, replaceWithoutCursor } = useContactFilters();
  const list = useContactList(query);
  const activeCount = useActiveContactCount(list.revision);
  const { session, error: sessionError } = useSession();
  const editor = useContactEditor(list.reload);
  const lifecycle = useLifecyclePrompt(editor.changeArchive, list.reload);
  const signedOut = signedOutCode(sessionError?.code ?? list.error?.code);

  useEffect(() => {
    if (signedOut) {
      router.replace(`/${locale}/login`);
    }
  }, [locale, router, signedOut]);
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const [noticeHidden, setNoticeHidden] = useState(false);
  const [toast, setToast] = useState<ActionToast | null>(null);
  const dismissToast = useCallback((id: number) => {
    setToast((current) => (current?.id === id ? null : current));
  }, []);
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

  function showToast(tone: ActionToast['tone'], text: string): void {
    setToast({ id: Date.now(), tone, text });
  }

  async function saveContact(): Promise<void> {
    const result = await editor.save();
    if (result.ok) {
      showToast('ok', result.created ? t('toast.created') : t('toast.saved'));
      return;
    }
    showToast('danger', contactErrorText(t, result.error.code));
  }

  async function confirmLifecycle(): Promise<void> {
    const result = await lifecycle.confirm();
    if (result === null) {
      return;
    }
    if (!result.ok) {
      showToast('danger', lifecycleFailureText(t, result));
      return;
    }
    showToast(
      'ok',
      t(lifecycleToastKey(result.action, result.count), {
        count: result.count,
        name: result.name,
      }),
    );
  }

  async function exportCsv(): Promise<void> {
    try {
      const count = await downloadContactsCsv(
        {
          search: filters.search,
          archived: filters.archived,
          sort: filters.sort,
          limit: filters.limit,
        },
        {
          name: t('columns.name'),
          type: t('kind'),
          email: t('email'),
          phone: t('phone'),
          status: t('columns.status'),
          created: t('created'),
          person: t('type.person'),
          organization: t('type.organization'),
          active: t('status.active'),
          archived: t('status.archived'),
        },
      );
      showToast('ok', t('toast.exported', { count }));
    } catch (caught) {
      if (caught instanceof CsvExportLimitError) {
        showToast('danger', t('toast.exportLimit', { count: caught.count }));
        return;
      }
      showToast('danger', contactErrorText(t, toRequestError(caught).code));
    }
  }

  return (
    <div className={styles.app}>
      <ActionToastView toast={toast} onDone={dismissToast} />
      <ContactsShell session={session} />
      <main className={styles.main}>
        <ContactsTop
          filters={filters}
          session={session}
          search={search}
          activeCount={activeCount}
          duplicateCount={notices.length}
          onSearch={setSearch}
          onChange={changeFilters}
          onCreate={editor.openCreate}
          onExport={exportCsv}
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
          {listError === null || editor.mode !== 'closed' || lifecycle.prompt !== null ? null : (
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
              onEdit={editor.openEditor}
              onAskLifecycle={lifecycle.ask}
              onNext={showNext}
              onPrevious={showPrevious}
            />
            {lifecycle.prompt === null ? null : (
              <LifecycleConfirm
                contacts={lifecycle.prompt.contacts}
                action={lifecycle.prompt.action}
                pending={editor.pending}
                error={lifecycle.failed ? editor.error : null}
                onConfirm={() => void confirmLifecycle()}
                onCancel={lifecycle.cancel}
              />
            )}
            <EditorOverlay
              portal={editor.placement === 'portal' && editor.mode !== 'closed'}
              label={editor.contact?.name ?? t('edit')}
              onDismiss={editor.pending ? undefined : editor.close}
            >
              {editor.mode === 'closed' ? null : (
                <ContactEditor
                  mode={editor.mode}
                  contact={editor.contact}
                  draft={editor.draft}
                  rows={list.rows}
                  session={session}
                  pending={editor.pending}
                  error={editor.error}
                  onDraft={editor.setDraft}
                  onClose={editor.close}
                  onInvalid={() => showToast('danger', t('errors.validation'))}
                  onSave={() => void saveContact()}
                  onArchive={() => {
                    if (editor.contact !== null) {
                      lifecycle.ask([editor.contact], 'archive');
                    }
                  }}
                  onRestore={() => {
                    if (editor.contact !== null) {
                      lifecycle.ask([editor.contact], 'restore');
                    }
                  }}
                />
              )}
            </EditorOverlay>
          </div>
        </div>
      </main>
    </div>
  );
}

function signedOutCode(code: string | undefined): boolean {
  return code === 'UNAUTHENTICATED' || code === 'SESSION_EXPIRED' || code === 'SESSION_REVOKED';
}

function lifecycleFailureText(
  t: ReturnType<typeof useTranslations<'contacts'>>,
  result: { action: LifecycleAction; completed: number; total: number; error: { code: string } },
): string {
  if (result.completed === 0) {
    return contactErrorText(t, result.error.code);
  }
  const key = result.action === 'archive' ? 'toast.archivedPartial' : 'toast.restoredPartial';
  return t(key, { completed: result.completed, count: result.total });
}

function lifecycleToastKey(
  action: LifecycleAction,
  count: number,
): 'toast.archivedOne' | 'toast.archivedMany' | 'toast.restoredOne' | 'toast.restoredMany' {
  if (action === 'archive') {
    return count === 1 ? 'toast.archivedOne' : 'toast.archivedMany';
  }
  return count === 1 ? 'toast.restoredOne' : 'toast.restoredMany';
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
