import { supportedLocales, tenantSubdomainSchema, type Locale } from '@lobby/contracts';

/** Matches the API password length policy. */
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;

export type AuthLocale = Locale;

export type LoginDraft = {
  workspace: string;
  email: string;
  password: string;
};

export type SignupDraft = {
  organization: string;
  workspace: string;
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  locale: AuthLocale;
};

export type LoginField = keyof LoginDraft;
export type SignupField = keyof SignupDraft;

export type FieldError = 'required' | 'workspace' | 'email' | 'passwordLength' | 'mismatch';

export function loginFieldErrors(draft: LoginDraft): Partial<Record<LoginField, FieldError>> {
  return {
    ...required(draft.workspace, 'workspace'),
    ...workspaceError(draft.workspace),
    ...required(draft.email, 'email'),
    ...emailError(draft.email),
    ...required(draft.password, 'password'),
  };
}

export function signupFieldErrors(draft: SignupDraft): Partial<Record<SignupField, FieldError>> {
  return {
    ...required(draft.organization, 'organization'),
    ...required(draft.workspace, 'workspace'),
    ...workspaceError(draft.workspace),
    ...required(draft.name, 'name'),
    ...required(draft.email, 'email'),
    ...emailError(draft.email),
    ...passwordError(draft.password),
    ...confirmError(draft.password, draft.confirmPassword),
  };
}

export function isAuthLocale(value: string): value is AuthLocale {
  return supportedLocales.some((locale) => locale === value);
}

export type LoginPrefill = {
  workspace: string;
  email: string;
  accountCreated: boolean;
};

/** Login query after the workspace exists but the session was not stored. */
export function signInRequiredHref(locale: string, workspace: string, email: string): string {
  const params = new URLSearchParams({
    workspace: workspace.trim().toLowerCase(),
    email: email.trim().toLowerCase(),
    notice: 'created',
  });
  return `/${locale}/login?${params.toString()}`;
}

/** Reads workspace and email from the login query. A password query is ignored. */
export function loginPrefill(params: {
  workspace?: string | string[];
  email?: string | string[];
  notice?: string | string[];
}): LoginPrefill {
  return {
    workspace: firstQueryValue(params.workspace),
    email: firstQueryValue(params.email),
    accountCreated: firstQueryValue(params.notice) === 'created',
  };
}

function firstQueryValue(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ?? '';
}

function required(
  value: string,
  field: LoginField | SignupField,
): Partial<Record<LoginField | SignupField, FieldError>> {
  return value.trim().length === 0 ? { [field]: 'required' } : {};
}

function workspaceError(value: string): Partial<Record<'workspace', FieldError>> {
  if (value.trim().length === 0) {
    return {};
  }
  return tenantSubdomainSchema.safeParse(value).success ? {} : { workspace: 'workspace' };
}

function emailError(value: string): Partial<Record<'email', FieldError>> {
  const email = value.trim();
  if (email.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {};
  }
  return { email: 'email' };
}

function passwordError(password: string): Partial<Record<'password', FieldError>> {
  if (password.length === 0) {
    return { password: 'required' };
  }
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return { password: 'passwordLength' };
  }
  return {};
}

function confirmError(
  password: string,
  confirmPassword: string,
): Partial<Record<'confirmPassword', FieldError>> {
  if (confirmPassword.length === 0) {
    return { confirmPassword: 'required' };
  }
  return password === confirmPassword ? {} : { confirmPassword: 'mismatch' };
}
