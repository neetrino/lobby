'use client';

import {
  Briefcase,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  MessageCircle,
  Settings,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
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
  { id: 'reservations', href: 'reservations' },
  { id: 'audit', href: 'audit' },
  { id: 'settings', href: 'settings' },
] as const;

type NavId = (typeof NAV)[number]['id'];

const NAV_ICONS: Record<NavId, LucideIcon> = {
  dashboard: LayoutDashboard,
  leads: UserPlus,
  deals: Briefcase,
  messenger: MessageCircle,
  contacts: User,
  team: Users,
  reservations: Calendar,
  audit: ClipboardList,
  settings: Settings,
};

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

type ShellPage =
  'contacts' | 'dashboard' | 'leads' | 'deals' | 'settings' | 'team' | 'reservations' | 'audit';

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
  const canReadAudit = session?.user.role === 'OWNER' || session?.user.role === 'ADMIN';
  const [leadChoice, setLeadChoice] = useState<{ source: boolean; value: boolean } | null>(null);
  const sidebarOpen = useSyncExternalStore(
    subscribeSidebar,
    readSidebarOpen,
    readServerSidebarOpen,
  );
  const leadsOn = leadChoice?.source === sessionLeads ? leadChoice.value : sessionLeads;

  useEffect(() => {
    if (session?.platform === true) {
      router.replace(`/${locale}/platform`);
    }
  }, [locale, router, session]);

  return (
    <aside className={sidebarOpen ? `${styles.sidebar} ${styles.sidebarWide}` : styles.sidebar}>
      <div className={styles.sidebarHead}>
        <Link className={styles.brand} href={`/${locale}/dashboard`}>
          <span className={styles.brandMark}>L</span>
          <span>
            <strong>Lobby</strong>
            <small>{t('workspaceName')}</small>
          </span>
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
      <nav className={styles.nav} aria-label={t('workspaceName')}>
        {NAV.filter(
          (item) => (item.id !== 'leads' || leadsOn) && (item.id !== 'audit' || canReadAudit),
        ).map((item) => (
          <NavItem
            key={item.id}
            item={item}
            current={current}
            locale={locale}
            label={t(`nav.${item.id}`)}
          />
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
      <span className={styles.navIdle} aria-disabled="true" title={label}>
        {content}
      </span>
    );
  }
  return (
    <Link
      className={active ? styles.navActive : styles.navLink}
      href={`/${locale}/${item.href}`}
      aria-current={active ? 'page' : undefined}
      title={label}
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
          <SignOutButton
            className={styles.accountAction}
            groupClassName={styles.accountMenuGroup}
          />
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

function ItemIcon({ name }: { name: NavId }) {
  const Icon = NAV_ICONS[name];
  return <Icon className={styles.navIcon} aria-hidden="true" />;
}
