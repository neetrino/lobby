import { Injectable } from '@nestjs/common';
import type { TenantPlan } from '@lobby/contracts';
import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };

import { planModules } from './plan-module-policy';

@Injectable()
export class PlanEntitlementGrant {
  /** Inserts the plan's default module rows on the caller's transaction. */
  async grant(tx: Prisma.TransactionClient, tenantId: string, plan: TenantPlan): Promise<void> {
    await tx.tenantModule.createMany({
      data: planModules[plan].map((moduleKey) => ({
        tenantId,
        moduleKey,
        status: 'ENABLED' as const,
      })),
    });
  }
}
