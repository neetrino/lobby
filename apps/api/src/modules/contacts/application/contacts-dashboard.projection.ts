import { Injectable } from '@nestjs/common';
import type { DashboardScope } from '@lobby/contracts';

import { scopedTenantId } from '../../../common/auth/authorization';
import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import { hasPermission } from '../../../common/authorization/require-permission';
import type { RequestContext } from '../../../common/tenant/request-context';
import { contactActivityDays, type ContactActivityDay } from '../domain/contact-activity-days';
import { ContactsDashboardQuery } from '../infrastructure/contacts-dashboard.query';

export type ContactDashboardActivity = {
  id: string;
  name: string;
  kind: 'created' | 'updated' | 'archived';
  occurredAt: string;
};

export type ContactsDashboardSlice = {
  updatedAt: string;
  activeCount: number;
  createdInRange: number;
  createdInPrevious: number;
  owned: Array<{ id: string; name: string; updatedAt: string }>;
  activity: ContactDashboardActivity[];
  days: ContactActivityDay[];
};

type Window = { from: Date; to: Date; previousFrom: Date };

/**
 * Read-only contact facts for the dashboard.
 * A disabled contacts module or a missing `contacts:read` permission returns null
 * so the dashboard hides the widget instead of answering with zeros.
 */
@Injectable()
export class ContactsDashboardProjection {
  constructor(
    private readonly entitlements: ModuleEntitlementService,
    private readonly facts: ContactsDashboardQuery,
  ) {}

  async project(
    context: RequestContext,
    scope: DashboardScope,
    window: Window,
  ): Promise<ContactsDashboardSlice | null> {
    if (!(await this.allowed(context))) {
      return null;
    }
    const facts = await this.facts.read(scopedTenantId(context), context.userId, scope, window);
    return {
      updatedAt: new Date().toISOString(),
      activeCount: facts.activeCount,
      createdInRange: facts.createdInRange,
      createdInPrevious: facts.createdInPrevious,
      owned: facts.owned.map((row) => ({
        id: row.id,
        name: row.name,
        updatedAt: row.updatedAt.toISOString(),
      })),
      activity: facts.recent.map((row) => ({
        id: row.id,
        name: row.name,
        kind: contactKind(row.createdAt, row.updatedAt, row.archivedAt),
        occurredAt: row.updatedAt.toISOString(),
      })),
      days: contactActivityDays(window.from, window.to, facts.stamps),
    };
  }

  /** Entitlement first, then permission. Either miss hides the widget. */
  private async allowed(context: RequestContext): Promise<boolean> {
    const enabled = await this.entitlements.isEnabled(scopedTenantId(context), 'contacts');
    return enabled && hasPermission(context.role, 'contacts:read');
  }
}

function contactKind(
  createdAt: Date,
  updatedAt: Date,
  archivedAt: Date | null,
): 'created' | 'updated' | 'archived' {
  if (archivedAt !== null) {
    return 'archived';
  }
  return updatedAt.getTime() - createdAt.getTime() < 1000 ? 'created' : 'updated';
}
