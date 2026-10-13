'use client';

import type { ReactNode } from 'react';

import { LanguageSwitch } from '../contacts/language-switch';
import styles from './auth.module.css';

export function AuthFrame({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.top}>
          <span className={styles.mark} aria-hidden="true">
            L
          </span>
          <LanguageSwitch />
        </div>
        <h1>{title}</h1>
        {note === undefined ? null : <p className={styles.note}>{note}</p>}
        {children}
      </section>
    </main>
  );
}
