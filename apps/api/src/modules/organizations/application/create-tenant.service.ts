import { Inject, Injectable } from '@nestjs/common';
import { TENANT_CREATED_EVENT_VERSION, tenantCreatedEventSchema } from '@lobby/contracts';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/outbox';
import { OutboxService } from '../../../common/outbox/outbox.service';
import {
  createTenantWithOwnerSchema,
  type CreateTenantWithOwnerInput,
} from '../dto/create-tenant.schema';

@Injectable()
export class CreateTenantService {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Public operation for Auth. Writes the tenant, its owner, and the outbox event together.
   * Role and status are assigned here. Callers cannot choose them.
   */
  async createWithOwner(input: CreateTenantWithOwnerInput) {
    const data = createTenantWithOwnerSchema.parse(input);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: data.tenant.name,
          subdomain: data.tenant.subdomain,
          plan: 'STARTER',
        },
      });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: data.owner.name,
          email: data.owner.email,
          passwordHash: data.owner.passwordHash,
          status: 'ACTIVE',
          role: 'OWNER',
          authenticationVersion: 1,
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
          plan: data.tenant.plan,
          ownerUserId: user.id,
        },
      });
      await this.outbox.enqueue(tx, event);
      return { tenant, user };
    });
  }
}
