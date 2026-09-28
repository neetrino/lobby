import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/outbox';

export type SessionUserSecurity = {
  status: 'ACTIVE' | 'DISABLED';
  authenticationVersion: number;
};

/** Reads the live authentication version after a session write. */
export type SessionVersionReader = {
  findSecurity(userId: string, tenantId: string): Promise<SessionUserSecurity | null>;
};

@Injectable()
export class PrismaSessionUserStore {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  /** Loads the live user row for the session's own tenant. Redis is not enough. */
  async findSecurity(userId: string, tenantId: string): Promise<SessionUserSecurity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id_tenantId: { id: userId, tenantId } },
      select: { status: true, authenticationVersion: true },
    });
    if (user === null) {
      return null;
    }

    return { status: user.status, authenticationVersion: user.authenticationVersion };
  }

  /**
   * Bumps the version for one user inside the caller's tenant.
   * Returns null when that tenant has no such user. The update itself is atomic.
   */
  async incrementAuthenticationVersion(userId: string, tenantId: string): Promise<number | null> {
    try {
      const user = await this.prisma.user.update({
        where: { id_tenantId: { id: userId, tenantId } },
        data: { authenticationVersion: { increment: 1 } },
        select: { authenticationVersion: true },
      });
      return user.authenticationVersion;
    } catch (error) {
      if (isMissingRecord(error)) {
        return null;
      }
      throw error;
    }
  }
}

function isMissingRecord(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
}
