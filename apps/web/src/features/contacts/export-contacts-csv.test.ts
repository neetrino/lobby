import { describe, expect, it } from 'vitest';

import type { Contact } from './contact';
import { contactsToCsv, type ContactCsvLabels } from './export-contacts-csv';

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
