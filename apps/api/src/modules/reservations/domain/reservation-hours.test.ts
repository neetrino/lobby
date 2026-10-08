import { describe, expect, it } from 'vitest';

import { fitsOpenWindow } from './reservation-hours';

describe('reservation hours', () => {
  it('treats a close before the open as service past midnight', () => {
    const friday = '2026-11-06';
    const overnight = { opensMinute: 18 * 60, closesMinute: 2 * 60 };

    expect(fitsOpenWindow(at('2026-11-07T01:00:00.000Z'), at('2026-11-07T01:30:00.000Z'), 'UTC', friday, overnight)).toBe(true);
    expect(fitsOpenWindow(at('2026-11-06T17:00:00.000Z'), at('2026-11-06T19:00:00.000Z'), 'UTC', friday, overnight)).toBe(false);
    expect(fitsOpenWindow(at('2026-11-07T03:00:00.000Z'), at('2026-11-07T03:30:00.000Z'), 'UTC', friday, overnight)).toBe(false);
  });
});

function at(iso: string): Date {
  return new Date(iso);
}
