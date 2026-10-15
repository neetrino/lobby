'use client';

import { useId, useRef, useState, type ReactElement, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { anchoredStyle, useAnchoredBox, useMenuDismiss } from '../select/anchored-menu';
import styles from './filter-menu.module.css';

export function FilterMenu({
  label,
  value,
  options,
  onChange,
  field = false,
  white = false,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
  /** Stretch the trigger and show only the current value. The field label sits above it. */
  field?: boolean;
  /** White pill. The default trigger uses the gray control fill. */
  white?: boolean;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();
  useMenuDismiss(open, rootRef, menuRef, () => setOpen(false));
  const current = options.find((option) => option.value === value)?.label ?? label;

  return (
    <div className={field ? `${styles.menu} ${styles.field}` : styles.menu} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={white ? `${styles.trigger} ${styles.white}` : styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((next) => !next)}
      >
        {field ? null : <span>{label}</span>}
        <strong>{current}</strong>
        <ChevronIcon open={open} />
      </button>
      {open ? (
        <FilterChoices
          menuRef={menuRef}
          anchor={buttonRef}
          menuId={menuId}
          label={label}
          value={value}
          options={options}
          onChange={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function FilterChoices({
  menuRef,
  anchor,
  menuId,
  label,
  value,
  options,
  onChange,
}: {
  menuRef: RefObject<HTMLUListElement | null>;
  anchor: RefObject<HTMLButtonElement | null>;
  menuId: string;
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): ReactElement | null {
  const box = useAnchoredBox(anchor, menuRef);
  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(
    <ul
      ref={menuRef}
      className={styles.list}
      id={menuId}
      role="listbox"
      aria-label={label}
      style={anchoredStyle(box, 'minWidth')}
    >
      {options.map((option) => (
        <li key={option.value} role="none">
          <button
            type="button"
            role="option"
            aria-selected={option.value === value}
            className={option.value === value ? styles.choiceOn : styles.choice}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        </li>
      ))}
    </ul>,
    document.body,
  );
}

function ChevronIcon({ open }: { open: boolean }): ReactElement {
  return (
    <svg
      className={open ? styles.chevronOpen : styles.chevron}
      viewBox="0 0 12 12"
      aria-hidden="true"
    >
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}

