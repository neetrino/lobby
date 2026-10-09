import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };
import type { DashboardScope } from '@lobby/contracts';

import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import type { TenantId } from '../../../common/tenant/tenant-id';

export type ContactDashboardRow = {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type ContactActivityStamp = {
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
};

export type ContactDashboardFacts = {
  activeCount: number;
  createdInRange: number;
  createdInPrevious: number;
  owned: ContactDashboardRow[];
  recent: ContactDashboardRow[];
  stamps: ContactActivityStamp[];
};

type Window = { from: Date; to: Date; previousFrom: Date };

/** Tenant-scoped contact counts and labels. Email and phone are not selected. */
@Injectable()
export class ContactsDashboardQuery {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async read(
    tenantId: TenantId,
    userId: string,
    scope: DashboardScope,
    window: Window,
  ): Promise<ContactDashboardFacts> {
    const owner = scope === 'mine' ? { ownerUserId: userId } : {};
    const [activeCount, createdInRange, createdInPrevious, owned, recent, stamps] = await Promise.all([
      this.prisma.contact.count({ where: { tenantId, archivedAt: null, ...owner } }),
      this.prisma.contact.count({ where: { tenantId, ...owner, createdAt: { gte: window.from, lt: window.to } } }),
      this.prisma.contact.count({
        where: { tenantId, ...owner, createdAt: { gte: window.previousFrom, lt: window.from } },
      }),
      this.owned(tenantId, userId),
      this.recent(tenantId, owner),
      this.stamps(tenantId, owner, window),
    ]);
    return { activeCount, createdInRange, createdInPrevious, owned, recent, stamps };
  }

  private owned(tenantId: TenantId, userId: string): Promise<ContactDashboardRow[]> {
    return this.prisma.contact.findMany({
      where: { tenantId, ownerUserId: userId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: contactLabel,
    });
  }

  private stamps(
    tenantId: TenantId,
    owner: { ownerUserId?: string },
    window: Window,
  ): Promise<ContactActivityStamp[]> {
    return this.prisma.contact.findMany({
      where: {
        tenantId,
        ...owner,
        OR: [
          { createdAt: { gte: window.from, lt: window.to } },
          { updatedAt: { gte: window.from, lt: window.to } },
          { archivedAt: { gte: window.from, lt: window.to } },
        ],
      },
      select: { createdAt: true, updatedAt: true, archivedAt: true },
    });
  }

  private recent(
    tenantId: TenantId,
    owner: { ownerUserId?: string },
  ): Promise<ContactDashboardRow[]> {
    return this.prisma.contact.findMany({
      where: { tenantId, ...owner },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: contactLabel,
    });
  }
}

const contactLabel = {
  id: true,
  name: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
} as const;
