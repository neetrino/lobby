import { supportedLocales, type Locale } from '@lobby/contracts';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

import { readRegistrationStatus, type RegistrationStatus } from '../../features/auth/auth-api';
import styles from '../../features/auth/auth.module.css';
import { LanguageSwitch } from '../../features/contacts/language-switch';
import { BrandLogo } from '../../ui/brand/brand-logo';

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
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.top}>
          <BrandLogo className={styles.mark} />
          <LanguageSwitch />
        </div>
        <h1>{t('title')}</h1>
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
      </section>
    </main>
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
  return <p className={styles.note}>{status === 'disabled' ? disabled : unavailable}</p>;
}

function isLocale(value: string): value is Locale {
  return supportedLocales.some((locale) => locale === value);
}
