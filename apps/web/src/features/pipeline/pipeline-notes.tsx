'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { addCardNote, readCardNotes, updateCardNote, type PipelineKindName } from './pipeline-api';
import styles from './pipeline.module.css';

export function PipelineNotes({
  cardId,
  cardTitle,
  kind,
  initialCount,
}: {
  cardId: string;
  cardTitle: string;
  kind: PipelineKindName;
  initialCount: number;
}) {
  const t = useTranslations('pipeline');
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [savedDraft, setSavedDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    readCardNotes(kind, cardId, controller.signal).then(
      (items) => {
        const note = items[0];
        setNoteId(note?.id ?? null);
        setDraft(note?.body ?? '');
        setSavedDraft(note?.body ?? '');
        setCount(items.length);
        setLoading(false);
      },
      () => {
        if (!controller.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      },
    );
    return () => controller.abort();
  }, [cardId, kind, open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  async function saveNote(): Promise<void> {
    const body = draft.trim();
    if (body === '' || body === savedDraft || saving) return;
    setSaving(true);
    setError(false);
    try {
      const note =
        noteId === null
          ? await addCardNote(kind, cardId, body)
          : await updateCardNote(kind, cardId, noteId, body);
      setNoteId(note.id);
      setDraft(note.body);
      setSavedDraft(note.body);
      setCount((current) => Math.max(1, current));
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  function openNotes(): void {
    setLoading(true);
    setError(false);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className={styles.noteButton}
        aria-label={t('openNotes')}
        onClick={openNotes}
      >
        <Image src="/pipeline-note.png" alt="" width={28} height={28} className={styles.noteIcon} />
        {count === 0 ? null : (
          <span className={styles.noteBadge}>{count > 99 ? '99+' : count}</span>
        )}
      </button>
      {open
        ? createPortal(
            <section
              className={styles.stickyNotePanel}
              role="dialog"
              aria-label={t('notesTitle', { title: cardTitle })}
            >
              <header className={styles.chatHeader}>
                <Image
                  src="/pipeline-note.png"
                  alt=""
                  width={48}
                  height={48}
                  className={styles.noteHeaderIcon}
                />
                <div>
                  <strong>{t('notes')}</strong>
                  <small>{cardTitle}</small>
                </div>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={t('closeNotes')}
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </header>
              <div className={styles.stickyCanvas} aria-live="polite">
                {loading ? <p className={styles.chatState}>{t('notesLoading')}</p> : null}
                {!loading ? (
                  <textarea
                    autoFocus
                    value={draft}
                    maxLength={4000}
                    aria-label={t('noteBody')}
                    placeholder={t('notesPlaceholder')}
                    onChange={(event) => setDraft(event.currentTarget.value)}
                    onBlur={() => void saveNote()}
                  />
                ) : null}
              </div>
              {error ? <p className={styles.chatError}>{t('notesFailed')}</p> : null}
              {saving ? <p className={styles.stickySaving}>{t('notesSaving')}</p> : null}
            </section>,
            document.body,
          )
        : null}
    </>
  );
}
