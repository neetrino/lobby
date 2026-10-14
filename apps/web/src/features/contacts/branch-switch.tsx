'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactElement, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { anchoredStyle, useAnchoredBox, useMenuDismiss } from '../../ui/select/anchored-menu';
import { listVenues } from '../reservations/reservations-api';
import type { Venue } from '../reservations/reservations-model';
import styles from './contacts.module.css';

const storageKey = 'lobby-branch';

export function BranchSwitch({
  role,
}: {
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | undefined;
}): ReactElement {
  const t = useTranslations('contacts');
  const { venues, selectedId, select } = useBranches();
  const name = branchName(venues, selectedId, t('branch'));
  const options = [{ id: '', name: t('branch') }, ...venues];
  if (role !== 'OWNER') {
    return <p className={styles.branch}>{name}</p>;
  }
  return (
    <BranchPicker name={name} venues={options} selectedId={selectedId ?? ''} onSelect={select} />
  );
}

function BranchPicker({
  name,
  venues,
  selectedId,
  onSelect,
}: {
  name: string;
  venues: ReadonlyArray<{ id: string; name: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}): ReactElement {
  const t = useTranslations('contacts');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();
  useMenuDismiss(open, rootRef, menuRef, () => setOpen(false));
  const chevron = open ? `${styles.branchChevron} ${styles.branchChevronOpen}` : styles.branchChevron;
  return (
    <div className={styles.branch} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.branchButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{name}</span>
        <ChevronDown className={chevron} aria-hidden="true" />
      </button>
      {open ? (
        <BranchList
          menuRef={menuRef}
          anchor={buttonRef}
          menuId={menuId}
          label={t('branch')}
          venues={venues}
          selectedId={selectedId}
          onSelect={(id) => {
            onSelect(id);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function BranchList({
  menuRef,
  anchor,
  menuId,
  label,
  venues,
  selectedId,
  onSelect,
}: {
  menuRef: RefObject<HTMLUListElement | null>;
  anchor: RefObject<HTMLButtonElement | null>;
  menuId: string;
  label: string;
  venues: ReadonlyArray<{ id: string; name: string }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}): ReactElement | null {
  const box = useAnchoredBox(anchor, menuRef, { clip: false, contain: true });
  if (typeof document === 'undefined') return null;
  return createPortal(
    <ul
      ref={menuRef}
      id={menuId}
      className={styles.branchList}
      role="listbox"
      aria-label={label}
      style={anchoredStyle(box, 'minWidth')}
    >
      {venues.map((venue) => (
        <li key={venue.id} role="none">
          <button
            type="button"
            role="option"
            aria-selected={venue.id === selectedId}
            className={venue.id === selectedId ? styles.branchChoiceOn : styles.branchChoice}
            onClick={() => onSelect(venue.id)}
          >
            {venue.name}
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  );
}

function useBranches(): {
  venues: Venue[];
  selectedId: string | null;
  select: (id: string) => void;
} {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    listVenues(controller.signal)
      .then((rows) => {
        setVenues(rows);
        setSelectedId(pickBranch(rows));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  return {
    venues,
    selectedId,
    select(id: string): void {
      if (id === '') window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, id);
      setSelectedId(id === '' ? null : id);
    },
  };
}

function pickBranch(rows: Venue[]): string | null {
  const stored = window.localStorage.getItem(storageKey);
  if (stored === null || stored === '') return null;
  return rows.some((row) => row.id === stored) ? stored : null;
}

function branchName(venues: Venue[], selectedId: string | null, fallback: string): string {
  return venues.find((venue) => venue.id === selectedId)?.name ?? fallback;
}
