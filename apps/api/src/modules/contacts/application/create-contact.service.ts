import { Inject, Injectable } from '@nestjs/common';
import { contactCreatedEventSchema } from '@lobby/contracts';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/outbox';
import { OutboxService } from '../../../common/outbox/outbox.service';
import type { AuthenticatedTenantContext } from '../../../common/tenant/authenticated-tenant-context';
import { createContactSchema, type CreateContactInput } from '../dto/create-contact.schema';

const CONTACT_CREATED_EVENT_VERSION = 1;

@Injectable()
export class CreateContactService {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly outbox: OutboxService,
  ) {}

  async create(context: AuthenticatedTenantContext, input: CreateContactInput) {
    const name = createContactSchema.parse(input).name;

    return this.prisma.$transaction(async (tx) => {
      const contact = await tx.contact.create({
        data: {
          tenantId: context.tenantId,
          name,
        },
      });
      const event = contactCreatedEventSchema.parse({
        eventId: crypto.randomUUID(),
        eventType: 'contact.created',
        eventVersion: CONTACT_CREATED_EVENT_VERSION,
        tenantId: context.tenantId,
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
