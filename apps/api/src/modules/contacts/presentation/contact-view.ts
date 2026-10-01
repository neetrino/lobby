import { toPublicContactType } from '../application/contact-fields';
import type { ContactDuplicateWarning } from '../application/contact-duplicate';
import type { ContactRecord } from '../infrastructure/contact.repository';

/** Public contact body. `tenantId` stays off the response. */
export type ContactView = {
  id: string;
  name: string;
  type: 'person' | 'organization';
  email: string | null;
  phone: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUserId: string;
  ownerUserId: string;
};

export type ContactResponse = {
  data: ContactView;
  warnings?: ContactDuplicateWarning[];
};

export function toContactView(contact: ContactRecord): ContactView {
  return {
    id: contact.id,
    name: contact.name,
    type: toPublicContactType(contact.type),
    email: contact.email,
    phone: contact.phone,
    archivedAt: contact.archivedAt === null ? null : contact.archivedAt.toISOString(),
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
    createdByUserId: contact.createdByUserId,
    ownerUserId: contact.ownerUserId,
  };
}

export function contactResponse(
  contact: ContactRecord,
  warnings: readonly ContactDuplicateWarning[],
): ContactResponse {
  const response: ContactResponse = { data: toContactView(contact) };
  if (warnings.length > 0) {
    response.warnings = [...warnings];
  }
  return response;
}
