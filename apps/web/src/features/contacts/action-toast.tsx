'use client';

import { useEffect, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import styles from './action-toast.module.css';

const TOAST_VISIBLE_MS = 4000;

export type ActionToast = {
  id: number;
  tone: 'ok' | 'danger';
  text: string;
};

/** Success and failure notice fixed at the top-right of the page. */
export function ActionToastView({
  toast,
  onDone,
}: {
  toast: ActionToast | null;
  onDone: (id: number) => void;
}): ReactNode {
  const mounted = useSyncExternalStore(subscribe, isClient, isServer);

  useEffect(() => {
    if (toast === null) {
      return undefined;
    }
    const id = toast.id;
    const timer = window.setTimeout(() => onDone(id), TOAST_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [toast, onDone]);

  if (!mounted || toast === null) {
    return null;
  }

  return createPortal(
    <div className={toast.tone === 'ok' ? styles.ok : styles.danger} role="status">
      {toast.tone === 'ok' ? <CheckMark /> : <BlockMark />}
      <span>{toast.text}</span>
    </div>,
    document.body,
  );
}

function CheckMark(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#fff" />
      <path
        d="M7.2 12.4l3.1 3.1 6.5-6.8"
        fill="none"
        stroke="#16a34a"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BlockMark(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path d="M7.5 16.5l9-9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function subscribe(): () => void {
  return () => undefined;
}

function isClient(): boolean {
  return true;
}

function isServer(): boolean {
  return false;
}
