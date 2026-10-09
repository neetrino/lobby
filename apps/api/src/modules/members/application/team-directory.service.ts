import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { TeamDirectory, TeamMember } from '@lobby/contracts';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { scopedTenantId } from '../../../common/auth/authorization';
import { requirePermission } from '../../../common/authorization/require-permission';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import type { RequestContext } from '../../../common/tenant/request-context';

const memberSelect = { id: true, name: true, email: true, role: true, jobTitle: true } as const;

const ROLE_ORDER = { OWNER: 0, ADMIN: 1, MEMBER: 2 } as const;

/** Active people in the caller's organization. */
@Injectable()
export class TeamDirectoryService {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async list(context: RequestContext): Promise<TeamDirectory> {
    requirePermission(context, 'team:read');
    const tenantId = scopedTenantId(context);
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
    if (tenant === null) {
      throw new NotFoundException();
    }
    const users = await this.prisma.user.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: memberSelect,
    });
    return { organization: { name: tenant.name }, members: users.map(toMember).sort(byRoleThenName) };
  }

  async updateJobTitle(context: RequestContext, userId: string, jobTitle: string | null): Promise<TeamMember> {
    requirePermission(context, 'team:manage');
    const tenantId = scopedTenantId(context);
    const updated = await this.prisma.user.updateMany({
      where: { id: userId, tenantId, status: 'ACTIVE' },
      data: { jobTitle },
    });
    if (updated.count !== 1) {
      throw new NotFoundException();
    }
    return this.readMember(tenantId, userId);
  }

  private async readMember(tenantId: string, userId: string): Promise<TeamMember> {
    const member = await this.prisma.user.findFirst({ where: { id: userId, tenantId }, select: memberSelect });
    if (member === null) {
      throw new NotFoundException();
    }
    return toMember(member);
  }
}

function toMember(member: {
  id: string;
  name: string;
  email: string;
  role: TeamMember['role'];
  jobTitle: string | null;
}): TeamMember {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    jobTitle: member.jobTitle,
  };
}

function byRoleThenName(left: TeamMember, right: TeamMember): number {
  const roleGap = ROLE_ORDER[left.role] - ROLE_ORDER[right.role];
  return roleGap === 0 ? left.name.localeCompare(right.name) : roleGap;
}
