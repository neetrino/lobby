'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import styles from './overlay-portal.module.css';

/** Full-screen dimmed layer rendered on `document.body` through React's portal. */
export function OverlayPortal({
  onDismiss,
  raised = false,
  children,
}: {
  onDismiss?: () => void;
  raised?: boolean;
  children: ReactNode;
}): ReactNode {
  const mounted = useSyncExternalStore(subscribe, isClient, isServer);

  useEffect(() => {
    if (!mounted || onDismiss === undefined) {
      return undefined;
    }
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onDismiss?.();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mounted, onDismiss]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      className={raised ? styles.backdropRaised : styles.backdrop}
      onClick={() => {
        onDismiss?.();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Inline editor, or the same editor centered in a portal. */
export function EditorOverlay({
  portal,
  label,
  onDismiss,
  children,
}: {
  portal: boolean;
  label: string;
  onDismiss?: () => void;
  children: ReactNode;
}): ReactNode {
  if (children === null || children === undefined || children === false) {
    return null;
  }
  if (!portal) {
    return children;
  }
  return (
    <OverlayPortal onDismiss={onDismiss}>
      <div
        className={styles.editorFrame}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </OverlayPortal>
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
