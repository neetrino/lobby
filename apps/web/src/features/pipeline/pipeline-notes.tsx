'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';

import { addCardNote, readCardNotes, updateCardNote, type PipelineKindName } from './pipeline-api';
import styles from './pipeline.module.css';

export function PipelineNotes({ cardId, cardTitle, kind, initialCount }: {
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
  const [position, setPosition] = useState({ x: 24, y: 88 });

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
      () => { if (!controller.signal.aborted) { setError(true); setLoading(false); } },
    );
    return () => controller.abort();
  }, [cardId, kind, open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  async function saveNote(): Promise<void> {
    const body = draft.trim();
    if (body === '' || body === savedDraft || saving) return;
    setSaving(true);
    setError(false);
    try {
      const note = noteId === null
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
    setPosition({ x: Math.max(16, window.innerWidth - 390), y: 88 });
    setOpen(true);
  }

  return (
    <>
      <button type="button" className={styles.noteButton} aria-label={t('openNotes')} onClick={openNotes}>
        <Image src="/pipeline-note.png" alt="" width={28} height={28} className={styles.noteIcon} />
        {count === 0 ? null : <span className={styles.noteBadge}>{count > 99 ? '99+' : count}</span>}
      </button>
      {open ? createPortal(
        <section
          className={styles.stickyNotePanel}
          role="dialog"
          aria-label={t('notesTitle', { title: cardTitle })}
          style={{ left: position.x, top: position.y }}
        >
          <header className={`${styles.chatHeader} ${styles.stickyDragHandle}`} onPointerDown={(event) => startDrag(event, position, setPosition)}>
            <Image src="/pipeline-note.png" alt="" width={48} height={48} className={styles.noteHeaderIcon} />
            <div><strong>{t('notes')}</strong><small>{cardTitle}</small></div>
            <button type="button" className={styles.iconButton} aria-label={t('closeNotes')} onPointerDown={(event) => event.stopPropagation()} onClick={() => setOpen(false)}>×</button>
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
        </section>, document.body) : null}
    </>
  );
}

function startDrag(
  event: ReactPointerEvent<HTMLElement>,
  start: { x: number; y: number },
  setPosition: (position: { x: number; y: number }) => void,
): void {
  if (event.button !== 0) return;
  event.preventDefault();
  const originX = event.clientX;
  const originY = event.clientY;
  const move = (pointer: PointerEvent) => {
    const maxX = Math.max(8, window.innerWidth - 280);
    const maxY = Math.max(8, window.innerHeight - 120);
    setPosition({
      x: Math.min(maxX, Math.max(8, start.x + pointer.clientX - originX)),
      y: Math.min(maxY, Math.max(8, start.y + pointer.clientY - originY)),
    });
  };
  const stop = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stop);
}
