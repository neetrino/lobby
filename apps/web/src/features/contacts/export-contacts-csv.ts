import type { Contact, ContactListFilters } from './contact';
import { listContacts } from './contacts-api';
import { contactsQueryString } from './contacts-query';

const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_PAGES = 20;

export type ContactCsvLabels = {
  name: string;
  type: string;
  email: string;
  phone: string;
  status: string;
  created: string;
  person: string;
  organization: string;
  active: string;
  archived: string;
};

/** Downloads the contacts that match the current search, archive filter, and sort. */
export async function downloadContactsCsv(
  filters: ContactListFilters,
  labels: ContactCsvLabels,
): Promise<number> {
  const rows = await collectContacts(filters);
  saveCsvFile(
    contactsToCsv(rows, labels),
    filters.archived ? 'contacts-archived.csv' : 'contacts.csv',
  );
  return rows.length;
}

export function contactsToCsv(rows: readonly Contact[], labels: ContactCsvLabels): string {
  const header = [
    labels.name,
    labels.type,
    labels.email,
    labels.phone,
    labels.status,
    labels.created,
  ];
  const lines = [header.map(csvCell).join(',')];
  for (const contact of rows) {
    lines.push(
      [
        contact.name,
        contact.type === 'organization' ? labels.organization : labels.person,
        contact.email ?? '',
        contact.phone ?? '',
        contact.archivedAt === null ? labels.active : labels.archived,
        contact.createdAt,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `\uFEFF${lines.join('\r\n')}`;
}

async function collectContacts(filters: ContactListFilters): Promise<Contact[]> {
  const rows: Contact[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < EXPORT_MAX_PAGES; page += 1) {
    const pageFilters: ContactListFilters = {
      search: filters.search,
      archived: filters.archived,
      sort: filters.sort,
      limit: EXPORT_PAGE_SIZE,
      ...(cursor === undefined ? {} : { cursor }),
    };
    const result = await listContacts(contactsQueryString(pageFilters));
    rows.push(...result.data);
    if (result.page.nextCursor === null) {
      return rows;
    }
    cursor = result.page.nextCursor;
  }
  return rows;
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function saveCsvFile(csv: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
