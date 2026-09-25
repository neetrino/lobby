import { describe, expect, it } from 'vitest';

import {
  assertReservationTransition,
  canTransitionReservation,
} from './reservation-status-policy';

describe('reservation status policy', () => {
  it('allows the normal restaurant service lifecycle', () => {
    expect(canTransitionReservation('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransitionReservation('CONFIRMED', 'ARRIVED')).toBe(true);
    expect(canTransitionReservation('ARRIVED', 'SEATED')).toBe(true);
    expect(canTransitionReservation('SEATED', 'COMPLETED')).toBe(true);
  });

  it('keeps terminal states terminal', () => {
    expect(() => assertReservationTransition('COMPLETED', 'CONFIRMED')).toThrow(
      'Invalid reservation status transition',
    );
    expect(canTransitionReservation('CANCELLED', 'PENDING')).toBe(false);
    expect(canTransitionReservation('NO_SHOW', 'ARRIVED')).toBe(false);
  });
});
