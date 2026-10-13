import type { Contact, ContactWarning } from './contact';

/** Active rows on the current page that share a name or phone with another active row. */
export function duplicateNotices(rows: readonly Contact[]): ContactWarning[] {
  const active = rows.filter((row) => row.archivedAt === null);
  const ids = new Set<string>();
  for (const row of active) {
    if (active.some((other) => other.id !== row.id && sameContact(row, other))) {
      ids.add(row.id);
    }
  }
  return [...ids].map((contactId) => ({ code: 'POSSIBLE_DUPLICATE', contactId }));
}

/** Other active contacts on this page that share a name or phone with `contact`. */
export function duplicatePeers(contact: Contact, rows: readonly Contact[]): Contact[] {
  if (contact.archivedAt !== null) {
    return [];
  }
  return rows.filter(
    (row) => row.id !== contact.id && row.archivedAt === null && sameContact(contact, row),
  );
}

function sameContact(left: Contact, right: Contact): boolean {
  return sameName(left.name, right.name) || samePhone(left.phone, right.phone);
}

function sameName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

function samePhone(left: string | null, right: string | null): boolean {
  const first = left?.trim() ?? '';
  const second = right?.trim() ?? '';
  return first.length > 0 && first === second;
}
