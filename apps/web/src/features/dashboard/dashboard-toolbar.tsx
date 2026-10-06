'use client';

import type { DashboardRangeDays, DashboardScope } from '@lobby/contracts';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';

import { SignOutButton } from '../auth/sign-out-button';
import type { SessionPrincipal } from '../contacts/contact';
import { LanguageSwitch } from '../contacts/language-switch';
import { formatWhen } from './dashboard-layout';
import styles from './dashboard-toolbar.module.css';

const RANGES = [7, 30, 90] as const;
const SCOPES = ['all', 'mine'] as const;
const FRESH_MS = 60_000;

export function SegmentedControl<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className={styles.segment} role="group" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            className={selected ? styles.segmentOn : styles.segmentOff}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function DashboardToolbar({
  range,
  scope,
  generatedAt,
  locale,
  session,
  onRange,
  onScope,
  onCustomize,
}: {
  range: DashboardRangeDays;
  scope: DashboardScope;
  generatedAt: string;
  locale: string;
  session: SessionPrincipal | null;
  onRange: (range: DashboardRangeDays) => void;
  onScope: (scope: DashboardScope) => void;
  onCustomize: () => void;
}) {
  const t = useTranslations('dashboard');
  const roles = useTranslations('contacts');
  const updated = updatedLabel(t, generatedAt, locale);
  return (
    <header className={styles.toolbar}>
      <div>
        <h1>{t('title')}</h1>
        <p className={styles.subtitle}>
          {t('overviewLine')}
          <span aria-hidden="true"> · </span>
          {updated}
        </p>
      </div>
      <div className={styles.toolbarControls}>
        <button type="button" className={styles.ghost} onClick={onCustomize}>
          {t('customize')}
        </button>
        <SegmentedControl
          label={t('rangeLabel')}
          value={range}
          options={RANGES.map((days) => ({ value: days, label: t('rangeShort', { days }) }))}
          onChange={onRange}
        />
        <SegmentedControl
          label={t('scopeAll')}
          value={scope}
          options={SCOPES.map((value) => ({
            value,
            label: value === 'all' ? t('scopeAll') : t('scopeMine'),
          }))}
          onChange={onScope}
        />
        <LanguageSwitch compact />
        {session === null ? null : (
          <UserMenu
            label={session.user.name.trim() || roles(`role.${session.user.role}`)}
          />
        )}
      </div>
    </header>
  );
}

function UserMenu({ label }: { label: string }) {
  const t = useTranslations('dashboard');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismiss(open, rootRef, () => setOpen(false));

  return (
    <div className={styles.userMenu} ref={rootRef}>
      <button
        type="button"
        className={styles.userTrigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.userMark} aria-hidden="true">
          {label.slice(0, 1)}
        </span>
        <span>{label}</span>
        <ChevronIcon />
      </button>
      {open ? (
        <div className={styles.userPanel} id={menuId} role="menu" aria-label={t('accountMenu')}>
          <SignOutButton className={styles.menuAction} groupClassName={styles.menuGroup} />
        </div>
      ) : null}
    </div>
  );
}

function updatedLabel(
  t: ReturnType<typeof useTranslations<'dashboard'>>,
  generatedAt: string,
  locale: string,
): string {
  const time = new Date(generatedAt).getTime();
  if (Number.isNaN(time) || Date.now() - time < FRESH_MS) {
    return t('updatedNow');
  }
  return t('updatedAt', { when: formatWhen(generatedAt, locale) });
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

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10l5 5 5-5" />
    </svg>
  );
}
