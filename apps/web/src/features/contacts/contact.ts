export type ContactType = 'person' | 'organization';

export type Contact = {
  id: string;
  name: string;
  type: ContactType;
  email: string | null;
  phone: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  ownerUserId: string;
};

export type ContactDraft = {
  name: string;
  type: ContactType;
  email: string;
  phone: string;
};

export type ContactWarning = {
  code: 'POSSIBLE_DUPLICATE';
  contactId: string;
};

export type SessionPrincipal = {
  user: { id: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' };
  tenant: { id: string };
};

export type ContactListFilters = {
  search: string;
  archived: boolean;
  sort: 'asc' | 'desc';
  limit: 25 | 50 | 100;
  cursor?: string;
};

export const EMPTY_DRAFT: ContactDraft = {
  name: '',
  type: 'person',
  email: '',
  phone: '',
};

export function draftFromContact(contact: Contact): ContactDraft {
  return {
    name: contact.name,
    type: contact.type,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
  };
}

/** Owner, admin, or the row owner may archive and restore. */
export function canManageLifecycle(session: SessionPrincipal, contact: Contact): boolean {
  if (session.user.role === 'OWNER' || session.user.role === 'ADMIN') {
    return true;
  }
  return session.user.id === contact.ownerUserId;
}
