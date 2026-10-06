import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import { tenantRoles, type TenantRole } from '../../../common/tenant/authenticated-tenant-context';

export type SessionUserSecurity = {
  status: 'ACTIVE' | 'DISABLED';
  role: TenantRole;
  authenticationVersion: number;
};

/** Fields that invalidate existing sessions. Each change increments the version. */
export type UserSecurityChange = {
  role?: TenantRole;
  status?: 'ACTIVE' | 'DISABLED';
  passwordHash?: string;
};

/** Reads the live authentication version after a session write. */
export type SessionVersionReader = {
  findSecurity(userId: string, tenantId: string): Promise<SessionUserSecurity | null>;
};

@Injectable()
export class PrismaSessionUserStore {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  /** Name and the caller's Leads preference. The session record itself does not store them. */
  async findAccount(
    userId: string,
    tenantId: string,
  ): Promise<{ name: string; leadsEnabled: boolean } | null> {
    return this.prisma.user.findUnique({
      where: { id_tenantId: { id: userId, tenantId } },
      select: { name: true, leadsEnabled: true },
    });
  }

  /** Turns Leads on or off for this account. Deal access is unchanged. */
  async setLeadsEnabled(userId: string, tenantId: string, enabled: boolean): Promise<boolean> {
    const updated = await this.prisma.user.updateMany({
      where: { id: userId, tenantId },
      data: { leadsEnabled: enabled },
    });
    return updated.count === 1;
  }

  /** Name shown in the workspace shell. The session record itself does not store it. */
  async findName(userId: string, tenantId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id_tenantId: { id: userId, tenantId } },
      select: { name: true },
    });
    return user?.name ?? null;
  }

  /** Loads the live user row for the session's own tenant. Redis is not enough. */
  async findSecurity(userId: string, tenantId: string): Promise<SessionUserSecurity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id_tenantId: { id: userId, tenantId } },
      select: { status: true, role: true, authenticationVersion: true },
    });
    if (user === null) {
      return null;
    }

    const role = tenantRoles.find((value) => value === user.role);
    if (role === undefined) {
      return null;
    }

    return { status: user.status, role, authenticationVersion: user.authenticationVersion };
  }

  /**
   * Changes role, status, or password and increments authenticationVersion together.
   * One update is atomic, so a session cannot keep the previous privilege.
   */
  async applySecurityChange(
    userId: string,
    tenantId: string,
    change: UserSecurityChange,
  ): Promise<number | null> {
    if (!hasSecurityChange(change)) {
      throw new Error('Role, status, or password must change with the authentication version.');
    }

    try {
      const user = await this.prisma.user.update({
        where: { id_tenantId: { id: userId, tenantId } },
        data: {
          role: change.role,
          status: change.status,
          passwordHash: change.passwordHash,
          authenticationVersion: { increment: 1 },
        },
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

  /**
   * Bumps the version for one user inside the caller's tenant.
   * Returns null when that tenant has no such user. The update itself is atomic.
   */
  async incrementAuthenticationVersion(
    userId: string,
    tenantId: string,
    db: PrismaClient | Prisma.TransactionClient = this.prisma,
  ): Promise<number | null> {
    try {
      const user = await db.user.update({
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

function hasSecurityChange(change: UserSecurityChange): boolean {
  return (
    change.role !== undefined || change.status !== undefined || change.passwordHash !== undefined
  );
}

function isMissingRecord(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
}
