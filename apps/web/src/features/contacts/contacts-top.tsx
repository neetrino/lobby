'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactElement, type RefObject } from 'react';
import Link from 'next/link';

import { SignOutButton } from '../auth/sign-out-button';
import type { SessionPrincipal } from './contact';
import { LanguageSwitch } from './language-switch';
import styles from './contacts-top.module.css';

export function ContactsTop({
  session,
  activeCount,
  duplicateCount,
  onCreate,
}: {
  session: SessionPrincipal | null;
  activeCount: number | null;
  duplicateCount: number;
  onCreate: () => void;
}) {
  const t = useTranslations('contacts');
  const locale = useLocale();
  return (
    <>
      <TopBar session={session} />
      <div className={styles.context}>
        <nav className={styles.crumbs} aria-label={t('homeCrumb')}>
          <Link href={`/${locale}`}>
            <HomeIcon />
            {t('homeCrumb')}
          </Link>
          <span aria-hidden="true">›</span>
          <strong>{t('pageTitle')}</strong>
        </nav>
      </div>
      <PageHeader activeCount={activeCount} duplicateCount={duplicateCount} onCreate={onCreate} />
    </>
  );
}

function TopBar({ session }: { session: SessionPrincipal | null }) {
  const t = useTranslations('contacts');
  return (
    <header className={styles.bar}>
      <span className={styles.branch}>
        <StoreIcon />
        {t('branch')}
      </span>
      <div className={styles.account}>
        <span className={styles.bell} aria-hidden="true">
          <BellIcon />
        </span>
        <LanguageSwitch />
        <UserMenu session={session} />
      </div>
    </header>
  );
}

function PageHeader({
  activeCount,
  duplicateCount,
  onCreate,
}: {
  activeCount: number | null;
  duplicateCount: number;
  onCreate: () => void;
}) {
  const t = useTranslations('contacts');
  return (
    <section className={styles.pageHead}>
      <div>
        <div className={styles.titleLine}>
          <h1>{t('pageTitle')}</h1>
          {activeCount === null ? null : (
            <span className={styles.activeBadge}>{t('activeCount', { count: activeCount })}</span>
          )}
          {duplicateCount === 0 ? null : (
            <span className={styles.duplicateBadge}>
              <i aria-hidden="true" />
              {t('duplicateCount', { count: duplicateCount })}
            </span>
          )}
        </div>
        <p>{t('pageDescription')}</p>
      </div>
      <button type="button" className={styles.create} onClick={onCreate}>
        {t('createShort')}
      </button>
    </section>
  );
}

function UserMenu({ session }: { session: SessionPrincipal | null }) {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismiss(open, rootRef, () => setOpen(false));
  if (session === null) {
    return null;
  }
  const role = t(`role.${session.user.role}`);
  const name = session.user.name.trim() || role;
  const manager = session.user.role === 'OWNER' || session.user.role === 'ADMIN';
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
        <span className={styles.avatar} aria-hidden="true">
          {initials(name)}
        </span>
        <span>
          <strong>{name}</strong>
          <small>{role}</small>
        </span>
      </button>
      {open ? (
        <div className={styles.userPanel} id={menuId} role="menu">
          {manager ? (
            <Link className={styles.menuLink} href={`/${locale}/settings/team`} role="menuitem">
              {t('team')}
            </Link>
          ) : null}
          <SignOutButton className={styles.menuAction} groupClassName={styles.menuGroup} />
        </div>
      ) : null}
    </div>
  );
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

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase());
  return letters.join('') || 'L';
}

function HomeIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 11l8-7 8 7v8H4z" />
    </svg>
  );
}

function StoreIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10h16v9H4zM3 10l2-5h14l2 5" />
    </svg>
  );
}

function BellIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1 2H5z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  );
}
