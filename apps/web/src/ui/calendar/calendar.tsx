'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useRef, useState, type ReactElement } from 'react';

import { formatDisplay, type CalendarMode } from './calendar-model';
import { CalendarPanel } from './calendar-panel';
import styles from './calendar.module.css';

type DateFieldProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  mode?: CalendarMode;
  label?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  fit?: boolean;
};

/** Shared date field. Values stay `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm`. */
export function DateField({
  value,
  defaultValue = '',
  onChange,
  mode = 'date',
  label,
  name,
  required = false,
  disabled = false,
  fit = false,
}: DateFieldProps): ReactElement {
  const locale = useLocale();
  const t = useTranslations('calendar');
  const placeholder = mode === 'datetime' ? t('chooseDateTime') : t('chooseDate');
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState(defaultValue);
  const current = value ?? stored;
  const shown = formatDisplay(current, locale, mode);

  function commit(next: string, close: boolean): void {
    if (value === undefined) {
      setStored(next);
    }
    onChange?.(next);
    if (close) {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  const rootClass = fit ? `${styles.root} ${styles.fit}` : styles.root;
  return (
    <div className={rootClass} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={open ? `${styles.trigger} ${styles.triggerOpen}` : styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((next) => !next)}
      >
        <span className={shown === '' ? `${styles.value} ${styles.placeholder}` : styles.value}>
          {shown === '' ? placeholder : shown}
        </span>
        <CalendarIcon />
      </button>
      {name === undefined && !required ? null : (
        <Fallback
          name={name}
          value={current}
          required={required}
          onInvalid={() => {
            setOpen(true);
            buttonRef.current?.focus();
          }}
        />
      )}
      {open ? (
        <CalendarPanel
          menuRef={menuRef}
          anchor={buttonRef}
          rootRef={rootRef}
          menuId={menuId}
          label={label ?? placeholder}
          mode={mode}
          value={current}
          required={required}
          locale={locale}
          onChange={commit}
          onClose={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
}

function Fallback({
  name,
  value,
  required,
  onInvalid,
}: {
  name?: string;
  value: string;
  required: boolean;
  onInvalid: () => void;
}): ReactElement {
  return (
    <input
      key={value}
      className={styles.fallback}
      name={name}
      defaultValue={value}
      required={required}
      tabIndex={-1}
      aria-hidden="true"
      onInvalid={(event) => {
        event.preventDefault();
        onInvalid();
      }}
    />
  );
}

function CalendarIcon(): ReactElement {
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="3" width="12" height="11" rx="2" />
      <path d="M2 6.5h12M5 2v2.5M11 2v2.5" />
    </svg>
  );
}
