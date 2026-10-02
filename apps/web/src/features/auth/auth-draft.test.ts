import { describe, expect, it } from 'vitest';

import { loginFieldErrors, signupFieldErrors, type SignupDraft } from './auth-draft';

const signup: SignupDraft = {
  organization: 'Acme',
  workspace: 'acme',
  name: 'Ada',
  email: 'ada@example.com',
  password: 'correct-horse',
  confirmPassword: 'correct-horse',
  locale: 'en',
};

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

describe('loginFieldErrors', () => {
  it('requires workspace, email, and password', () => {
    expect(loginFieldErrors({ workspace: '', email: '', password: '' })).toEqual({
      workspace: 'required',
      email: 'required',
      password: 'required',
    });
  });
});
