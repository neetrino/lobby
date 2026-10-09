'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { isTopLayer, pushLayer, removeLayer, trapTab } from './portal-layer';
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
  const rootRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!mounted || root === null) {
      return undefined;
    }
    const dialog: HTMLElement = root;
    pushLayer(dialog);
    function onKey(event: KeyboardEvent): void {
      if (!isTopLayer(dialog)) {
        return;
      }
      if (event.key === 'Escape' && dismissRef.current !== undefined) {
        event.preventDefault();
        dismissRef.current();
      }
      if (event.key === 'Tab') {
        trapTab(event, dialog);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      removeLayer(dialog);
    };
  }, [mounted]);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <div
      ref={rootRef}
      className={raised ? styles.backdropRaised : styles.backdrop}
      tabIndex={-1}
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
