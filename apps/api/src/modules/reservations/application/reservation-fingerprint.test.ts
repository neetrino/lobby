import type { CreateReservationCommand } from '@lobby/contracts';
import { describe, expect, it } from 'vitest';

import { requestFingerprint } from './reservation-fingerprint';

const period = {
  startsAt: new Date('2026-10-09T18:00:00.000Z'),
  endsAt: new Date('2026-10-09T19:00:00.000Z'),
};

describe('requestFingerprint', () => {
  it('keeps neighboring values distinct when one contains a field separator', () => {
    const left = requestFingerprint(command({ phone: 'a\u001fb', email: 'c@example.test' }), period);
    const right = requestFingerprint(command({ phone: 'a', email: 'b\u001fc@example.test' }), period);

    expect(left).not.toBe(right);
    expect(left).toMatch(/^[0-9a-f]{64}$/);
  });
});

function command(customer: { phone: string; email: string }): CreateReservationCommand {
  return {
    locationId: '00000000-0000-4000-8000-000000000001',
    startsAt: period.startsAt.toISOString(),
    durationMinutes: 60,
    guestCount: 2,
    customer: { name: 'Anna', ...customer },
    requestedTableId: '00000000-0000-4000-8000-000000000002',
    source: { type: 'STAFF' },
  };
}
