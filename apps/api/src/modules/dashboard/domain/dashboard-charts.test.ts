import { describe, expect, it } from 'vitest';

import { contactActivityDays } from '../../contacts/domain/contact-activity-days';
import { invitationActivityDays } from '../../members/domain/invitation-activity-days';
import { reservationLoad } from '../../reservations/domain/reservation-load';

describe('dashboard chart buckets', () => {
  it('counts a contact create, a later update, and an archive on their own UTC days', () => {
    const days = contactActivityDays(new Date('2026-10-01T00:00:00.000Z'), new Date('2026-10-04T00:00:00.000Z'), [
      {
        createdAt: new Date('2026-10-01T08:00:00.000Z'),
        updatedAt: new Date('2026-10-02T09:00:00.000Z'),
        archivedAt: null,
      },
      {
        createdAt: new Date('2026-09-01T08:00:00.000Z'),
        updatedAt: new Date('2026-10-03T10:00:00.000Z'),
        archivedAt: new Date('2026-10-03T10:00:00.000Z'),
      },
    ]);

    expect(days.find((day) => day.date === '2026-10-01')).toMatchObject({ created: 1, updated: 0, archived: 0 });
    expect(days.find((day) => day.date === '2026-10-02')).toMatchObject({ created: 0, updated: 1, archived: 0 });
    expect(days.find((day) => day.date === '2026-10-03')).toMatchObject({ created: 0, updated: 0, archived: 1 });
    expect(days.find((day) => day.date === '2026-10-04')).toMatchObject({ created: 0, updated: 0, archived: 0 });
  });

  it('counts an invitation and its acceptance without treating a missing day as absent data', () => {
    const days = invitationActivityDays(new Date('2026-10-01T00:00:00.000Z'), new Date('2026-10-02T12:00:00.000Z'), [
      { createdAt: new Date('2026-10-01T08:00:00.000Z'), acceptedAt: new Date('2026-10-02T09:00:00.000Z') },
    ]);

    expect(days).toEqual([
      { date: '2026-10-01', invited: 1, accepted: 0 },
      { date: '2026-10-02', invited: 0, accepted: 1 },
    ]);
  });

  it('leaves an empty reservation day empty and fills only the hours between real bookings', () => {
    const today = new Date('2026-10-05T00:00:00.000Z');
    const load = reservationLoad(
      today,
      [
        { startsAt: new Date('2026-10-05T18:00:00.000Z'), partySize: 4 },
        { startsAt: new Date('2026-10-05T20:00:00.000Z'), partySize: 2 },
        { startsAt: new Date('2026-10-06T19:00:00.000Z'), partySize: 6 },
      ],
      20,
    );

    expect(load.capacity).toBe(20);
    expect(load.today).toEqual([
      { hour: 18, guests: 4 },
      { hour: 19, guests: 0 },
      { hour: 20, guests: 2 },
    ]);
    expect(load.tomorrow).toEqual([{ hour: 19, guests: 6 }]);
    expect(load.week).toEqual([
      { hour: 18, guests: 4 },
      { hour: 19, guests: 6 },
      { hour: 20, guests: 2 },
    ]);
  });
});
