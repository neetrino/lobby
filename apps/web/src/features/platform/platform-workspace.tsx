'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SignOutButton } from '../auth/sign-out-button';
import auth from '../auth/auth.module.css';
import { ContactsRequestError, readSession } from '../contacts/contacts-api';
import {
  createOrganization,
  listOrganizations,
  type NewOrganization,
  type PlatformOrganization,
} from './platform-api';
import styles from './platform.module.css';

const EMPTY: NewOrganization = { name: '', subdomain: '', ownerName: '', ownerEmail: '', password: '' };

export function PlatformWorkspace() {
  const t = useTranslations('platform');
  const locale = useLocale();
  const router = useRouter();
  const [rows, setRows] = useState<PlatformOrganization[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  usePlatformSession(locale, router, t, setRows, setError);

  return (
    <main className={auth.page}>
      <section className={auth.card}>
        <div className={auth.top}>
          <span className={auth.mark}>L</span>
          <SignOutButton className={auth.link} />
        </div>
        <h1>{t('title')}</h1>
        <p className={auth.note}>{t('intro')}</p>
        {error === null ? null : <p className={auth.banner}>{error}</p>}
        {notice === null ? null : <p className={auth.success}>{notice}</p>}
        <OrganizationForm
          onCreated={(created) => {
            setRows((current) => [created, ...current.filter((row) => row.subdomain !== created.subdomain)]);
            setNotice(t('created', { workspace: created.subdomain, email: created.ownerEmail }));
            setError(null);
          }}
          onError={(message) => {
            setNotice(null);
            setError(message);
          }}
        />
        <OrganizationList rows={rows} empty={t('empty')} />
      </section>
    </main>
  );
}

function usePlatformSession(
  locale: string,
  router: { replace: (href: string) => void },
  t: ReturnType<typeof useTranslations<'platform'>>,
  setRows: (rows: PlatformOrganization[]) => void,
  setError: (message: string) => void,
): void {
  useEffect(() => {
    const controller = new AbortController();
    readSession(controller.signal)
      .then(async (session) => {
        if (session.platform !== true) {
          router.replace(`/${locale}/dashboard`);
          return;
        }
        setRows(await listOrganizations(controller.signal));
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (caught instanceof ContactsRequestError && caught.status === 401) {
          router.replace(`/${locale}/login`);
          return;
        }
        setError(t('failed'));
      });
    return () => controller.abort();
  }, [locale, router, setError, setRows, t]);
}

function OrganizationForm({
  onCreated,
  onError,
}: {
  onCreated: (organization: PlatformOrganization) => void;
  onError: (message: string) => void;
}) {
  const t = useTranslations('platform');
  const [draft, setDraft] = useState<NewOrganization>(EMPTY);
  const [pending, setPending] = useState(false);

  async function submit(): Promise<void> {
    setPending(true);
    try {
      onCreated(await createOrganization(draft));
      setDraft(EMPTY);
    } catch (caught) {
      onError(failureText(t, caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className={auth.form}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field label={t('companyName')} value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
      <Field label={t('workspace')} value={draft.subdomain} onChange={(subdomain) => setDraft({ ...draft, subdomain })} />
      <Field label={t('ownerName')} value={draft.ownerName} onChange={(ownerName) => setDraft({ ...draft, ownerName })} />
      <Field label={t('email')} type="email" value={draft.ownerEmail} onChange={(ownerEmail) => setDraft({ ...draft, ownerEmail })} />
      <Field label={t('password')} type="password" value={draft.password} onChange={(password) => setDraft({ ...draft, password })} />
      <button className={auth.submit} type="submit" disabled={pending}>{t('submit')}</button>
    </form>
  );
}

function failureText(
  t: ReturnType<typeof useTranslations<'platform'>>,
  caught: unknown,
): string {
  const code = caught instanceof ContactsRequestError ? caught.code : 'REQUEST_FAILED';
  if (code === 'TENANT_SUBDOMAIN_TAKEN') {
    return t('taken');
  }
  return code === 'VALIDATION_ERROR' ? t('invalid') : t('failed');
}

function Field({
  label,
  value,
  type = 'text',
  onChange,
}: {
  label: string;
  value: string;
  type?: 'text' | 'email' | 'password';
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}

function OrganizationList({ rows, empty }: { rows: PlatformOrganization[]; empty: string }) {
  if (rows.length === 0) {
    return <p className={auth.hint}>{empty}</p>;
  }
  return (
    <ul className={styles.list}>
      {rows.map((row) => (
        <li key={row.subdomain}>
          <strong>{row.name}</strong>
          <span>{row.subdomain}</span>
          <span>{row.ownerEmail}</span>
        </li>
      ))}
    </ul>
  );
}
