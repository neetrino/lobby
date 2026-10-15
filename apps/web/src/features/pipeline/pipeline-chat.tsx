'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { SheetChrome, SheetFrame } from '../../ui/side-sheet/side-sheet';
import { OverlayPortal } from '../contacts/overlay-portal';

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
                {messages.map((message) => (
                  <article key={message.id} className={styles.chatMessage}>
                    <div>
                      <strong>{message.authorName}</strong>
                      <time dateTime={message.createdAt}>
                        {formatMessageTime(message.createdAt)}
                      </time>
                    </div>
                    <p>{message.body}</p>
                  </article>
                ))}
                <div ref={end} />
              </div>
              {error ? <p className={styles.chatError}>{t('chatFailed')}</p> : null}
              <form className={styles.chatComposer} onSubmit={(event) => void submit(event)}>
                <textarea
                  autoFocus
                  name="body"
                  maxLength={2000}
                  required
                  aria-label={t('chatMessage')}
                  placeholder={t('chatPlaceholder')}
                />
                <button type="submit" disabled={sending}>
                  {sending ? t('chatSending') : t('chatSend')}
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

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
