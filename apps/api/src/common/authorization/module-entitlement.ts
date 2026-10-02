import { Inject, Injectable } from '@nestjs/common';
import type { ModuleKey } from '@lobby/contracts';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../database/database.tokens';
import type { TenantId } from '../tenant/tenant-id';

/**
 * Module is off for this tenant.
 * The code is `MODULE_DISABLED`, not `FORBIDDEN`, so a client can tell a disabled
 * module from a role that lacks the permission. The message names neither.
 */
export class ModuleDisabledError extends Error {
  readonly code = 'MODULE_DISABLED' as const;

  constructor() {
    super('This module is not enabled.');
    this.name = 'ModuleDisabledError';
  }
}

/**
 * Tenant module gate. Call it before `requirePermission`.
 *
 * Standard order for a module use case:
 * `scopedTenantId(context)`, then `requireEnabled`, then `requirePermission`,
 * then the tenant-scoped write and any resource-scope rule.
 * User preference never belongs in this decision.
 */
@Injectable()
export class ModuleEntitlementService {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async requireEnabled(tenantId: TenantId, module: ModuleKey): Promise<void> {
    if (!(await this.isEnabled(tenantId, module))) {
      throw new ModuleDisabledError();
    }
  }

  /** True only for an `ENABLED` row at this tenant and module. Missing is disabled. */
  async isEnabled(tenantId: TenantId, module: ModuleKey): Promise<boolean> {
    if (tenantId.length === 0) {
      return false;
    }
    const row = await this.prisma.tenantModule.findUnique({
      where: {
        tenantId_moduleKey: {
          tenantId,
          moduleKey: module,
        },
      },
      select: { status: true },
    });
    return row?.status === 'ENABLED';
  }
}
