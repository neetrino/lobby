import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import { PLATFORM_SUBDOMAIN } from '../../../common/platform/platform-subdomain';
import { CreateTenantService } from '../../organizations';
import { IdentityError, identityErrorCodes, PASSWORD_HASHER, type PasswordHasher } from '../../identity';
import {
  provisionOrganizationSchema,
  type ProvisionOrganizationInput,
} from './provision-organization.schema';

export type ProvisionedOrganization = {
  name: string;
  subdomain: string;
  ownerEmail: string;
};

export type ListedOrganization = ProvisionedOrganization & { createdAt: string };

const uniqueConflictSchema = z.object({ code: z.literal('P2002') });

@Injectable()
export class ProvisionOrganizationService {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    private readonly tenants: CreateTenantService,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
  ) {}

  async list(): Promise<ListedOrganization[]> {
    const rows = await this.prisma.tenant.findMany({
      where: { subdomain: { not: PLATFORM_SUBDOMAIN } },
      orderBy: { createdAt: 'desc' },
      select: {
        name: true,
        subdomain: true,
        createdAt: true,
        users: { where: { role: 'OWNER' }, select: { email: true }, take: 1 },
      },
    });
    return rows.map((row) => ({
      name: row.name,
      subdomain: row.subdomain,
      ownerEmail: row.users[0]?.email ?? '',
      createdAt: row.createdAt.toISOString(),
    }));
  }

  /** Opens a customer workspace and its first owner. The caller is not added to it. */
  async create(input: ProvisionOrganizationInput): Promise<ProvisionedOrganization> {
    const data = provisionOrganizationSchema.parse(input);
    if (data.tenant.subdomain === PLATFORM_SUBDOMAIN) {
      throw new IdentityError(identityErrorCodes.TENANT_SUBDOMAIN_TAKEN);
    }
    const passwordHash = await this.passwords.hash(data.owner.password);
    try {
      const created = await this.tenants.createWithOwner({
        tenant: { name: data.tenant.name, subdomain: data.tenant.subdomain, plan: 'starter' },
        owner: { name: data.owner.name, email: data.owner.email, passwordHash },
      });
      return {
        name: created.tenant.name,
        subdomain: created.tenant.subdomain,
        ownerEmail: created.user.email,
      };
    } catch (error) {
      if (uniqueConflictSchema.safeParse(error).success) {
        throw new IdentityError(identityErrorCodes.TENANT_SUBDOMAIN_TAKEN);
      }
      throw error;
    }
  }
}
