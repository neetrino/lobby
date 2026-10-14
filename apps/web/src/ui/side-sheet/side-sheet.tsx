'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { useSheetDismiss } from '../overlay/sheet-dismiss';
import styles from './side-sheet.module.css';

/** Right-hand sheet with the notched corner and circular close button. */
export function SheetFrame({
  label,
  closeLabel,
  onClose,
  className,
  children,
}: {
  label: string;
  closeLabel: string;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}): ReactNode {
  const dismiss = useSheetDismiss(onClose ?? noop);
  const surface = className === undefined ? styles.surface : `${styles.surface} ${className}`;
  return (
    <div
      className={styles.frame}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={styles.cornerClose}
        aria-label={closeLabel}
        onClick={dismiss}
      >
        <X aria-hidden="true" />
      </button>
      <div className={surface}>{children}</div>
    </div>
  );
}

function noop(): void {
  return undefined;
}
