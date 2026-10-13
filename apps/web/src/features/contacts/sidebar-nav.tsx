'use client';

import {
  Briefcase,
  Calendar,
  ClipboardList,
  LayoutDashboard,
  MessageCircle,
  Settings,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useLayoutEffect, useRef, type RefObject } from 'react';

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
export type ShellPage =
  'contacts' | 'dashboard' | 'leads' | 'deals' | 'settings' | 'team' | 'reservations' | 'audit';

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

let previousNavId: ShellPage | null = null;

export function SidebarNav({
  current,
  locale,
  leadsOn,
  canReadAudit,
  workspaceLabel,
  labelFor,
}: {
  current: ShellPage;
  locale: string;
  leadsOn: boolean;
  canReadAudit: boolean;
  workspaceLabel: string;
  labelFor: (id: NavId) => string;
}) {
  const navRef = useRef<HTMLElement>(null);
  useNavIndicator(navRef, current, leadsOn, canReadAudit);
  const items = NAV.filter(
    (item) => (item.id !== 'leads' || leadsOn) && (item.id !== 'audit' || canReadAudit),
  );

  return (
    <nav ref={navRef} className={styles.nav} aria-label={workspaceLabel}>
      <span className={styles.navIndicator} aria-hidden="true" />
      {items.map((item) => (
        <NavItem
          key={item.id}
          item={item}
          current={current}
          locale={locale}
          label={labelFor(item.id)}
        />
      ))}
    </nav>
  );
}

function useNavIndicator(
  navRef: RefObject<HTMLElement | null>,
  current: ShellPage,
  leadsOn: boolean,
  canReadAudit: boolean,
): void {
  useLayoutEffect(() => {
    const nav = navRef.current;
    const to = nav === null ? null : navItem(nav, current);
    if (nav === null || to === null) {
      return;
    }
    const from = previousNavId === null ? null : navItem(nav, previousNavId);
    const animate = from !== null && from !== to && !motionOff();
    placeIndicator(nav, animate ? from : to);
    nav.setAttribute('data-nav-ready', '');
    if (!animate) {
      nav.setAttribute('data-nav-motion', '');
      previousNavId = current;
      return;
    }
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      nav.setAttribute('data-nav-motion', '');
      inner = requestAnimationFrame(() => {
        placeIndicator(nav, to);
        previousNavId = current;
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [canReadAudit, current, leadsOn, navRef]);
}

function navItem(nav: HTMLElement, id: string): HTMLElement | null {
  const node = nav.querySelector(`[data-nav-id="${id}"]`);
  return node instanceof HTMLElement ? node : null;
}

function placeIndicator(nav: HTMLElement, item: HTMLElement): void {
  nav.style.setProperty('--nav-x', `${item.offsetLeft}px`);
  nav.style.setProperty('--nav-y', `${item.offsetTop}px`);
}

function motionOff(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
      <span className={styles.navIdle} data-nav-id={item.id} aria-disabled="true" title={label}>
        {content}
      </span>
    );
  }
  return (
    <Link
      className={active ? styles.navActive : styles.navLink}
      data-nav-id={item.id}
      href={`/${locale}/${item.href}`}
      aria-current={active ? 'page' : undefined}
      title={label}
    >
      {content}
    </Link>
  );
}

function ItemIcon({ name }: { name: NavId }) {
  const Icon = NAV_ICONS[name];
  return <Icon className={styles.navIcon} aria-hidden="true" />;
}
