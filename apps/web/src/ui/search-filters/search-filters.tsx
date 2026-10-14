'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactElement, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { anchoredStyle, useAnchoredBox, type AnchoredBox } from '../select/anchored-menu';
import styles from './search-filters.module.css';

const panelMinWidth = 520;

export function SearchFilters({
  value,
  onChange,
  placeholder,
  label,
  maxLength,
  resetLabel,
  applyLabel,
  onReset,
  onApply,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  maxLength?: number;
  resetLabel?: string;
  applyLabel?: string;
  onReset?: () => void;
  onApply?: () => void;
  children?: ReactNode;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLLabelElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const hasFilters = children != null && children !== false;
  useFilterDismiss(open && hasFilters, rootRef, panelRef, () => setOpen(false));

  return (
    <div className={styles.root} ref={rootRef}>
      <SearchBox
        fieldRef={fieldRef}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        label={label}
        onChange={onChange}
        onFocus={() => {
          if (hasFilters) setOpen(true);
        }}
      />
      {open && hasFilters ? (
        <FilterPanel
          panelRef={panelRef}
          anchor={fieldRef}
          panelId={panelId}
          resetLabel={resetLabel ?? ''}
          applyLabel={applyLabel ?? ''}
          onReset={onReset ?? noop}
          onApply={() => {
            onApply?.();
            setOpen(false);
          }}
        >
          {children}
        </FilterPanel>
      ) : null}
    </div>
  );
}

function SearchBox({
  fieldRef,
  value,
  maxLength,
  placeholder,
  label,
  onChange,
  onFocus,
}: {
  fieldRef: RefObject<HTMLLabelElement | null>;
  value: string;
  maxLength?: number;
  placeholder: string;
  label: string;
  onChange: (value: string) => void;
  onFocus: () => void;
}): ReactElement {
  return (
    <label className={styles.field} ref={fieldRef}>
      <SearchIcon />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
      />
    </label>
  );
}

/** One labeled control inside the search filter panel. */
export function FilterField({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}): ReactElement {
  const className = wide ? `${styles.item} ${styles.wide}` : styles.item;
  return (
    <div className={className}>
      <span>{label}</span>
      {children}
    </div>
  );
}

function FilterPanel({
  panelRef,
  anchor,
  panelId,
  resetLabel,
  applyLabel,
  onReset,
  onApply,
  children,
}: {
  panelRef: RefObject<HTMLDivElement | null>;
  anchor: RefObject<HTMLLabelElement | null>;
  panelId: string;
  resetLabel: string;
  applyLabel: string;
  onReset: () => void;
  onApply: () => void;
  children: ReactNode;
}): ReactElement | null {
  const box = useAnchoredBox(anchor, panelRef, { limit: 640, clip: false, contain: true });
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div ref={panelRef} id={panelId} className={styles.panel} role="region" style={panelStyle(box)}>
      <div className={styles.grid}>{children}</div>
      <div className={styles.actions}>
        <button type="button" className={styles.reset} onClick={onReset}>
          {resetLabel}
        </button>
        <button type="button" className={styles.apply} onClick={onApply}>
          {applyLabel}
        </button>
      </div>
    </div>,
    document.body,
  );
}

function useFilterDismiss(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  close: () => void,
): void {
  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[role="listbox"], [role="dialog"]')) return;
      close();
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close, open, panelRef, rootRef]);
}

function panelStyle(box: AnchoredBox): CSSProperties {
  const style = anchoredStyle(box, 'width');
  const width = Math.min(Math.max(box.width, panelMinWidth), 760, window.innerWidth - 16);
  const left = Math.max(8, Math.min(box.left, window.innerWidth - width - 8));
  return { ...style, width, left };
}

function noop(): void {
  return undefined;
}

function SearchIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m16.2 16.2 4 4" />
    </svg>
  );
}
