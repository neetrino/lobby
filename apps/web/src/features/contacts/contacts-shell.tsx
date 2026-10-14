'use client';

import { ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';

import { SignOutButton } from '../auth/sign-out-button';
import { BrandLogo } from '../../ui/brand/brand-logo';
import type { SessionPrincipal } from './contact';
import { rememberSession } from './remembered-session';
import { LanguageMenu } from './language-switch';
import { SidebarNav, type ShellPage } from './sidebar-nav';
import styles from './contacts.module.css';

const SIDEBAR_KEY = 'lobby-sidebar';
const sidebarListeners = new Set<() => void>();

function subscribeSidebar(listener: () => void): () => void {
  sidebarListeners.add(listener);
  return () => {
    sidebarListeners.delete(listener);
  };
}

function readSidebarOpen(): boolean {
  return window.localStorage.getItem(SIDEBAR_KEY) === 'open';
}

function readServerSidebarOpen(): boolean {
  return false;
}

function writeSidebarOpen(open: boolean): void {
  window.localStorage.setItem(SIDEBAR_KEY, open ? 'open' : 'closed');
  for (const listener of sidebarListeners) {
    listener();
  }
}

export function ContactsShell({
  session,
  current = 'contacts',
}: {
  session: SessionPrincipal | null;
  current?: ShellPage;
}) {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const router = useRouter();
  const shown = rememberSession(session);
  const leadsOn = shown?.user.leadsEnabled ?? true;
  const canReadAudit = shown?.user.role === 'OWNER' || shown?.user.role === 'ADMIN';
  const sidebarOpen = useSyncExternalStore(
    subscribeSidebar,
    readSidebarOpen,
    readServerSidebarOpen,
  );
  useEffect(() => {
    if (shown?.platform === true) {
      router.replace(`/${locale}/platform`);
    }
  }, [locale, router, shown]);

  return (
    <aside className={sidebarOpen ? `${styles.sidebar} ${styles.sidebarWide}` : styles.sidebar}>
      <div className={styles.sidebarHead}>
        <Link className={styles.brand} href={`/${locale}/dashboard`} aria-label="lobi CRM">
          <BrandLogo variant="mark" className={styles.brandMark} alt="" />
          <BrandLogo variant="lockup" className={styles.brandLockup} alt="" onDark />
        </Link>
        <button
          type="button"
          className={styles.sidebarToggle}
          aria-expanded={sidebarOpen}
          aria-label={t(sidebarOpen ? 'hideSidebar' : 'showSidebar')}
          onClick={() => {
            writeSidebarOpen(!sidebarOpen);
          }}
        >
          {sidebarOpen ? <ChevronLeft aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        </button>
      </div>
      <SidebarNav
        current={current}
        locale={locale}
        leadsOn={leadsOn}
        canReadAudit={canReadAudit}
        workspaceLabel={t('workspaceName')}
        labelFor={(id) => t(`nav.${id}`)}
      />
      {shown === null ? null : (
        <Account session={shown} role={t(`role.${shown.user.role}`)} />
      )}
    </aside>
  );
}

function Account({ session, role }: { session: SessionPrincipal; role: string }) {
  const t = useTranslations('auth');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismiss(open, rootRef, () => setOpen(false));
  const name = session.user.name.trim() || role;
  return (
    <div className={styles.account} ref={rootRef}>
      {open ? (
        <div className={styles.accountMenu} id={menuId} role="menu" aria-label={t('signOut')}>
          <SignOutButton
            className={styles.accountAction}
            groupClassName={styles.accountMenuGroup}
          />
          <div className={styles.accountLanguage}>
            <LanguageMenu />
          </div>
        </div>
      ) : null}
      <button
        type="button"
        className={styles.accountButton}
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
        <span
          className={open ? `${styles.accountChevron} ${styles.accountChevronOpen}` : styles.accountChevron}
          aria-hidden="true"
        >
          <ChevronUp />
        </span>
      </button>
    </div>
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

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase());
  return letters.join('') || 'L';
}

