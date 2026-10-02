'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';

import type { SessionPrincipal } from './contact';
import { shortId } from './contact-format';
import styles from './contacts.module.css';

const IDLE_NAV = ['dashboard', 'deals', 'messenger', 'reservations', 'audit', 'settings'] as const;

export function ContactsShell({ session }: { session: SessionPrincipal | null }) {
  const t = useTranslations('contacts');
  const locale = useLocale();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandMark}>L</span>
        <span>
          <strong>{t('title')}</strong>
          <small>Lobby</small>
        </span>
      </div>
      <nav className={styles.nav} aria-label={t('title')}>
        {IDLE_NAV.slice(0, 3).map((item) => (
          <span key={item} className={styles.navIdle} aria-disabled="true">
            {t(`nav.${item}`)}
          </span>
        ))}
        <Link className={styles.navActive} href={`/${locale}/contacts`} aria-current="page">
          {t('nav.contacts')}
        </Link>
        {IDLE_NAV.slice(3).map((item) => (
          <span key={item} className={styles.navIdle} aria-disabled="true">
            {t(`nav.${item}`)}
          </span>
        ))}
      </nav>
      {session === null ? null : (
        <p className={styles.session}>
          <span>{t(`role.${session.user.role}`)}</span>
          <span title={session.tenant.id}>{t('tenant', { id: shortId(session.tenant.id) })}</span>
        </p>
      )}
    </aside>
  );
}
