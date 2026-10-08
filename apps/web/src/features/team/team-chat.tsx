'use client';

import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { useTranslations } from 'next-intl';

import { readDirectMessages, sendDirectMessage, type DirectMessage, type TeamMember } from './team-api';
import { isNearBottom, mergeNewest, nextScrollTop, watchLatest, type ScrollAnchor } from './team-live';
import styles from './team.module.css';

export function TeamChat({ member, selfId }: { member: TeamMember | null; selfId: string | null }) {
  return <TeamThread key={member?.id ?? 'none'} member={member} selfId={selfId} />;
}

function TeamThread({
  member,
  selfId,
}: {
  member: TeamMember | null;
  selfId: string | null;
}) {
  const t = useTranslations('team');
  const { messages, setMessages, loading, error, setError, nextCursor, setNextCursor } = useThread(member);
  const [sending, setSending] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const stickToEnd = useRef(true);
  const anchor = useRef<ScrollAnchor | null>(null);

  useLayoutEffect(() => {
    const box = scroller.current;
    const saved = anchor.current;
    if (box !== null && saved !== null) {
      box.scrollTop = nextScrollTop(saved, box.scrollHeight);
      anchor.current = null;
      return;
    }
    if (stickToEnd.current) {
      end.current?.scrollIntoView({ block: 'end' });
    }
  }, [messages]);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (member === null) {
      return;
    }
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (body === '' || sending) {
      return;
    }
    stickToEnd.current = true;
    setSending(true);
    setError(false);
    try {
      const message = await sendDirectMessage(member.id, body);
      setMessages((current) => [...current, message]);
      form.reset();
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }

  async function loadEarlier(memberId: string): Promise<void> {
    if (nextCursor === null || loadingEarlier) {
      return;
    }
    setLoadingEarlier(true);
    setError(false);
    try {
      const page = await readDirectMessages(memberId, nextCursor);
      if (page.data.length > 0) {
        rememberOffset(scroller.current, stickToEnd, anchor);
      }
      setMessages((current) => [...page.data, ...current]);
      setNextCursor(page.page.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoadingEarlier(false);
    }
  }

  return (
    <aside className={styles.chatPanel} aria-label={member === null ? t('chat') : t('chatTitle', { name: member.name })}>
      <h2>
        {t('chat')}
        {member === null ? null : <small>{member.name}</small>}
      </h2>
      <div ref={scroller} className={styles.chatMessages} aria-live="polite" onScroll={() => { followBottom(scroller.current, stickToEnd); }}>
        {nextCursor === null || member === null ? null : (
          <button type="button" className={styles.earlier} disabled={loadingEarlier} onClick={() => void loadEarlier(member.id)}>
            {t('loadEarlier')}
          </button>
        )}
        {member === null ? <p className={styles.chatState}>{t('chatPick')}</p> : null}
        {loading ? <p className={styles.chatState}>{t('chatLoading')}</p> : null}
        {!loading && member !== null && messages.length === 0 ? <p className={styles.chatState}>{t('chatEmpty')}</p> : null}
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} mine={message.authorUserId === selfId} />
        ))}
        <div ref={end} />
      </div>
      {error ? <p className={styles.failed}>{t('chatFailed')}</p> : null}
      <form className={styles.chatComposer} onSubmit={(event) => void submit(event)}>
        <textarea name="body" maxLength={2000} required disabled={member === null || sending} aria-label={t('chatMessage')} placeholder={t('chatPlaceholder')} />
        <button type="submit" className={styles.send} disabled={member === null || sending} aria-label={t('chatSend')}>
          <SendIcon />
        </button>
      </form>
    </aside>
  );
}

function useThread(member: TeamMember | null): {
  messages: DirectMessage[];
  setMessages: Dispatch<SetStateAction<DirectMessage[]>>;
  loading: boolean;
  error: boolean;
  setError: (failed: boolean) => void;
  nextCursor: string | null;
  setNextCursor: (cursor: string | null) => void;
} {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(member !== null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (member === null) {
      return;
    }
    const controller = new AbortController();
    const stop = watchLatest(member.id, controller.signal, {
      onOpen(page) {
        setMessages(page.data);
        setNextCursor(page.page.nextCursor);
        setLoading(false);
        setError(false);
      },
      onLatest(fresh) {
        setMessages((current) => mergeNewest(current, fresh));
      },
      onFail() {
        setError(true);
        setLoading(false);
      },
    });
    return () => {
      controller.abort();
      stop();
    };
  }, [member]);

  return { messages, setMessages, loading, error, setError, nextCursor, setNextCursor };
}

function followBottom(box: HTMLDivElement | null, stickToEnd: { current: boolean }): void {
  if (box === null) {
    return;
  }
  stickToEnd.current = isNearBottom(box.scrollHeight, box.scrollTop, box.clientHeight);
}

function rememberOffset(
  box: HTMLDivElement | null,
  stickToEnd: { current: boolean },
  anchor: { current: ScrollAnchor | null },
): void {
  stickToEnd.current = false;
  if (box === null) {
    return;
  }
  anchor.current = { height: box.scrollHeight, top: box.scrollTop };
}

function ChatBubble({ message, mine }: { message: DirectMessage; mine: boolean }) {
  const t = useTranslations('team');
  return (
    <article className={mine ? styles.outgoing : styles.incoming}>
      <div className={styles.meta}>
        {mine ? null : <span className={styles.mini} aria-hidden="true">{mark(message.authorName)}</span>}
        <strong>{mine ? t('you') : message.authorName}</strong>
        <time className={styles.time} dateTime={message.createdAt}>{formatClock(message.createdAt)}</time>
      </div>
      <p className={styles.bubble}>{message.body}</p>
    </article>
  );
}

function mark(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function formatClock(value: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12 20 4l-6 16-2.5-6.5z" />
    </svg>
  );
}
