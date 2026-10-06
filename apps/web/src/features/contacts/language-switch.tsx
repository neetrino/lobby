'use client';

import { supportedLocales, type Locale } from '@lobby/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';

import styles from './language-switch.module.css';

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('contacts.language');
  const router = useRouter();
  const locale = useLocale();
  const current = isLocale(locale) ? locale : 'en';
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useDismissWhenOpen(open, rootRef, () => setOpen(false));

  function choose(next: Locale): void {
    setOpen(false);
    if (next === current) {
      return;
    }
    router.push(`${replaceLocale(window.location.pathname, next)}${window.location.search}`);
  }

  return (
    <div className={styles.language} ref={rootRef}>
      <button
        type="button"
        className={compact ? `${styles.trigger} ${styles.compact}` : styles.trigger}
        aria-label={t('label')}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <GlobeIcon />
        <span>{compact ? codeOf(t, current) : nameOf(t, current)}</span>
        <ChevronIcon />
      </button>
      {open ? (
        <ul className={styles.menu} id={menuId} role="listbox" aria-label={t('label')}>
          {supportedLocales.map((item) => (
            <li key={item}>
              <button
                type="button"
                role="option"
                aria-selected={item === current}
                className={item === current ? styles.optionActive : styles.option}
                onClick={() => choose(item)}
              >
                <span>{nameOf(t, item)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function useDismissWhenOpen(
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

function nameOf(t: LanguageText, locale: Locale): string {
  switch (locale) {
    case 'hy':
      return t('hy');
    case 'ru':
      return t('ru');
    case 'en':
      return t('en');
  }
}

function codeOf(t: LanguageText, locale: Locale): string {
  switch (locale) {
    case 'hy':
      return t('hyCode');
    case 'ru':
      return t('ruCode');
    case 'en':
      return t('enCode');
  }
}

function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}

function replaceLocale(pathname: string, next: Locale): string {
  const segments = pathname.split('/');
  if (segments.length > 1 && isLocale(segments[1] ?? '')) {
    segments[1] = next;
    return segments.join('/');
  }
  return `/${next}${pathname}`;
}

type LanguageText = ReturnType<typeof useTranslations<'contacts.language'>>;

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <path d="M12 4c2.2 2.3 3.4 5.1 3.4 8s-1.2 5.7-3.4 8c-2.2-2.3-3.4-5.1-3.4-8s1.2-5.7 3.4-8z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10l5 5 5-5" />
    </svg>
  );
}
