import { describe, expect, it } from 'vitest';

import {
  RESERVATION_CREATED_EVENT_VERSION,
  createReservationSchema,
  moduleKeySchema,
  reservationCreatedEventSchema,
  reservationStatusSchema,
} from '../index.js';

const tableId = '11111111-1111-4111-8111-111111111111';
const venueId = '22222222-2222-4222-8222-222222222222';

describe('reservation contracts', () => {
  it('accepts a valid staff-created reservation request', () => {
    expect(
      createReservationSchema.safeParse({
        venueId,
        tableIds: [tableId],
        startsAt: '2026-10-01T18:00:00.000Z',
        endsAt: '2026-10-01T19:30:00.000Z',
        partySize: 4,
        customerName: 'Ada',
      }).success,
    ).toBe(true);
  });

  it('rejects inverted time ranges and duplicate table ids', () => {
    const result = createReservationSchema.safeParse({
      venueId,
      tableIds: [tableId, tableId],
      startsAt: '2026-10-01T19:30:00.000Z',
      endsAt: '2026-10-01T18:00:00.000Z',
      partySize: 4,
      customerName: 'Ada',
    });

    expect(result.success).toBe(false);
  });

  it('exposes the approved reservation states and module key', () => {
    expect(reservationStatusSchema.safeParse('CONFIRMED').success).toBe(true);
    expect(reservationStatusSchema.safeParse('UNKNOWN').success).toBe(false);
    expect(moduleKeySchema.safeParse('reservations').success).toBe(true);
  });

  it('accepts only the canonical reservation-created version', () => {
    const event = {
      eventId: '33333333-3333-4333-8333-333333333333',
      eventType: 'reservation.created',
      eventVersion: RESERVATION_CREATED_EVENT_VERSION,
      tenantId: '44444444-4444-4444-8444-444444444444',
      aggregateType: 'reservation',
      aggregateId: '55555555-5555-4555-8555-555555555555',
      occurredAt: '2026-10-01T17:55:00.000Z',
      payload: {
        venueId,
        tableIds: [tableId],
        startsAt: '2026-10-01T18:00:00.000Z',
        endsAt: '2026-10-01T19:30:00.000Z',
        partySize: 4,
      },
    };
    const parsed = reservationCreatedEventSchema.safeParse(event);
    expect(parsed.success && parsed.data.eventVersion).toBe(RESERVATION_CREATED_EVENT_VERSION);
    expect(
      reservationCreatedEventSchema.safeParse({
        ...event,
        eventVersion: RESERVATION_CREATED_EVENT_VERSION + 1,
      }).success,
    ).toBe(false);
  });
});
