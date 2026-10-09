'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { SessionPrincipal } from '../contacts/contact';
import { ContactsRequestError, updateLeadsEnabled } from '../contacts/contacts-api';
import { ContactsShell } from '../contacts/contacts-shell';
import shell from '../contacts/contacts.module.css';
import { useSession } from '../contacts/use-contact-list';
import glass from '../../ui/glass/glass.module.css';
import styles from './workspace-settings.module.css';

export function WorkspaceSettings() {
  const t = useTranslations('contacts');
  const locale = useLocale();
  const router = useRouter();
  const { session, error } = useSession();
  const [current, setCurrent] = useState<SessionPrincipal | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const principal = current ?? session;
  const enabled = principal?.user.leadsEnabled ?? true;

  useEffect(() => {
    if (isSignedOut(error)) {
      router.replace(`/${locale}/login`);
    }
  }, [error, locale, router]);

  async function toggle(): Promise<void> {
    if (principal === null || pending) {
      return;
    }
    setPending(true);
    setFailed(false);
    try {
      setCurrent(await updateLeadsEnabled(!principal.user.leadsEnabled));
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={shell.app}>
      <ContactsShell session={principal} current="settings" />
      <main className={`${shell.main} ${glass.canvas}`}>
        <section className={styles.page}>
          <h1>{t('settingsTitle')}</h1>
          <LeadsBoardSwitch enabled={enabled} pending={pending || principal === null} onToggle={() => void toggle()} />
          {failed ? <p className={styles.failed}>{t('settingsFailed')}</p> : null}
        </section>
      </main>
    </div>
  );
}

function LeadsBoardSwitch({
  enabled,
  pending,
  onToggle,
}: {
  enabled: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('contacts');
  return (
    <article className={`${styles.card} ${glass.panel} ${glass.soft}`}>
      <div>
        <h2>{t('settingsLeadsTitle')}</h2>
        <p>{t('settingsLeadsBody')}</p>
      </div>
      <button
        type="button"
        className={enabled ? `${styles.switch} ${styles.switchOn}` : styles.switch}
        role="switch"
        aria-checked={enabled}
        disabled={pending}
        onClick={onToggle}
      >
        <span className={styles.face}>{enabled ? t('settingsOn') : t('settingsOff')}</span>
        <span className={styles.knob} />
      </button>
    </article>
  );
}

function isSignedOut(error: ContactsRequestError | null): boolean {
  return error?.code === 'UNAUTHENTICATED' || error?.code === 'SESSION_EXPIRED' || error?.code === 'SESSION_REVOKED';
}
