'use client';

import type { ReactNode } from 'react';

import { BrandLogo } from '../../ui/brand/brand-logo';
import { LanguageMenu } from '../contacts/language-switch';
import styles from './auth.module.css';

export function AuthFrame({
  title,
  note,
  extra,
  children,
}: {
  title: string;
  note?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className={`${styles.page} ${styles.greenPage}`}>
      <section className={styles.card}>
        <div className={styles.top}>
          <BrandLogo className={styles.mark} />
          <div className={styles.localeCorner}>
            <LanguageMenu />
            {extra}
          </div>
        </div>
        <h1>{title}</h1>
        {note === undefined ? null : <p className={styles.note}>{note}</p>}
        {children}
      </section>
    </main>
  );
}
