'use client';

import { Check, X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import styles from './action-toast.module.css';

const TOAST_VISIBLE_MS = 4000;
const TOAST_LEAVE_MS = 200;

export type ActionToast = {
  id: number;
  tone: 'ok' | 'danger';
  text: string;
};

/** Centered notice. It fades in, then fades out before `onDone`. */
export function ActionToastView({
  toast,
  onDone,
}: {
  toast: ActionToast | null;
  onDone: (id: number) => void;
}): ReactNode {
  const mounted = useSyncExternalStore(subscribe, isClient, isServer);
  if (!mounted || toast === null) {
    return null;
  }
  return createPortal(<ToastCard key={toast.id} toast={toast} onDone={onDone} />, document.body);
}

function ToastCard({
  toast,
  onDone,
}: {
  toast: ActionToast;
  onDone: (id: number) => void;
}): ReactElement {
  const [leaving, setLeaving] = useState(false);
  useToastLifetime(toast.id, onDone, setLeaving);
  useToastLeave(leaving, toast.id, onDone);
  const tone = toast.tone === 'ok' ? styles.card : `${styles.card} ${styles.danger}`;
  const layer = leaving ? `${styles.layer} ${styles.leaving}` : styles.layer;
  return (
    <div className={layer} role="status">
      <div className={tone}>
        <Mark tone={toast.tone} />
        <span>{toast.text}</span>
      </div>
    </div>
  );
}

function useToastLifetime(
  id: number,
  onDone: (id: number) => void,
  onLeave: (leaving: boolean) => void,
): void {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (prefersReducedMotion()) {
        onDone(id);
        return;
      }
      onLeave(true);
    }, TOAST_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [id, onDone, onLeave]);
}

function useToastLeave(leaving: boolean, id: number, onDone: (id: number) => void): void {
  useEffect(() => {
    if (!leaving) {
      return undefined;
    }
    const timer = window.setTimeout(() => onDone(id), TOAST_LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [id, leaving, onDone]);
}

function Mark({ tone }: { tone: ActionToast['tone'] }): ReactElement {
  const Icon = tone === 'ok' ? Check : X;
  return (
    <span className={styles.mark}>
      <Icon aria-hidden="true" size={16} strokeWidth={2.4} />
    </span>
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
