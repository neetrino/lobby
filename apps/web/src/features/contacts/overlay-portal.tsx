'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type AnimationEvent as ReactAnimationEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { SheetDismissProvider } from '../../ui/overlay/sheet-dismiss';
import { SheetFrame, sheetStyles } from '../../ui/side-sheet/side-sheet';
import { isTopLayer, pushLayer, quietRestore, removeLayer, trapTab } from './portal-layer';
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
  const closed = useRef(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  const close = useCallback(() => {
    if (dismissRef.current === undefined || closed.current) {
      return;
    }
    if (prefersReducedMotion()) {
      closed.current = true;
      dismissRef.current();
      return;
    }
    setLeaving(true);
  }, []);

  function finishClose(event: ReactAnimationEvent<HTMLDivElement>): void {
    if (!leaving || closed.current || event.target === event.currentTarget) {
      return;
    }
    const panel = event.target;
    if (!(panel instanceof HTMLElement) || panel.parentElement !== event.currentTarget) {
      return;
    }
    closed.current = true;
    dismissRef.current?.();
  }

  useEffect(() => {
    if (!leaving) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      if (closed.current) {
        return;
      }
      closed.current = true;
      dismissRef.current?.();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [leaving]);

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
        quietRestore(dialog);
        close();
        const node = document.activeElement;
        if (node instanceof HTMLElement) node.blur();
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
  }, [close, mounted]);

  if (!mounted) {
    return null;
  }

  const backdrop = raised ? styles.backdropRaised : styles.backdrop;
  return createPortal(
    <div
      ref={rootRef}
      className={leaving ? `${backdrop} ${styles.backdropLeaving}` : backdrop}
      tabIndex={-1}
      onAnimationEnd={finishClose}
      onClick={close}
    >
      <SheetDismissProvider dismiss={close}>{children}</SheetDismissProvider>
    </div>,
    document.body,
  );
}

/** Inline editor, or the same editor in a right-hand sheet. */
export function EditorOverlay({
  portal,
  label,
  closeLabel,
  onDismiss,
  children,
}: {
  portal: boolean;
  label: string;
  closeLabel: string;
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
      <SheetFrame frameClassName={sheetStyles.frameTabs} label={label} closeLabel={closeLabel}>
        {children}
      </SheetFrame>
    </OverlayPortal>
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
