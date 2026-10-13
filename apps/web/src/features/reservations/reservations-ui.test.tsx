/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';

import messages from '../../messages/en.json';
import { ReservationActions } from './reservations-drawer';
import { canCreateReservation, canUpdateReservation } from './reservations-model';

describe('reservation actions', () => {
  afterEach(() => cleanup());

  it('shows only the transitions the current status allows', () => {
    renderActions('PENDING', true);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reschedule' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel reservation' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Seat' })).toBeNull();
  });

  it('hides every mutation when the role cannot update reservations', () => {
    renderActions('CONFIRMED', false);
    expect(screen.queryByRole('button', { name: 'Arrive' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'No-show' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reschedule' })).toBeNull();
  });

  it('lets every current workspace role create and update reservations', () => {
    expect(canCreateReservation('MEMBER')).toBe(true);
    expect(canUpdateReservation('MEMBER')).toBe(true);
    expect(canUpdateReservation('OWNER')).toBe(true);
  });
});

function renderActions(status: string, canUpdate: boolean): void {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ReservationActions
        status={status}
        canUpdate={canUpdate}
        pending={false}
        onEdit={() => undefined}
        onCancel={() => undefined}
        onTransition={() => undefined}
      />
    </NextIntlClientProvider>,
  );
}
