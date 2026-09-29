import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import type { RequestContext } from '../../../common/tenant/request-context';
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
    return this.findInTenant(context.tenantId, contactId);
  }

  async rename(
    context: RequestContext,
    contactId: string,
    input: RenameContactInput,
  ): Promise<ContactRecord | null> {
    const name = renameContactSchema.parse(input).name;
    const updated = await this.prisma.contact.updateMany({
      where: { id: contactId, tenantId: context.tenantId },
      data: { name },
    });
    if (updated.count !== 1) {
      return null;
    }
    return this.findInTenant(context.tenantId, contactId);
  }

  private findInTenant(tenantId: string, contactId: string): Promise<ContactRecord | null> {
    return this.prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      select: { id: true, tenantId: true, name: true },
    });
  }
}
