import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import { PLATFORM_SUBDOMAIN } from '../../../common/platform/platform-subdomain';
import { PASSWORD_HASHER, type PasswordHasher } from '../../identity';
import { platformAdminSchema, type PlatformAdminInput } from './provision-organization.schema';

@Injectable()
export class PlatformAdminService {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
    @Inject(PASSWORD_HASHER) private readonly passwords: PasswordHasher,
  ) {}

  /**
   * Creates the reserved platform workspace and its only operator.
   * A second call leaves the existing operator unchanged.
   */
  async ensure(input: PlatformAdminInput): Promise<'created' | 'exists'> {
    const admin = platformAdminSchema.parse(input);
    const existing = await this.prisma.tenant.findUnique({
      where: { subdomain: PLATFORM_SUBDOMAIN },
      select: { id: true },
    });
    if (existing !== null) {
      return 'exists';
    }
    const passwordHash = await this.passwords.hash(admin.password);
    await this.prisma.tenant.create({
      data: {
        name: 'Lobby',
        subdomain: PLATFORM_SUBDOMAIN,
        plan: 'STARTER',
        users: {
          create: {
            name: admin.name,
            email: admin.email,
            passwordHash,
            status: 'ACTIVE',
            role: 'OWNER',
            authenticationVersion: 1,
          },
        },
      },
    });
    return 'created';
  }
}
