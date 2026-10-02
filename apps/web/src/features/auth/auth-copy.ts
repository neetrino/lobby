import type { useTranslations } from 'next-intl';

import type { FieldError } from './auth-draft';

type AuthText = ReturnType<typeof useTranslations<'auth'>>;

export function authErrorText(t: AuthText, code: string): string {
  switch (code) {
    case 'INVALID_CREDENTIALS':
      return t('errors.invalid');
    case 'TENANT_SUBDOMAIN_TAKEN':
      return t('errors.taken');
    case 'REGISTRATION_DISABLED':
      return t('errors.disabled');
    case 'VALIDATION_ERROR':
      return t('errors.validation');
    case 'RATE_LIMITED':
      return t('errors.rate');
    case 'ACCOUNT_CREATED_SIGN_IN_REQUIRED':
      return t('errors.created');
    default:
      return t('errors.failed');
  }
}

export function fieldErrorText(t: AuthText, error: FieldError): string {
  switch (error) {
    case 'required':
      return t('errors.required');
    case 'workspace':
      return t('errors.workspace');
    case 'email':
      return t('errors.email');
    case 'passwordLength':
      return t('errors.passwordLength');
    case 'mismatch':
      return t('errors.mismatch');
  }
}
