import { describe, expect, it } from 'vitest';

import { buildMonth, dateTimeValue, parseDateTime, shiftMonth, withTime } from './calendar-model';

describe('calendar model', () => {
  it('parses a date and a local date-time', () => {
    expect(parseDateTime('2026-10-14')).toMatchObject({ year: 2026, month: 9, day: 14, hour: 0 });
    expect(parseDateTime('2026-10-14T18:30')).toMatchObject({ hour: 18, minute: 30 });
    expect(parseDateTime('2026-02-31')).toBeNull();
  });

  it('keeps the selected time when the day changes', () => {
    expect(withTime('2026-10-14', 9, 5)).toBe('2026-10-14T09:05');
    expect(dateTimeValue({ year: 2026, month: 9, day: 14, hour: 9, minute: 5 })).toBe(
      '2026-10-14T09:05',
    );
  });

  it('starts October 2026 on the Thursday cell', () => {
    const english = buildMonth(2026, 9, 0);
    const monday = buildMonth(2026, 9, 1);
    expect(english[4]?.value).toBe('2026-10-01');
    expect(english[4]?.inMonth).toBe(true);
    expect(monday[3]?.value).toBe('2026-10-01');
    expect(english[0]?.inMonth).toBe(false);
  });

  it('rolls the month across the year boundary', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
  });
});
