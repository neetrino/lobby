import { describe, expect, it } from 'vitest';

import type { Contact } from './contact';
import { duplicateNotices, duplicatePeers } from './duplicate-notices';

describe('duplicateNotices', () => {
  it('keeps a name match after the list is loaded again', () => {
    const notices = duplicateNotices([
      contact('1', 'Աննա Հակոբյան', null),
      contact('2', 'աննա հակոբյան', null),
    ]);

    expect(notices.map((notice) => notice.contactId).sort()).toEqual(['1', '2']);
  });

  it('ignores archived rows and blank phones', () => {
    const notices = duplicateNotices([
      contact('1', 'Արամ', ''),
      contact('2', 'Գոռ', '   '),
      { ...contact('3', 'Արամ', null), archivedAt: '2026-10-02T00:00:00.000Z' },
    ]);

    expect(notices).toEqual([]);
  });

  it('returns the other active contact that shares a name', () => {
    const current = contact('1', 'Աննա Հակոբյան', null);
    const peer = contact('2', 'աննա հակոբյան', null);

    expect(duplicatePeers(current, [current, peer]).map((row) => row.id)).toEqual(['2']);
  });
});

function contact(id: string, name: string, phone: string | null): Contact {
  return {
    id,
    name,
    type: 'person',
    email: null,
    phone,
    archivedAt: null,
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    createdByUserId: 'user',
    ownerUserId: 'user',
  };
}
