'use client';

import { useId, useRef, useState, type CSSProperties, type ReactElement, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { anchoredStyle, useAnchoredBox, useMenuDismiss } from './anchored-menu';
import styles from './select.module.css';

export type SelectOption = { value: string; label: string };

/** Custom list used everywhere a native dropdown would open. */
export function Select({
  options,
  value,
  defaultValue = '',
  onChange,
  label,
  name,
  required = false,
  disabled = false,
  size = 'default',
  fit = false,
  className,
  triggerStyle,
}: {
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  label?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  size?: 'default' | 'compact';
  fit?: boolean;
  className?: string;
  triggerStyle?: CSSProperties;
}): ReactElement {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState(defaultValue);
  const current = value ?? stored;
  const selected = options.find((option) => option.value === current);
  useMenuDismiss(open, rootRef, menuRef, () => setOpen(false));

  function commit(next: string): void {
    if (value === undefined) {
      setStored(next);
    }
    onChange?.(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  const rootClass = rootClassName(className, size, fit);
  return (
    <div className={rootClass} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={open ? `${styles.trigger} ${styles.triggerOpen}` : styles.trigger}
        style={triggerStyle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((next) => !next)}
      >
        <span className={styles.value}>{selected?.label ?? ''}</span>
        <Chevron open={open} />
      </button>
      {name === undefined ? null : (
        <Fallback name={name} value={current} required={required} options={options} />
      )}
      {open ? (
        <SelectMenu
          menuRef={menuRef}
          menuId={menuId}
          label={label}
          anchor={buttonRef}
          value={current}
          options={options}
          onChange={commit}
        />
      ) : null}
    </div>
  );
}

function Fallback({
  name,
  value,
  required,
  options,
}: {
  name: string;
  value: string;
  required: boolean;
  options: readonly SelectOption[];
}): ReactElement {
  return (
    <select
      key={value}
      className={styles.fallback}
      name={name}
      defaultValue={value}
      required={required}
      tabIndex={-1}
      aria-hidden="true"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function SelectMenu({
  menuRef,
  menuId,
  label,
  anchor,
  value,
  options,
  onChange,
}: {
  menuRef: RefObject<HTMLUListElement | null>;
  menuId: string;
  label?: string;
  anchor: RefObject<HTMLButtonElement | null>;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
}): ReactElement | null {
  const box = useAnchoredBox(anchor, menuRef);
  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(
    <ul
      ref={menuRef}
      id={menuId}
      className={styles.list}
      role="listbox"
      aria-label={label}
      style={anchoredStyle(box, 'width')}
    >
      {options.map((option) => (
        <li key={option.value} role="none">
          <button
            type="button"
            role="option"
            aria-selected={option.value === value}
            className={option.value === value ? styles.optionOn : styles.option}
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

function rootClassName(
  className: string | undefined,
  size: 'default' | 'compact',
  fit: boolean,
): string {
  const names = [styles.root];
  if (size === 'compact') {
    names.push(styles.compact);
  }
  if (fit) {
    names.push(styles.fit);
  }
  if (className !== undefined) {
    names.push(className);
  }
  return names.join(' ');
}

function Chevron({ open }: { open: boolean }): ReactElement {
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
