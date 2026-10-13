/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthRequestError } from '../auth/auth-api';
import messages from '../../messages/hy.json';
import { AcceptInvitationForm } from './accept-invitation-form';

const invitationId = '11111111-1111-4111-8111-111111111111';
const token = 'invitation-token-value';

const { exchangeInvitation, previewInvitation } = vi.hoisted(() => ({
  exchangeInvitation: vi.fn(),
  previewInvitation: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('../contacts/language-switch', () => ({
  LanguageSwitch: () => null,
}));

vi.mock('./members-api', () => ({
  exchangeInvitation,
  previewInvitation,
  acceptInvitation: vi.fn(),
}));

describe('accept invitation link', () => {
  afterEach(() => {
    cleanup();
    exchangeInvitation.mockReset();
    previewInvitation.mockReset();
    vi.restoreAllMocks();
  });

  it('keeps the token in the address when exchange fails', async () => {
    exchangeInvitation.mockRejectedValue(new AuthRequestError(400, 'INVITATION_INVALID'));
    const replaceState = vi.spyOn(window.history, 'replaceState');
    renderForm();

    expect(await screen.findByText('Այս հրավերը վավեր չէ։')).toBeTruthy();
    expect(replaceState).not.toHaveBeenCalled();
    expect(previewInvitation).not.toHaveBeenCalled();
  });

  it('removes the token from the address only after exchange succeeds', async () => {
    exchangeInvitation.mockResolvedValue(undefined);
    previewInvitation.mockResolvedValue({
      organizationName: 'Acme',
      subdomain: 'acme',
      email: 'ada@example.com',
      role: 'MEMBER',
    });
    const replaceState = vi.spyOn(window.history, 'replaceState');
    renderForm();

    expect(await screen.findByText(/ada@example.com/)).toBeTruthy();
    await waitFor(() => {
      expect(replaceState).toHaveBeenCalledWith(
        window.history.state,
        '',
        `/hy/invitations/accept?id=${encodeURIComponent(invitationId)}`,
      );
    });
  });
});

function renderForm(): void {
  render(
    <NextIntlClientProvider locale="hy" messages={messages}>
      <AcceptInvitationForm invitationId={invitationId} token={token} />
    </NextIntlClientProvider>,
  );
}
