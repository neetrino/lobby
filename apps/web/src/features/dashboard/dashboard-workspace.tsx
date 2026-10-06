'use client';

import type { DashboardRangeDays, DashboardScope } from '@lobby/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import type { SessionPrincipal } from '../contacts/contact';
import { ContactsShell } from '../contacts/contacts-shell';
import shell from '../contacts/contacts.module.css';
import {
  DashboardRequestError,
  readDashboard,
  readSession,
  saveDashboardLayout,
  type DashboardBoard,
} from './dashboard-api';
import { DashboardBoardView } from './dashboard-board';
import styles from './dashboard.module.css';

export function DashboardWorkspace() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const router = useRouter();
  const [session, setSession] = useState<SessionPrincipal | null>(null);
  const [board, setBoard] = useState<DashboardBoard | null>(null);
  const [range, setRange] = useState<DashboardRangeDays>(30);
  const [scope, setScope] = useState<DashboardScope>('all');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async (query: { range?: DashboardRangeDays; scope?: DashboardScope }, signal?: AbortSignal) => {
    const [nextSession, nextBoard] = await Promise.all([
      readSession(signal),
      readDashboard(query, signal),
    ]);
    setSession(nextSession);
    setBoard(nextBoard);
    setRange(nextBoard.rangeDays);
    setScope(nextBoard.scope);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([readSession(controller.signal), readDashboard({}, controller.signal)])
      .then(([nextSession, nextBoard]) => {
        if (controller.signal.aborted) {
          return;
        }
        setSession(nextSession);
        setBoard(nextBoard);
        setRange(nextBoard.rangeDays);
        setScope(nextBoard.scope);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        const code = caught instanceof DashboardRequestError ? caught.code : 'REQUEST_FAILED';
        if (code === 'UNAUTHENTICATED' || code === 'SESSION_EXPIRED' || code === 'SESSION_REVOKED') {
          router.replace(`/${locale}/login`);
          return;
        }
        setError('failed');
      });
    return () => controller.abort();
  }, [locale, router]);

  async function changeRange(next: DashboardRangeDays): Promise<void> {
    setPending(true);
    setNotice(null);
    try {
      await load({ range: next, scope });
    } catch {
      setError(t('failed'));
    } finally {
      setPending(false);
    }
  }

  async function changeScope(next: DashboardScope): Promise<void> {
    setPending(true);
    try {
      await load({ range, scope: next });
    } catch {
      setError(t('failed'));
    } finally {
      setPending(false);
    }
  }

  async function save(widgets: string[]): Promise<boolean> {
    setPending(true);
    try {
      const next = await saveDashboardLayout({ rangeDays: range, scope, widgets });
      setBoard(next);
      setNotice(t('saved'));
      return true;
    } catch {
      setError(t('failed'));
      return false;
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={shell.app}>
      <ContactsShell session={session} current="dashboard" />
      <main className={shell.main}>
        {error !== null ? <p className={styles.banner}>{t('failed')}</p> : null}
        {board === null && error === null ? <p className={styles.page}>{t('loading')}</p> : null}
        {board === null ? null : (
          <DashboardBoardView
            board={board}
            range={range}
            scope={scope}
            pending={pending}
            notice={notice}
            session={session}
            onRange={(next) => void changeRange(next)}
            onScope={(next) => void changeScope(next)}
            onSaveLayout={save}
          />
        )}
      </main>
    </div>
  );
}
