import { describe, expect, it } from 'vitest';

import { formatArchivedMark, formatContactStamp } from './contact-format';

describe('formatArchivedMark', () => {
  it('formats the archive stamp as dd.mm.yyyy HH:mm in UTC', () => {
    expect(formatArchivedMark('2025-04-14T11:04:00.000Z')).toBe('14.04.2025 11:04');
  });
});

describe('formatContactStamp', () => {
  it('shows hours and minutes without seconds', () => {
    expect(formatContactStamp('2026-10-02T09:30:07.460Z', 'en')).toEqual({
      date: 'Oct 2, 2026',
      time: '09:30',
    });
  });
});
