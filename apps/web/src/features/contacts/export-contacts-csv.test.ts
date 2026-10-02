import { describe, expect, it, vi } from 'vitest';

import type { Contact } from './contact';
import { listContacts } from './contacts-api';
import { contactsToCsv, downloadContactsCsv, type ContactCsvLabels } from './export-contacts-csv';

vi.mock('./contacts-api', () => ({
  listContacts: vi.fn(),
}));

const labels: ContactCsvLabels = {
  name: 'Name',
  type: 'Type',
  email: 'Email',
  phone: 'Phone',
  status: 'Status',
  created: 'Created',
  person: 'Person',
  organization: 'Organization',
  active: 'Active',
  archived: 'Archived',
};

describe('contactsToCsv', () => {
  it('quotes commas and quotes and marks archived rows', () => {
    const csv = contactsToCsv(
      [
        contact({
          name: 'Արմեն, "Պրոյեկտ"',
          type: 'organization',
          email: 'contact@softproject.am',
          phone: '+374 11 234567',
          archivedAt: '2025-04-14T11:04:00.000Z',
        }),
      ],
      labels,
    );

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Արմեն, ""Պրոյեկտ"""');
    expect(csv).toContain('Organization');
    expect(csv).toContain('Archived');
    expect(csv).toContain('contact@softproject.am');
  });
});

describe('downloadContactsCsv', () => {
  it('rejects instead of saving a file when another page remains after the cap', async () => {
    vi.mocked(listContacts).mockResolvedValue({
      data: [contact({})],
      page: { nextCursor: 'next' },
    });

    await expect(
      downloadContactsCsv({ search: '', archived: false, sort: 'asc', limit: 50 }, labels),
    ).rejects.toMatchObject({ code: 'EXPORT_LIMIT', count: 20 });
  });
});

function contact(overrides: Partial<Contact>): Contact {
  return {
    id: '1',
    name: 'Աննա',
    type: 'person',
    email: null,
    phone: null,
    archivedAt: null,
    createdAt: '2026-10-02T08:43:50.000Z',
    updatedAt: '2026-10-02T08:43:50.000Z',
    createdByUserId: 'user',
    ownerUserId: 'user',
    ...overrides,
  };
}
