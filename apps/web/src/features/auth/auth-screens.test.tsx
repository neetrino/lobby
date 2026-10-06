/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import messages from '../../messages/hy.json';
import { ForgotPasswordForm } from './forgot-password-form';
import { LoginForm } from './login-form';
import { ResetPasswordForm } from './reset-password-form';
import { SignOutButton } from './sign-out-button';

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('../contacts/language-switch', () => ({
  LanguageSwitch: () => null,
}));

type Reply = { status: number; body?: unknown };

let replies: Record<string, Reply> = {};

const password = 'correct-horse-battery';

describe('auth screens', () => {
  beforeEach(() => {
    router.push.mockReset();
    router.replace.mockReset();
    replies = { '/api/v1/auth/session': { status: 401 } };
    vi.stubGlobal('fetch', vi.fn(answer));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('opens the dashboard when a session already exists', async () => {
    replies['/api/v1/auth/session'] = { status: 200, body: { data: {} } };
    renderLogin();

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/hy/dashboard');
    });
  });

  it('opens the dashboard after a successful sign-in', async () => {
    replies['/api/v1/auth/login'] = { status: 200, body: { data: {} } };
    renderLogin();
    await fillLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Մտնել' }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/hy/dashboard');
    });
    expect(posted('/api/v1/auth/login')).toMatchObject({
      subdomain: 'acme',
      email: 'ada@example.com',
      password,
    });
  });

  it('shows the Armenian message for a rejected sign-in', async () => {
    replies['/api/v1/auth/login'] = { status: 401, body: { error: { code: 'INVALID_CREDENTIALS' } } };
    renderLogin();
    await fillLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Մտնել' }));

    expect(await screen.findByText('Այս տվյալները չընդունվեցին։')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows the recovery confirmation without revealing an account', async () => {
    replies['/api/v1/auth/password-resets'] = { status: 204 };
    renderForm(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText('Աշխատատեղ'), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText('Էլ. փոստ'), { target: { value: 'Ada@Example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ուղարկել հղումը' }));

    expect(await screen.findByText(/հղումը ճանապարհին է/)).toBeTruthy();
    expect(posted('/api/v1/auth/password-resets')).toEqual({
      subdomain: 'acme',
      email: 'ada@example.com',
      locale: 'hy',
    });
  });

  it('shows the Armenian recovery error from the API', async () => {
    replies['/api/v1/auth/password-resets'] = {
      status: 503,
      body: { error: { code: 'PASSWORD_RESET_UNAVAILABLE' } },
    };
    renderForm(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText('Աշխատատեղ'), { target: { value: 'acme' } });
    fireEvent.change(screen.getByLabelText('Էլ. փոստ'), { target: { value: 'ada@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ուղարկել հղումը' }));

    expect(await screen.findByText('Գաղտնաբառի վերականգնումը կարգավորված չէ։')).toBeTruthy();
  });

  it('returns to the sign-in page after a new password is saved', async () => {
    replies['/api/v1/auth/password-resets/confirm'] = { status: 204 };
    renderForm(<ResetPasswordForm token="reset-token-value" />);
    fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Թարմացնել գաղտնաբառը' }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/hy/login?notice=reset');
    });
  });

  it('shows the Armenian message for an invalid reset link', async () => {
    replies['/api/v1/auth/password-resets/confirm'] = {
      status: 400,
      body: { error: { code: 'PASSWORD_RESET_INVALID' } },
    };
    renderForm(<ResetPasswordForm token="reset-token-value" />);
    fillPasswords();
    fireEvent.click(screen.getByRole('button', { name: 'Թարմացնել գաղտնաբառը' }));

    expect(await screen.findByText('Այս հղումը վավեր չէ։ Խնդրեք նորը։')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens the sign-in page after sign-out', async () => {
    replies['/api/v1/auth/logout'] = { status: 204 };
    renderForm(<SignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Դուրս գալ' }));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/hy/login');
    });
  });

  it('shows a banner when sign-out fails', async () => {
    replies['/api/v1/auth/logout'] = { status: 503, body: { error: { code: 'SERVICE_UNAVAILABLE' } } };
    renderForm(<SignOutButton />);
    fireEvent.click(screen.getByRole('button', { name: 'Դուրս գալ' }));

    expect((await screen.findByRole('alert')).textContent).toBe('Ելքը չավարտվեց։ Նորից փորձեք։');
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Դուրս գալ' })).toHaveProperty('disabled', false);
  });
});

function renderLogin(): void {
  renderForm(
    <LoginForm
      registrationStatus="disabled"
      prefill={{ workspace: '', email: '', accountCreated: false, passwordReset: false }}
    />,
  );
}

function renderForm(node: ReactNode): void {
  render(<NextIntlClientProvider locale="hy" messages={messages}>{node}</NextIntlClientProvider>);
}

async function fillLogin(): Promise<void> {
  await screen.findByRole('button', { name: 'Մտնել' });
  fireEvent.change(screen.getByLabelText('Աշխատատեղ'), { target: { value: 'acme' } });
  fireEvent.change(screen.getByLabelText('Էլ. փոստ'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText('Գաղտնաբառ'), { target: { value: password } });
}

function fillPasswords(): void {
  fireEvent.change(screen.getByLabelText('Գաղտնաբառ'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Կրկնել գաղտնաբառը'), { target: { value: password } });
}

function answer(input: RequestInfo | URL): Promise<Response> {
  const path = new URL(String(input), 'http://localhost:3001').pathname;
  const reply = replies[path] ?? { status: 500, body: { error: { code: 'REQUEST_FAILED' } } };
  const body = reply.body === undefined ? null : JSON.stringify(reply.body);
  return Promise.resolve(new Response(body, { status: reply.status }));
}

function posted(path: string): unknown {
  const call = vi.mocked(fetch).mock.calls.find((entry) => String(entry[0]).endsWith(path));
  const init = call?.[1];
  if (init === undefined || typeof init.body !== 'string') {
    throw new Error(`No JSON body was posted to ${path}.`);
  }
  return JSON.parse(init.body) as unknown;
}
