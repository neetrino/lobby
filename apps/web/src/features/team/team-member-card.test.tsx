/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../messages/en.json';
import { TeamMemberCard } from './team-member-card';
import type { TeamMember } from './team-api';

const member: TeamMember = {
  id: '00000000-0000-4000-8000-000000000010',
  name: 'Bea Stone',
  email: 'bea@example.com',
  role: 'MEMBER',
  jobTitle: 'Designer',
};

afterEach(() => {
  cleanup();
});

describe('team member card', () => {
  it('shows the profession and opens messaging only for someone else', () => {
    const onMessage = vi.fn();
    renderCard({ isSelf: false, onMessage });
    expect(screen.getByText('Designer')).toBeTruthy();
    expect(screen.getByText('BS')).toBeTruthy();
    screen.getByRole('button', { name: 'Message Bea Stone' }).click();
    expect(onMessage).toHaveBeenCalledWith(member);
  });

  it('hides messaging on the signed-in member', () => {
    renderCard({ isSelf: true, onMessage: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Message Bea Stone' })).toBeNull();
    expect(screen.getByText('You')).toBeTruthy();
  });
});

function renderCard({ isSelf, onMessage }: { isSelf: boolean; onMessage: (member: TeamMember) => void }): void {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TeamMemberCard
        member={member}
        isSelf={isSelf}
        selected={false}
        canEditProfession={false}
        onMessage={onMessage}
        onProfession={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
}
