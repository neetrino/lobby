'use client';

import { useEffect, useId, useRef, useState, type ReactElement, type RefObject } from 'react';

import styles from './filter-menu.module.css';

export function FilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismiss(open, rootRef, () => setOpen(false));
  const current = options.find((option) => option.value === value)?.label ?? label;

  return (
    <div className={styles.menu} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onClick={() => setOpen((next) => !next)}
      >
        <span>{label}</span>
        <strong>{current}</strong>
        <ChevronIcon />
      </button>
      {open ? (
        <FilterChoices
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
  menuId,
  label,
  value,
  options,
  onChange,
}: {
  menuId: string;
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <ul className={styles.list} id={menuId} role="listbox" aria-label={label}>
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
    </ul>
  );
}

function ChevronIcon(): ReactElement {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2.5 4.5 6 8l3.5-3.5" />
    </svg>
  );
}

function useDismiss(
  open: boolean,
  rootRef: RefObject<HTMLDivElement | null>,
  close: () => void,
): void {
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
