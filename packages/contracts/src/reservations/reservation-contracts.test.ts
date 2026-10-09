import { describe, expect, it } from 'vitest';

import {
  RESERVATION_CREATED_EVENT_VERSION,
  createReservationSchema,
  moduleKeySchema,
  reservationCreatedEventSchema,
  reservationStatusSchema,
  reservationTransitionActionSchema,
  reservationTransitionTarget,
  transitionReservationSchema,
} from '../index.js';

const tableId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';

const command = {
  locationId,
  startsAt: '2026-11-01T18:00:00.000Z',
  durationMinutes: 90,
  guestCount: 4,
  customer: { name: 'Ada', phone: '+37400000000' },
  requestedTableId: tableId,
  source: { type: 'STAFF' as const },
};

describe('reservation contracts', () => {
  it('accepts a valid staff-created reservation request', () => {
    expect(createReservationSchema.safeParse(command).success).toBe(true);
  });

  it('rejects a staff booking with no phone or email and an unknown field', () => {
    expect(
      createReservationSchema.safeParse({
        ...command,
        customer: { name: 'Ada' },
      }).success,
    ).toBe(false);
    expect(createReservationSchema.safeParse({ ...command, tenantId: locationId }).success).toBe(
      false,
    );
  });

  it('allows a walk-in without a phone or email', () => {
    expect(
      createReservationSchema.safeParse({
        ...command,
        customer: { name: 'Ada' },
        source: { type: 'WALK_IN' },
      }).success,
    ).toBe(true);
  });

  it('exposes the approved reservation states and module key', () => {
    expect(reservationStatusSchema.safeParse('CONFIRMED').success).toBe(true);
    expect(reservationStatusSchema.safeParse('UNKNOWN').success).toBe(false);
    expect(reservationTransitionActionSchema.safeParse('no-show').success).toBe(true);
    expect(reservationTransitionActionSchema.safeParse('cancel').success).toBe(false);
    expect(reservationTransitionTarget('confirm')).toBe('CONFIRMED');
    expect(transitionReservationSchema.parse(undefined)).toEqual({});
    expect(transitionReservationSchema.safeParse({ reason: 'Guest called' }).success).toBe(true);
    expect(moduleKeySchema.safeParse('reservations').success).toBe(true);
  });

  it('accepts only the canonical reservation-created version without contact details', () => {
    const event = {
      eventId: '33333333-3333-4333-8333-333333333333',
      eventType: 'reservation.created',
      eventVersion: RESERVATION_CREATED_EVENT_VERSION,
      tenantId: '44444444-4444-4444-8444-444444444444',
      aggregateType: 'reservation',
      aggregateId: '55555555-5555-4555-8555-555555555555',
      occurredAt: '2026-10-01T17:55:00.000Z',
      payload: {
        reservationId: '55555555-5555-4555-8555-555555555555',
        locationId,
        contactId: null,
        source: 'WHATSAPP',
        status: 'PENDING',
        startsAt: '2026-11-01T18:00:00.000Z',
      },
    };
    const parsed = reservationCreatedEventSchema.safeParse(event);
    expect(parsed.success && parsed.data.eventVersion).toBe(RESERVATION_CREATED_EVENT_VERSION);
    expect(
      reservationCreatedEventSchema.safeParse({
        ...event,
        payload: { ...event.payload, phone: '+37400000000' },
      }).success,
    ).toBe(false);
  });
});
