'use client';

import { useEffect, useId, useRef, useState, type ReactElement, type RefObject } from 'react';
import { useTranslations } from 'next-intl';

import { contactColumns, useContactsListUi, type ContactColumn } from './contacts-list-ui';
import styles from './contacts.module.css';

export function DensitySwitch(): ReactElement {
  const t = useTranslations('contacts');
  const ui = useContactsListUi();
  return (
    <div className={styles.density} role="group" aria-label={t('density')}>
      <button
        type="button"
        className={ui.density === 'comfortable' ? styles.filterOn : styles.filterOff}
        aria-pressed={ui.density === 'comfortable'}
        onClick={() => ui.setDensity('comfortable')}
      >
        {t('densityComfortable')}
      </button>
      <button
        type="button"
        className={ui.density === 'compact' ? styles.filterOn : styles.filterOff}
        aria-pressed={ui.density === 'compact'}
        onClick={() => ui.setDensity('compact')}
      >
        {t('densityCompact')}
      </button>
    </div>
  );
}

export function ExportButton({ onExport }: { onExport: () => Promise<void> }): ReactElement {
  const t = useTranslations('contacts');
  const [exporting, setExporting] = useState(false);

  async function exportCsv(): Promise<void> {
    setExporting(true);
    try {
      await onExport();
    } finally {
      setExporting(false);
    }
  }

  return (
    <button type="button" className={styles.exportButton} disabled={exporting} onClick={() => void exportCsv()}>
      <DownloadIcon />
      {t('csv')}
    </button>
  );
}

export function ColumnsMenu(): ReactElement {
  const t = useTranslations('contacts');
  const ui = useContactsListUi();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismiss(open, rootRef, () => setOpen(false));

  return (
    <div className={styles.menuWrap} ref={rootRef}>
      <button
        type="button"
        className={styles.filterOff}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {t('columnsMenu')}
      </button>
      {open ? (
        <ul className={styles.columnMenu} id={menuId} role="menu">
          {contactColumns().map((column) => (
            <li key={column} role="none">
              <label className={styles.columnOption}>
                <input
                  type="checkbox"
                  checked={ui.columns[column]}
                  onChange={() => ui.toggleColumn(column)}
                />
                {columnLabel(t, column)}
              </label>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DownloadIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v10" />
      <path d="M8 10l4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

function columnLabel(
  t: ReturnType<typeof useTranslations<'contacts'>>,
  column: ContactColumn,
): string {
  if (column === 'details') {
    return t('columns.details');
  }
  if (column === 'owner') {
    return t('columns.owner');
  }
  if (column === 'status') {
    return t('columns.status');
  }
  return t('columns.registered');
}

function useDismiss(open: boolean, rootRef: RefObject<HTMLDivElement | null>, close: () => void): void {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent): void {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) {
        return;
      }
      close();
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        close();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close, open, rootRef]);
}
