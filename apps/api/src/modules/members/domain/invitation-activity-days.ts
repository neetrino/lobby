import { inHalfOpen, utcDayKey, utcDayKeys } from '../../../common/dates/utc-day';

export type InvitationActivityDay = {
  date: string;
  invited: number;
  accepted: number;
};

export type InvitationActivityStamp = {
  createdAt: Date;
  acceptedAt: Date | null;
};

/** Invitation and acceptance counts by UTC day. Tokens and emails are not inputs. */
export function invitationActivityDays(
  from: Date,
  to: Date,
  rows: InvitationActivityStamp[],
): InvitationActivityDay[] {
  const days = new Map(
    utcDayKeys(from, to).map((date) => [date, { date, invited: 0, accepted: 0 }]),
  );
  for (const row of rows) {
    add(days, row.createdAt, from, to, 'invited');
    if (row.acceptedAt !== null) {
      add(days, row.acceptedAt, from, to, 'accepted');
    }
  }
  return [...days.values()];
}

function add(
  days: Map<string, InvitationActivityDay>,
  stamp: Date,
  from: Date,
  to: Date,
  key: 'invited' | 'accepted',
): void {
  if (!inHalfOpen(stamp, from, to)) {
    return;
  }
  const day = days.get(utcDayKey(stamp));
  if (day !== undefined) {
    day[key] += 1;
  }
}
