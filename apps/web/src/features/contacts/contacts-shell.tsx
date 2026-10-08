'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';

import { SignOutButton } from '../auth/sign-out-button';
import { updateLeadsEnabled } from './contacts-api';
import type { SessionPrincipal } from './contact';
import styles from './contacts.module.css';

const NAV = [
  { id: 'dashboard', href: 'dashboard' },
  { id: 'leads', href: 'leads' },
  { id: 'deals', href: 'deals' },
  { id: 'messenger' },
  { id: 'contacts', href: 'contacts' },
  { id: 'team', href: 'team' },
  { id: 'reservations' },
  { id: 'audit' },
  { id: 'settings', href: 'settings' },
] as const;

type NavId = (typeof NAV)[number]['id'];
type ShellPage = 'contacts' | 'dashboard' | 'leads' | 'deals' | 'settings' | 'team';

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
  const sessionLeads = session?.user.leadsEnabled ?? true;
  const [leadChoice, setLeadChoice] = useState<{ source: boolean; value: boolean } | null>(null);
  const leadsOn = leadChoice?.source === sessionLeads ? leadChoice.value : sessionLeads;

  useEffect(() => {
    if (session?.platform === true) {
      router.replace(`/${locale}/platform`);
    }
  }, [locale, router, session]);

  return (
    <aside className={styles.sidebar}>
      <Link className={styles.brand} href={`/${locale}/dashboard`}>
        <span className={styles.brandMark}>L</span>
        <span>
          <strong>Lobby</strong>
          <small>{t('workspaceName')}</small>
        </span>
      </Link>
      <nav className={styles.nav} aria-label={t('workspaceName')}>
        {NAV.filter((item) => item.id !== 'leads' || leadsOn).map((item) => (
          <NavItem key={item.id} item={item} current={current} locale={locale} label={t(`nav.${item.id}`)} />
        ))}
      </nav>
      {session === null ? null : (
        <Account
          session={session}
          role={t(`role.${session.user.role}`)}
          leadsOn={leadsOn}
          current={current}
          onLeads={(enabled) => setLeadChoice({ source: sessionLeads, value: enabled })}
        />
      )}
    </aside>
  );
}

function NavItem({
  item,
  current,
  locale,
  label,
}: {
  item: (typeof NAV)[number];
  current: ShellPage;
  locale: string;
  label: string;
}) {
  const active = item.id === current;
  const content = (
    <>
      <ItemIcon name={item.id} />
      <span>{label}</span>
    </>
  );
  if (!('href' in item)) {
    return (
      <span className={styles.navIdle} aria-disabled="true">
        {content}
      </span>
    );
  }
  return (
    <Link
      className={active ? styles.navActive : styles.navLink}
      href={`/${locale}/${item.href}`}
      aria-current={active ? 'page' : undefined}
    >
      {content}
    </Link>
  );
}

function Account({
  session,
  role,
  leadsOn,
  current,
  onLeads,
}: {
  session: SessionPrincipal;
  role: string;
  leadsOn: boolean;
  current: ShellPage;
  onLeads: (enabled: boolean) => void;
}) {
  const t = useTranslations('auth');
  const leads = useTranslations('contacts');
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useDismiss(open, rootRef, () => setOpen(false));
  const name = session.user.name.trim() || role;
  return (
    <div className={styles.account} ref={rootRef}>
      {open ? (
        <div className={styles.accountMenu} id={menuId} role="menu" aria-label={t('signOut')}>
          <button
            type="button"
            className={styles.accountAction}
            role="menuitemcheckbox"
            aria-checked={leadsOn}
            onClick={() => {
              void switchLeads(leadsOn, current, locale, router, onLeads);
            }}
          >
            {leads('showLeads')}
          </button>
          <SignOutButton className={styles.accountAction} groupClassName={styles.accountMenuGroup} />
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
      </button>
    </div>
  );
}

async function switchLeads(
  enabled: boolean,
  current: ShellPage,
  locale: string,
  router: { replace: (href: string) => void },
  onLeads: (enabled: boolean) => void,
): Promise<void> {
  const next = await updateLeadsEnabled(!enabled);
  onLeads(next.user.leadsEnabled);
  if (!next.user.leadsEnabled && current === 'leads') {
    router.replace(`/${locale}/dashboard`);
  }
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

function ItemIcon({ name }: { name: NavId }) {
  return (
    <svg className={styles.navIcon} viewBox="0 0 24 24" aria-hidden="true">
      {iconPath(name)}
    </svg>
  );
}

function iconPath(name: NavId): ReactNode {
  switch (name) {
    case 'dashboard':
      return (
        <>
          <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
        </>
      );
    case 'leads':
      return (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M4 18c1-2.4 2.8-3.5 5-3.5S13 15.6 14 18M17 8h3M18.5 6.5v3" />
        </>
      );
    case 'deals':
      return (
        <>
          <path d="M4 8h16v11H4zM9 8V6h6v2" />
        </>
      );
    case 'messenger':
      return <path d="M5 6h14v9H8l-3 3z" />;
    case 'contacts':
      return (
        <>
          <circle cx="12" cy="9" r="3" />
          <path d="M6 19c1.4-2.6 3.5-4 6-4s4.6 1.4 6 4" />
        </>
      );
    case 'team':
      return (
        <>
          <circle cx="8" cy="9" r="2.4" />
          <circle cx="16" cy="9" r="2.4" />
          <path d="M3.5 18c.8-2 2.2-3 4.5-3s3.7 1 4.5 3M11.5 18c.8-2 2.2-3 4.5-3s3.7 1 4.5 3" />
        </>
      );
    case 'reservations':
      return (
        <>
          <path d="M5 5h14v15H5zM5 9h14M9 3v4M15 3v4" />
        </>
      );
    case 'audit':
      return (
        <>
          <path d="M8 3h8v18H8zM10 8h4M10 12h4M10 16h3" />
        </>
      );
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
        </>
      );
  }
}
