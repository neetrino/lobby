'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ContactsRequestError, readSession } from '../contacts/contacts-api';
import type { SessionPrincipal } from '../contacts/contact';
import { ContactsShell } from '../contacts/contacts-shell';
import shell from '../contacts/contacts.module.css';
import { AddColumn, PipelineColumnView } from './pipeline-column';
import { createBoardQueue } from './pipeline-queue';
import {
  convertLead,
  createCard,
  createColumn,
  deleteCard,
  deleteColumn,
  moveCard,
  patchColumn,
  patchPipeline,
  PipelineRequestError,
  readPipeline,
  updateCard,
  type PipelineBoard,
  type PipelineKindName,
} from './pipeline-api';
import styles from './pipeline.module.css';

export function PipelineWorkspace({ kind }: { kind: PipelineKindName }) {
  const t = useTranslations('pipeline');
  const locale = useLocale();
  const router = useRouter();
  const [session, setSession] = useState<SessionPrincipal | null>(null);
  const [board, setBoard] = useState<PipelineBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const boardQueue = useRef(createBoardQueue());

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([readSession(controller.signal), readPipeline(kind, controller.signal)])
      .then(([nextSession, nextBoard]) => {
        if (controller.signal.aborted) {
          return;
        }
        if (kind === 'lead' && !nextSession.user.leadsEnabled) {
          router.replace(`/${locale}/dashboard`);
          return;
        }
        setSession(nextSession);
        setBoard(nextBoard);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (isSignedOut(reason)) {
          router.replace(`/${locale}/login`);
          return;
        }
        if (reason instanceof PipelineRequestError && reason.code === 'LEADS_DISABLED') {
          router.replace(`/${locale}/dashboard`);
          return;
        }
        setError(t('failed'));
      });
    return () => controller.abort();
  }, [kind, locale, router, t]);

  function change(action: () => Promise<PipelineBoard>): Promise<void> {
    return boardQueue.current.run(action).then(
      (next) => {
        setBoard(next);
        setError(null);
      },
      (reason: unknown) => {
        if (isSignedOut(reason)) {
          router.replace(`/${locale}/login`);
          return;
        }
        setError(reason instanceof PipelineRequestError && reason.code === 'PIPELINE_COLUMN_NOT_EMPTY'
          ? t('columnNotEmpty')
          : t('failed'));
      },
    );
  }

  return (
    <div className={shell.app}>
      <ContactsShell session={session} current={kind === 'lead' ? 'leads' : 'deals'} />
      <main className={shell.main}>
        {board === null ? <p className={styles.page}>{error ?? t('loading')}</p> : (
          <PipelineView
            board={board}
            error={error}
            locale={locale}
            userId={session?.user.id ?? null}
            onChange={change}
          />
        )}
      </main>
    </div>
  );
}

function PipelineMetrics({
  board,
  locale,
  cards,
  total,
}: {
  board: PipelineBoard;
  locale: string;
  cards: number;
  total: number;
}) {
  const t = useTranslations('pipeline');
  const empty = board.columns.filter((column) => column.cards.length === 0).length;
  return (
    <section className={styles.metrics} aria-label={t('summary')}>
      <article className={styles.metric}><span>{t('metricCards')}</span><strong>{cards}</strong></article>
      <article className={styles.metric}>
        <span>{t('metricAmount')}</span>
        <strong>{new Intl.NumberFormat(locale).format(total)} {board.amountLabel}</strong>
      </article>
      <article className={styles.metric}><span>{t('metricColumns')}</span><strong>{board.columns.length}</strong></article>
      <article className={styles.metric}><span>{t('metricEmpty')}</span><strong>{empty}</strong></article>
    </section>
  );
}

function PipelineView({
  board,
  error,
  locale,
  userId,
  onChange,
}: {
  board: PipelineBoard;
  error: string | null;
  locale: string;
  userId: string | null;
  onChange: (action: () => Promise<PipelineBoard>) => Promise<void>;
}) {
  const t = useTranslations('pipeline');
  const cards = board.columns.flatMap((column) => column.cards);
  const total = cards.reduce((sum, card) => sum + card.amount, 0);
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <input
            className={styles.nameInput}
            aria-label={t('boardName')}
            defaultValue={board.name}
            key={board.name}
            onBlur={(event) => {
              const name = event.currentTarget.value.trim();
              if (name !== '' && name !== board.name) {
                void onChange(() => patchPipeline(board.kind, { name }));
              }
            }}
          />
          <p className={styles.note}>{t('note')}</p>
        </div>
        <input
          className={styles.labelInput}
          aria-label={t('amountLabel')}
          defaultValue={board.amountLabel}
          key={board.amountLabel}
          placeholder={t('amountLabel')}
          maxLength={8}
          onBlur={(event) => {
            const amountLabel = event.currentTarget.value.trim();
            if (amountLabel !== board.amountLabel) {
              void onChange(() => patchPipeline(board.kind, { amountLabel }));
            }
          }}
        />
      </header>
      {error === null ? null : <p className={styles.banner}>{error}</p>}
      <PipelineMetrics board={board} locale={locale} cards={cards.length} total={total} />
      <div className={styles.board}>
        {board.columns.map((column) => (
          <PipelineColumnView
            key={column.id}
            column={column}
            kind={board.kind}
            userId={userId}
            amountLabel={board.amountLabel}
            locale={locale}
            onRename={(name) => void onChange(() => patchColumn(board.kind, column.id, { name }))}
            onResize={(widthPx) => onChange(() => patchColumn(board.kind, column.id, { widthPx }))}
            onDelete={() => void onChange(() => deleteColumn(board.kind, column.id))}
            onCreateCard={(draft) => void onChange(() => createCard(board.kind, { ...draft, columnId: column.id }))}
            onMoveCard={(cardId) => void onChange(() => moveCard(board.kind, cardId, column.id))}
            onDeleteCard={(cardId) => void onChange(() => deleteCard(board.kind, cardId))}
            onSaveCard={(cardId, patch) => void onChange(() => updateCard(board.kind, cardId, patch))}
            onConvertCard={(cardId) => void onChange(() => convertLead(cardId))}
          />
        ))}
        <AddColumn onCreate={(name) => void onChange(() => createColumn(board.kind, name))} />
      </div>
    </div>
  );
}

function isSignedOut(reason: unknown): boolean {
  if (!(reason instanceof PipelineRequestError) && !(reason instanceof ContactsRequestError)) {
    return false;
  }
  return reason.status === 401
    || reason.code === 'UNAUTHENTICATED'
    || reason.code === 'SESSION_EXPIRED'
    || reason.code === 'SESSION_REVOKED';
}
