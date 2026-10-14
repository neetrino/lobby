'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import styles from './confirm-dialog.module.css';

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'danger' | 'primary';
  pending?: boolean;
  /** When false, confirm stays open so the caller can show a pending state. */
  closeOnConfirm?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
};

/** Centered confirmation. It fades in on open and fades out before `onClose`. */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'danger',
  pending = false,
  closeOnConfirm = true,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps): ReactNode {
  const panelRef = useRef<HTMLElement>(null);
  const after = useRef<(() => void) | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!leaving) return undefined;
    const timer = window.setTimeout(() => after.current?.(), 200);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  function dismiss(next: () => void): void {
    if (pending || leaving) return;
    if (prefersReducedMotion()) {
      next();
      return;
    }
    after.current = next;
    setLeaving(true);
  }

  if (typeof document === 'undefined') return null;
  return createPortal(
    <ConfirmPanel
      panelRef={panelRef}
      leaving={leaving}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      tone={tone}
      pending={pending}
      onDismiss={() => dismiss(onClose)}
      onConfirm={() => confirm(onConfirm, closeOnConfirm, () => dismiss(onClose))}
    >
      {children}
    </ConfirmPanel>,
    document.body,
  );
}

function ConfirmPanel({
  panelRef,
  leaving,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone,
  pending,
  onDismiss,
  onConfirm,
  children,
}: {
  panelRef: RefObject<HTMLElement | null>;
  leaving: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: 'danger' | 'primary';
  pending: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  children?: ReactNode;
}): ReactNode {
  const backdrop = leaving ? `${styles.backdrop} ${styles.leaving}` : styles.backdrop;
  return (
    <div className={backdrop} onClick={onDismiss}>
      <section
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onDismiss();
        }}
      >
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{message}</p>
        {children}
        <footer className={styles.actions}>
          <button type="button" className={styles.cancel} disabled={pending} onClick={onDismiss}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? styles.danger : styles.primary}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

function confirm(onConfirm: () => void, closeOnConfirm: boolean, dismiss: () => void): void {
  onConfirm();
  if (closeOnConfirm) dismiss();
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
