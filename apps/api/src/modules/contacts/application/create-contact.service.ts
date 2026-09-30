import { Injectable } from '@nestjs/common';
import { CONTACT_CREATED_EVENT_VERSION, contactCreatedEventSchema } from '@lobby/contracts';

import { scopedTenantId } from '../../../common/auth/authorization';
import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import { requireResourceScope } from '../../../common/authorization/resource-scope';
import { requirePermission } from '../../../common/authorization/require-permission';
import { OutboxService } from '../../../common/outbox/outbox.service';
import type { RequestContext } from '../../../common/tenant/request-context';
import { ContactRepository } from '../infrastructure/contact.repository';
import { createContactSchema, type CreateContactInput } from './create-contact.schema';

@Injectable()
export class CreateContactService {
  constructor(
    private readonly contacts: ContactRepository,
    private readonly outbox: OutboxService,
    private readonly entitlements: ModuleEntitlementService,
  ) {}

  async create(context: RequestContext, input: CreateContactInput) {
    const tenantId = scopedTenantId(context);
    await this.entitlements.requireEnabled(tenantId, 'contacts');
    requirePermission(context, 'contacts:create');
    const name = createContactSchema.parse(input).name;
    requireResourceScope(context, 'tenant', { tenantId });

    return this.contacts.forTenant(context).transaction(async (contacts, tx) => {
      const contact = await contacts.create(name);
      const event = contactCreatedEventSchema.parse({
        eventId: crypto.randomUUID(),
        eventType: 'contact.created',
        eventVersion: CONTACT_CREATED_EVENT_VERSION,
        tenantId,
        aggregateType: 'contact',
        aggregateId: contact.id,
        occurredAt: new Date().toISOString(),
        payload: { name: contact.name },
      });
      await this.outbox.enqueue(tx, event);
      return contact;
    });
  }
}
