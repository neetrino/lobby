import type { useTranslations } from 'next-intl';

type ContactsText = ReturnType<typeof useTranslations<'contacts'>>;

export function contactErrorText(t: ContactsText, code: string): string {
  switch (code) {
    case 'UNAUTHENTICATED':
    case 'SESSION_EXPIRED':
    case 'SESSION_REVOKED':
      return t('errors.unauthenticated');
    case 'FORBIDDEN':
      return t('errors.forbidden');
    case 'MODULE_DISABLED':
      return t('errors.moduleDisabled');
    case 'CONTACT_EMAIL_TAKEN':
      return t('errors.emailTaken');
    case 'NOT_FOUND':
      return t('errors.notFound');
    case 'VALIDATION_ERROR':
      return t('errors.validation');
    default:
      return t('errors.generic');
  }
}
