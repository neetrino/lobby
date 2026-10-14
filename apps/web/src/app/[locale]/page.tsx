import { supportedLocales, type Locale } from '@lobby/contracts';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

import { readRegistrationStatus, type RegistrationStatus } from '../../features/auth/auth-api';
import { AuthFrame } from '../../features/auth/auth-frame';
import styles from '../../features/auth/auth.module.css';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LocalizedHomePage({ params }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations('home');
  const auth = await getTranslations('auth');
  const registrationStatus = await readRegistrationStatus();

  return (
    <AuthFrame>
      <div className={styles.actions}>
        <Link className={`${styles.submit} ${styles.action}`} href={`/${locale}/login`}>
          {t('signIn')}
        </Link>
        <Link className={`${styles.secondary} ${styles.action}`} href={`/${locale}/contacts`}>
          {t('contacts')}
        </Link>
      </div>
      <HomeNotice
        locale={locale}
        status={registrationStatus}
        createLabel={t('createWorkspace')}
        unavailable={auth('errors.unavailable')}
        disabled={auth('errors.disabled')}
      />
    </AuthFrame>
  );
}

function HomeNotice({
  locale,
  status,
  createLabel,
  unavailable,
  disabled,
}: {
  locale: string;
  status: RegistrationStatus;
  createLabel: string;
  unavailable: string;
  disabled: string;
}) {
  if (status === 'enabled') {
    return (
      <p className={styles.footer}>
        <Link className={styles.link} href={`/${locale}/sign-up`}>
          {createLabel}
        </Link>
      </p>
    );
  }
  return <p className={styles.homeNotice}>{status === 'disabled' ? disabled : unavailable}</p>;
}

function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}
