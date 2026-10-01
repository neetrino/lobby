import { Injectable } from '@nestjs/common';
import type { CursorPage } from '@lobby/contracts';

import { scopedTenantId } from '../../../common/auth/authorization';
import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import { canAccessResource } from '../../../common/authorization/resource-scope';
import { requirePermission } from '../../../common/authorization/require-permission';
import type { RequestContext } from '../../../common/tenant/request-context';
import { ContactRepository, type ContactRecord } from '../infrastructure/contact.repository';
import { ContactEmailConflictError, isContactEmailConflict } from './contact-email-conflict.error';
import { duplicateWarnings, type ContactDuplicateWarning } from './contact-duplicate';
import { toStoredContactType } from './contact-fields';
import type { ContactListQuery } from './list-contacts.schema';
import { toContactPage } from './list-contacts.query';
import { updateContactSchema, type UpdateContactInput } from './update-contact.schema';

export type { ContactRecord };

export type UpdateContactResult = {
  contact: ContactRecord;
  warnings: ContactDuplicateWarning[];
};

@Injectable()
export class ContactAccessService {
  constructor(
    private readonly contacts: ContactRepository,
    private readonly entitlements: ModuleEntitlementService,
  ) {}

  async read(context: RequestContext, contactId: string): Promise<ContactRecord | null> {
    const tenantId = scopedTenantId(context);
    await this.entitlements.requireEnabled(tenantId, 'contacts');
    requirePermission(context, 'contacts:read');
    return this.visibleContact(context, contactId);
  }

  async list(context: RequestContext, input: ContactListQuery): Promise<CursorPage<ContactRecord>> {
    const tenantId = scopedTenantId(context);
    await this.entitlements.requireEnabled(tenantId, 'contacts');
    requirePermission(context, 'contacts:read');
    const rows = await this.contacts.forTenant(context).list(input);
    return toContactPage(rows, input);
  }

  async update(
    context: RequestContext,
    contactId: string,
    input: UpdateContactInput,
  ): Promise<UpdateContactResult | null> {
    const tenantId = scopedTenantId(context);
    await this.entitlements.requireEnabled(tenantId, 'contacts');
    requirePermission(context, 'contacts:update');
    const body = updateContactSchema.parse(input);
    return this.contacts.forTenant(context).transaction(async (contacts) => {
      const updated = await writeUpdate(contacts, contactId, body);
      if (updated !== 1) {
        return null;
      }
      const contact = await contacts.findById(contactId);
      if (contact === null || !canAccessResource(context, 'tenant', contact)) {
        return null;
      }
      const warnings = duplicateWarnings(
        await contacts.findDuplicateIds({
          name: contact.name,
          phone: contact.phone,
          excludeId: contact.id,
        }),
      );
      return { contact, warnings };
    });
  }

  private async visibleContact(
    context: RequestContext,
    contactId: string,
  ): Promise<ContactRecord | null> {
    const contact = await this.contacts.forTenant(context).findById(contactId);
    if (contact === null || !canAccessResource(context, 'tenant', contact)) {
      return null;
    }
    return contact;
  }
}

async function writeUpdate(
  contacts: {
    update(
      id: string,
      input: {
        name?: string;
        type?: 'PERSON' | 'ORGANIZATION';
        email?: string | null;
        phone?: string | null;
      },
    ): Promise<number>;
  },
  contactId: string,
  body: UpdateContactInput,
): Promise<number> {
  try {
    return await contacts.update(contactId, {
      ...(body.name === undefined ? {} : { name: body.name }),
      ...(body.type === undefined ? {} : { type: toStoredContactType(body.type) }),
      ...(body.email === undefined ? {} : { email: body.email }),
      ...(body.phone === undefined ? {} : { phone: body.phone }),
    });
  } catch (error) {
    if (isContactEmailConflict(error)) {
      throw new ContactEmailConflictError();
    }
    throw error;
  }
}
