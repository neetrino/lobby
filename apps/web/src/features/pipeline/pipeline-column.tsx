'use client';

import { useTranslations } from 'next-intl';
import { useState, type DragEvent, type PointerEvent as ReactPointerEvent } from 'react';

import { PipelineCardView } from './pipeline-card';
import { clampColumnWidth } from './pipeline-width';
import type { CardUpdate, PipelineColumn, PipelineKindName } from './pipeline-api';
import styles from './pipeline.module.css';

export function PipelineColumnView({
  column,
  amountLabel,
  locale,
  onRename,
  onResize,
  onDelete,
  kind,
  userId,
  onCreateCard,
  onMoveCard,
  onDeleteCard,
  onSaveCard,
  onConvertCard,
}: {
  column: PipelineColumn;
  kind: PipelineKindName;
  userId: string | null;
  amountLabel: string;
  locale: string;
  onRename: (name: string) => void;
  onResize: (widthPx: number) => Promise<void>;
  onDelete: () => void;
  onCreateCard: (draft: { title: string; company: string; amount: number }) => void;
  onMoveCard: (cardId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onSaveCard: (cardId: string, patch: CardUpdate) => void;
  onConvertCard: (cardId: string) => void;
}) {
  const t = useTranslations('pipeline');
  const [draft, setDraft] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const width = draft ?? column.widthPx;
  const sum = column.cards.reduce((total, card) => total + card.amount, 0);
  return (
    <section
      className={styles.column}
      style={{ width }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => dropCard(event, onMoveCard)}
    >
      <header className={styles.columnHead}>
        <input
          className={styles.columnName}
          aria-label={t('columnName')}
          defaultValue={column.name}
          key={column.name}
          onBlur={(event) => commitName(event.currentTarget.value, column.name, onRename)}
        />
        <span className={styles.count}>{column.cards.length}</span>
        <button type="button" className={styles.iconButton} aria-label={t('deleteColumn')} onClick={() => setConfirming(true)}>
          ×
        </button>
      </header>
      {confirming ? (
        <div className={styles.confirm}>
          <p>{t('confirmColumn')}</p>
          <button type="button" className={styles.danger} onClick={onDelete}>{t('deleteColumn')}</button>
          <button type="button" className={styles.add} onClick={() => setConfirming(false)}>{t('cancel')}</button>
        </div>
      ) : null}
      <p className={styles.sum}>
        {formatAmount(sum, locale)} {amountLabel}
      </p>
      <div className={styles.cards}>
        {column.cards.map((card, index) => (
          <PipelineCardView
            key={card.id}
            card={card}
            index={index}
            total={column.cards.length}
            kind={kind}
            userId={userId}
            amountLabel={amountLabel}
            locale={locale}
            onSave={(patch) => onSaveCard(card.id, patch)}
            onDelete={() => onDeleteCard(card.id)}
            onConvert={() => onConvertCard(card.id)}
          />
        ))}
      </div>
      <AddCard onCreate={onCreateCard} />
      <span
        className={styles.handle}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('resize')}
        onPointerDown={(event) => startResize(event, width, setDraft, onResize)}
      />
    </section>
  );
}

function AddCard({ onCreate }: { onCreate: (draft: { title: string; company: string; amount: number }) => void }) {
  const t = useTranslations('pipeline');
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className={styles.add} onClick={() => setOpen(true)}>
        {t('addCard')}
      </button>
    );
  }
  return (
    <form
      className={styles.field}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const title = String(data.get('title') ?? '').trim();
        if (title === '') {
          return;
        }
        onCreate({
          title,
          company: String(data.get('company') ?? '').trim(),
          amount: Math.max(0, Math.round(Number(data.get('amount') ?? 0) || 0)),
        });
        setOpen(false);
      }}
    >
      <input name="title" aria-label={t('cardTitle')} placeholder={t('cardTitle')} required />
      <input name="company" aria-label={t('company')} placeholder={t('company')} />
      <input name="amount" aria-label={t('amount')} placeholder={t('amount')} inputMode="numeric" />
      <button type="submit" className={styles.add}>{t('save')}</button>
    </form>
  );
}

function AddColumn({ onCreate }: { onCreate: (name: string) => void }) {
  const t = useTranslations('pipeline');
  return (
    <form
      className={styles.addColumn}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = String(data.get('name') ?? '').trim();
        if (name === '') {
          return;
        }
        onCreate(name);
        event.currentTarget.reset();
      }}
    >
      <strong>{t('addColumn')}</strong>
      <input name="name" aria-label={t('columnName')} placeholder={t('columnName')} required />
      <button type="submit" className={styles.add}>{t('save')}</button>
    </form>
  );
}

export { AddColumn };

function commitName(next: string, current: string, onRename: (name: string) => void): void {
  const name = next.trim();
  if (name !== '' && name !== current) {
    onRename(name);
  }
}

function dropCard(event: DragEvent, onMove: (cardId: string) => void): void {
  event.preventDefault();
  const cardId = event.dataTransfer.getData('text/plain');
  if (cardId !== '') {
    onMove(cardId);
  }
}

function startResize(
  event: ReactPointerEvent,
  startWidth: number,
  setDraft: (widthPx: number | null) => void,
  onResize: (widthPx: number) => Promise<void>,
): void {
  event.preventDefault();
  const startX = event.clientX;
  const next = (clientX: number) => clampColumnWidth(startWidth + clientX - startX);
  const move = (pointer: PointerEvent) => setDraft(next(pointer.clientX));
  const stop = (pointer: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', stop);
    const widthPx = next(pointer.clientX);
    setDraft(widthPx);
    void onResize(widthPx).finally(() => setDraft(null));
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', stop);
}

function formatAmount(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(amount);
}
