import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/database/database.tokens';

/** Credential row used only inside login. The password hash never leaves Identity. */
export type LoginAccount = {
  tenant: {
    id: string;
    name: string;
    subdomain: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: 'ACTIVE' | 'DISABLED';
    passwordHash: string;
    authenticationVersion: number;
  };
};

@Injectable()
export class PrismaLoginAccountStore {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  /**
   * Resolves the tenant by subdomain, then the user inside that tenant.
   * The same email may exist in another tenant and must not match.
   */
  async findBySubdomainAndEmail(subdomain: string, email: string): Promise<LoginAccount | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
      select: { id: true, name: true, subdomain: true },
    });
    if (tenant === null) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        passwordHash: true,
        authenticationVersion: true,
      },
    });
    if (user === null) {
      return null;
    }

    return { tenant, user };
  }
}
