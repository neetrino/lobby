import { describe, expect, it } from 'vitest';

import { toRegistrationStatus } from './auth-api';
import {
  loginFieldErrors,
  loginPrefill,
  recoveryFieldErrors,
  resetFieldErrors,
  signInRequiredHref,
  signupFieldErrors,
  type SignupDraft,
} from './auth-draft';

const signup: SignupDraft = {
  organization: 'Acme',
  workspace: 'acme',
  name: 'Ada',
  email: 'ada@example.com',
  password: 'correct-horse',
  confirmPassword: 'correct-horse',
  locale: 'en',
};

describe('toRegistrationStatus', () => {
  it('keeps an unread switch separate from a closed registration', () => {
    expect(toRegistrationStatus(true)).toBe('enabled');
    expect(toRegistrationStatus(false)).toBe('disabled');
    expect(toRegistrationStatus(undefined)).toBe('unavailable');
  });
});

describe('signupFieldErrors', () => {
  it('accepts a complete owner draft', () => {
    expect(signupFieldErrors(signup)).toEqual({});
  });

  it('rejects a short password, a bad workspace, and a mismatched confirmation', () => {
    expect(
      signupFieldErrors({
        ...signup,
        workspace: 'Acme Mall',
        password: 'short',
        confirmPassword: 'other-password',
      }),
    ).toMatchObject({
      workspace: 'workspace',
      password: 'passwordLength',
      confirmPassword: 'mismatch',
    });
  });
});

describe('signInRequiredHref', () => {
  it('prefills workspace and email and leaves the password out', () => {
    const href = signInRequiredHref('hy', ' YeReVan-Mall ', 'Owner@Yerevan-Mall.test');
    const url = new URL(href, 'http://localhost:3000');

    expect(url.pathname).toBe('/hy/login');
    expect(url.searchParams.get('workspace')).toBe('yerevan-mall');
    expect(url.searchParams.get('email')).toBe('owner@yerevan-mall.test');
    expect(url.searchParams.get('notice')).toBe('created');
    expect(url.searchParams.has('password')).toBe(false);
    expect(
      loginPrefill({
        workspace: url.searchParams.get('workspace') ?? '',
        email: url.searchParams.get('email') ?? '',
        notice: url.searchParams.get('notice') ?? '',
      }),
    ).toEqual({
      workspace: 'yerevan-mall',
      email: 'owner@yerevan-mall.test',
      accountCreated: true,
      passwordReset: false,
    });
  });
});

describe('recoveryFieldErrors', () => {
  it('requires a workspace and a valid email', () => {
    expect(recoveryFieldErrors({ workspace: 'Bad Name', email: 'not-an-email' })).toEqual({
      workspace: 'workspace',
      email: 'email',
    });
  });
});

describe('resetFieldErrors', () => {
  it('requires a long password that matches the confirmation', () => {
    expect(resetFieldErrors({ password: 'short', confirmPassword: 'other-password' })).toEqual({
      password: 'passwordLength',
      confirmPassword: 'mismatch',
    });
  });
});

describe('loginFieldErrors', () => {
  it('requires workspace, email, and password', () => {
    expect(loginFieldErrors({ workspace: '', email: '', password: '' })).toEqual({
      workspace: 'required',
      email: 'required',
      password: 'required',
    });
  });
});
