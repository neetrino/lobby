import { describe, expect, it } from 'vitest';

import { formatArchivedMark } from './contact-format';

describe('formatArchivedMark', () => {
  it('formats the archive stamp as dd.mm.yyyy HH:mm in UTC', () => {
    expect(formatArchivedMark('2025-04-14T11:04:00.000Z')).toBe('14.04.2025 11:04');
  });
});
