import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { scopedTenantId } from '../../../common/auth/authorization';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import type { RequestContext } from '../../../common/tenant/request-context';
import type { TenantId } from '../../../common/tenant/tenant-id';

export type ContactRecord = {
  id: string;
  tenantId: string;
  name: string;
};

type ContactDb = PrismaClient | Prisma.TransactionClient;

/** Contact reads and writes. This object cannot open a transaction. */
export type ContactOperations = {
  findById(id: string): Promise<ContactRecord | null>;
  rename(id: string, name: string): Promise<number>;
  create(name: string): Promise<ContactRecord>;
};

/**
 * Tenant-bound contact access returned by `ContactRepository.forTenant`.
 * The transaction callback receives `ContactOperations`, which has no `transaction` method.
 */
export type TenantContacts = ContactOperations & {
  transaction<T>(
    run: (contacts: ContactOperations, tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
};

class ContactQueries implements ContactOperations {
  constructor(
    private readonly db: ContactDb,
    protected readonly tenantId: TenantId,
  ) {}

  findById(id: string): Promise<ContactRecord | null> {
    return this.db.contact.findFirst({
      where: { id, tenantId: this.tenantId },
      select: { id: true, tenantId: true, name: true },
    });
  }

  async rename(id: string, name: string): Promise<number> {
    const updated = await this.db.contact.updateMany({
      where: { id, tenantId: this.tenantId },
      data: { name },
    });
    return updated.count;
  }

  create(name: string): Promise<ContactRecord> {
    return this.db.contact.create({
      data: { tenantId: this.tenantId, name },
      select: { id: true, tenantId: true, name: true },
    });
  }
}

class TenantContactScope extends ContactQueries implements TenantContacts {
  constructor(
    private readonly prisma: PrismaClient,
    tenantId: TenantId,
  ) {
    super(prisma, tenantId);
  }

  transaction<T>(
    run: (contacts: ContactOperations, tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction((tx) => run(new ContactQueries(tx, this.tenantId), tx));
  }
}

/** Opens a contact repository bound to the authenticated tenant. */
@Injectable()
export class ContactRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  /**
   * Binds every later contact query to `scopedTenantId(context)`.
   * The returned methods do not accept a tenant id.
   */
  forTenant(context: RequestContext): TenantContacts {
    const tenantId = scopedTenantId(context);
    return new TenantContactScope(this.prisma, tenantId);
  }
}
