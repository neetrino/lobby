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
  if (role !== 'OWNER' || venues.length === 0) {
    return <p className={styles.branch}>{name}</p>;
  }
  return (
    <BranchPicker name={name} venues={venues} selectedId={selectedId} onSelect={select} />
  );
}

function BranchPicker({
  name,
  venues,
  selectedId,
  onSelect,
}: {
  name: string;
  venues: Venue[];
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
  venues: Venue[];
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
      window.localStorage.setItem(storageKey, id);
      setSelectedId(id);
    },
  };
}

function pickBranch(rows: Venue[]): string | null {
  if (rows.length === 0) return null;
  const stored = window.localStorage.getItem(storageKey);
  return rows.some((row) => row.id === stored) ? stored : rows[0].id;
}

function branchName(venues: Venue[], selectedId: string | null, fallback: string): string {
  return venues.find((venue) => venue.id === selectedId)?.name ?? fallback;
}
