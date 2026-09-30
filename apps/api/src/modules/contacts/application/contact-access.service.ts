import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { scopedTenantId } from '../../../common/auth/authorization';
import { canAccessResource } from '../../../common/authorization/resource-scope';
import { requirePermission } from '../../../common/authorization/require-permission';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import type { RequestContext } from '../../../common/tenant/request-context';
import type { TenantId } from '../../../common/tenant/tenant-id';
import { renameContactSchema, type RenameContactInput } from './rename-contact.schema';

export type ContactRecord = {
  id: string;
  tenantId: string;
  name: string;
};

@Injectable()
export class ContactAccessService {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  read(context: RequestContext, contactId: string): Promise<ContactRecord | null> {
    requirePermission(context, 'contacts:read');
    return this.visibleContact(context, contactId);
  }

  async rename(
    context: RequestContext,
    contactId: string,
    input: RenameContactInput,
  ): Promise<ContactRecord | null> {
    requirePermission(context, 'contacts:update');
    const name = renameContactSchema.parse(input).name;
    const existing = await this.visibleContact(context, contactId);
    if (existing === null) {
      return null;
    }
    const tenantId = scopedTenantId(context);
    const updated = await this.prisma.contact.updateMany({
      where: { id: contactId, tenantId },
      data: { name },
    });
    if (updated.count !== 1) {
      return null;
    }
    return this.visibleContact(context, contactId);
  }

  private async visibleContact(
    context: RequestContext,
    contactId: string,
  ): Promise<ContactRecord | null> {
    const contact = await this.findInTenant(scopedTenantId(context), contactId);
    if (contact === null || !canAccessResource(context, 'tenant', contact)) {
      return null;
    }
    return contact;
  }

  private findInTenant(tenantId: TenantId, contactId: string): Promise<ContactRecord | null> {
    return this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, tenantId: true, name: true },
    });
  }
}
