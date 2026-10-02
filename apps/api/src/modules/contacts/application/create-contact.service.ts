import { Injectable } from '@nestjs/common';

import { scopedTenantId } from '../../../common/auth/authorization';
import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import { requireResourceScope } from '../../../common/authorization/resource-scope';
import { requirePermission } from '../../../common/authorization/require-permission';
import { OutboxService } from '../../../common/outbox/outbox.service';
import type { RequestContext } from '../../../common/tenant/request-context';
import { ContactRepository, type ContactRecord } from '../infrastructure/contact.repository';
import { ContactEmailConflictError, isContactEmailConflict } from './contact-email-conflict.error';
import { duplicateWarnings, type ContactDuplicateWarning } from './contact-duplicate';
import { contactCreatedEvent } from './contact-events';
import { toStoredContactType } from './contact-fields';
import {
  createContactSchema,
  type CreateContactBody,
  type CreateContactInput,
} from './create-contact.schema';

export type CreateContactResult = {
  contact: ContactRecord;
  warnings: ContactDuplicateWarning[];
};

@Injectable()
export class CreateContactService {
  constructor(
    private readonly contacts: ContactRepository,
    private readonly outbox: OutboxService,
    private readonly entitlements: ModuleEntitlementService,
  ) {}

  async create(context: RequestContext, input: CreateContactInput): Promise<CreateContactResult> {
    const tenantId = scopedTenantId(context);
    await this.entitlements.requireEnabled(tenantId, 'contacts');
    requirePermission(context, 'contacts:create');
    const body = createContactSchema.parse(input);
    requireResourceScope(context, 'tenant', { tenantId });

    return this.contacts.forTenant(context).transaction(async (contacts, tx) => {
      const contact = await insertContact(contacts, context.userId, body);
      await this.outbox.enqueue(tx, contactCreatedEvent(tenantId, contact.id, contact.name));
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
}

async function insertContact(
  contacts: {
    create(input: {
      name: string;
      type: 'PERSON' | 'ORGANIZATION';
      email: string | null;
      phone: string | null;
      createdByUserId: string;
      ownerUserId: string;
    }): Promise<ContactRecord>;
  },
  userId: string,
  body: CreateContactBody,
): Promise<ContactRecord> {
  try {
    return await contacts.create({
      name: body.name,
      type: toStoredContactType(body.type),
      email: body.email ?? null,
      phone: body.phone ?? null,
      createdByUserId: userId,
      ownerUserId: userId,
    });
  } catch (error) {
    if (isContactEmailConflict(error)) {
      throw new ContactEmailConflictError();
    }
    throw error;
  }
}
