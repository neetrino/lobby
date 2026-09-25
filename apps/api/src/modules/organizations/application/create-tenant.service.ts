import { Inject, Injectable } from '@nestjs/common';
import { tenantCreatedEventSchema } from '@lobby/contracts';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/outbox';
import { OutboxService } from '../../../common/outbox/outbox.service';
import { createTenantSchema, type CreateTenantInput } from '../dto/create-tenant.schema';

const TENANT_CREATED_EVENT_VERSION = 1;

@Injectable()
export class CreateTenantService {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly outbox: OutboxService,
  ) {}

  async create(input: CreateTenantInput) {
    const data = createTenantSchema.parse(input);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: data.name,
          subdomain: data.subdomain,
          plan: data.plan,
        },
      });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: data.user.name,
          email: data.user.email,
        },
      });
      const event = tenantCreatedEventSchema.parse({
        eventId: crypto.randomUUID(),
        eventType: 'tenant.created',
        eventVersion: TENANT_CREATED_EVENT_VERSION,
        tenantId: tenant.id,
        aggregateType: 'tenant',
        aggregateId: tenant.id,
        occurredAt: new Date().toISOString(),
        payload: {
          name: tenant.name,
          subdomain: tenant.subdomain,
          plan: tenant.plan,
          userId: user.id,
        },
      });
      await this.outbox.enqueue(tx, event);
      return { tenant, user };
    });
  }
}
