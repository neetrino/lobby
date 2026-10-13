import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { scopedTenantId } from '../../../common/auth/authorization';
import { hasPermission } from '../../../common/authorization/require-permission';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import type { RequestContext } from '../../../common/tenant/request-context';
import type { TenantId } from '../../../common/tenant/tenant-id';
import {
  invitationActivityDays,
  type InvitationActivityDay,
} from '../domain/invitation-activity-days';

export type MembersDashboardSlice = {
  accepted: Array<{ id: string; email: string; occurredAt: string }>;
  days: InvitationActivityDay[];
};

/**
 * Accepted invitations for the dashboard activity feed.
 * Hidden unless the caller may invite members. Token hashes are not read.
 */
@Injectable()
export class MembersDashboardProjection {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async project(
    context: RequestContext,
    window: { from: Date; to: Date },
  ): Promise<MembersDashboardSlice | null> {
    if (!hasPermission(context.role, 'members:invite')) {
      return null;
    }
    const tenantId = scopedTenantId(context);
    const [accepted, stamps] = await Promise.all([
      this.accepted(tenantId, window),
      this.stamps(tenantId, window),
    ]);
    return { accepted, days: invitationActivityDays(window.from, window.to, stamps) };
  }

  private async accepted(tenantId: TenantId, window: { from: Date; to: Date }) {
    const rows = await this.prisma.memberInvitation.findMany({
      where: { tenantId, acceptedAt: { gte: window.from, lt: window.to } },
      orderBy: { acceptedAt: 'desc' },
      take: 5,
      select: { id: true, email: true, acceptedAt: true },
    });
    return rows.flatMap((row) =>
      row.acceptedAt === null
        ? []
        : [{ id: row.id, email: row.email, occurredAt: row.acceptedAt.toISOString() }],
    );
  }

  private stamps(tenantId: TenantId, window: { from: Date; to: Date }) {
    return this.prisma.memberInvitation.findMany({
      where: {
        tenantId,
        OR: [
          { createdAt: { gte: window.from, lt: window.to } },
          { acceptedAt: { gte: window.from, lt: window.to } },
        ],
      },
      select: { createdAt: true, acceptedAt: true },
    });
  }
}
