'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { SheetChrome, SheetFrame } from '../../ui/side-sheet/side-sheet';
import { OverlayPortal } from '../contacts/overlay-portal';
import { useSession } from '../contacts/use-contact-list';

import {
  addCardMessage,
  readCardMessages,
  type PipelineKindName,
  type PipelineMessage,
} from './pipeline-api';
import styles from './pipeline.module.css';

export function PipelineChat({
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
  const { session } = useSession();
  const selfId = session?.user.id ?? null;
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [messages, setMessages] = useState<PipelineMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    readCardMessages(kind, cardId, controller.signal).then(
      (items) => {
        setMessages(items);
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
    if (open) end.current?.scrollIntoView({ block: 'end' });
  }, [messages, open]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = String(data.get('body') ?? '').trim();
    if (body === '' || sending) return;
    setSending(true);
    setError(false);
    try {
      const message = await addCardMessage(kind, cardId, body);
      setMessages((current) => [...current, message]);
      setCount((current) => current + 1);
      form.reset();
      const field = form.elements.namedItem('body');
      if (field instanceof HTMLTextAreaElement) {
        growComposer(field);
      }
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }

  function openChat(): void {
    setLoading(true);
    setError(false);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className={styles.chatButton}
        aria-label={t('openChat')}
        onClick={openChat}
      >
        <Image
          src="/pipeline-chat.avif"
          alt=""
          width={28}
          height={28}
          className={styles.chatIcon}
        />
        {count === 0 ? null : (
          <span className={styles.chatBadge}>{count > 99 ? '99+' : count}</span>
        )}
      </button>
      {open ? (
        <OverlayPortal onDismiss={() => setOpen(false)}>
          <SheetFrame label={t('chatTitle', { title: cardTitle })} closeLabel={t('closeChat')}>
            <SheetChrome title={t('chatTitle', { title: cardTitle })}>
            <section className={styles.chatPanel}>
              <div className={styles.chatMessages} aria-live="polite">
                {loading ? <p className={styles.chatState}>{t('chatLoading')}</p> : null}
                {!loading && messages.length === 0 ? (
                  <p className={styles.chatState}>{t('chatEmpty')}</p>
                ) : null}
                {messages.map((message) => {
                  const mine = message.authorUserId === selfId;
                  return (
                    <article
                      key={message.id}
                      className={mine ? styles.outgoing : styles.incoming}
                    >
                      {mine ? null : (
                        <span className={styles.author}>{message.authorName}</span>
                      )}
                      <p className={styles.bubble}>
                        {message.body}
                        <time className={styles.clock} dateTime={message.createdAt}>
                          {formatClock(message.createdAt)}
                        </time>
                      </p>
                    </article>
                  );
                })}
                <div ref={end} />
              </div>
              {error ? <p className={styles.chatError}>{t('chatFailed')}</p> : null}
              <form className={styles.chatComposer} onSubmit={(event) => void submit(event)}>
                <textarea
                  autoFocus
                  name="body"
                  rows={1}
                  maxLength={2000}
                  required
                  aria-label={t('chatMessage')}
                  placeholder={t('chatPlaceholder')}
                  onInput={(event) => growComposer(event.currentTarget)}
                  onKeyDown={sendOnEnter}
                />
                <button type="submit" className={styles.send} disabled={sending} aria-label={t('chatSend')}>
                  <SendIcon />
                </button>
              </form>
            </section>
            </SheetChrome>
          </SheetFrame>
        </OverlayPortal>
      ) : null}
    </>
  );
}

const COMPOSER_MAX = 180;

function sendOnEnter(event: KeyboardEvent<HTMLTextAreaElement>): void {
  if (event.key !== 'Enter' || event.shiftKey) {
    return;
  }
  event.preventDefault();
  event.currentTarget.form?.requestSubmit();
}

function growComposer(field: HTMLTextAreaElement): void {
  field.style.height = 'auto';
  field.style.height = `${Math.min(Math.max(field.scrollHeight, 42), COMPOSER_MAX)}px`;
}

function formatClock(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.4 20.6 21 12 3.4 3.4 3 10l11 2-11 2z" />
    </svg>
  );
}
