import { Inject, Injectable } from '@nestjs/common';
import { CONTACT_CREATED_EVENT_VERSION, contactCreatedEventSchema } from '@lobby/contracts';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { scopedTenantId } from '../../../common/auth/authorization';
import { requireModule } from '../../../common/authorization/module-entitlement';
import { requireResourceScope } from '../../../common/authorization/resource-scope';
import { requirePermission } from '../../../common/authorization/require-permission';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import { OutboxService } from '../../../common/outbox/outbox.service';
import type { RequestContext } from '../../../common/tenant/request-context';
import { createContactSchema, type CreateContactInput } from './create-contact.schema';

@Injectable()
export class CreateContactService {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly outbox: OutboxService,
  ) {}

  async create(context: RequestContext, input: CreateContactInput) {
    requireModule(context, 'contacts');
    requirePermission(context, 'contacts:create');
    const name = createContactSchema.parse(input).name;
    const tenantId = scopedTenantId(context);
    requireResourceScope(context, 'tenant', { tenantId });

    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          tenantId,
          name,
        },
      });
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
