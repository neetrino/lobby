import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { scopedTenantId } from '../../../common/auth/authorization';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import type { RequestContext } from '../../../common/tenant/request-context';
import type { TenantId } from '../../../common/tenant/tenant-id';
import { contactListFilter, contactListOrder } from '../application/list-contacts.query';
import type { ContactListQuery } from '../application/list-contacts.schema';

export type StoredContactType = 'PERSON' | 'ORGANIZATION';

export type ContactRecord = {
  id: string;
  tenantId: string;
  name: string;
  type: StoredContactType;
  email: string | null;
  phone: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
  ownerUserId: string;
  ownerName: string;
};

export type ContactCreateInput = {
  name: string;
  type: StoredContactType;
  email: string | null;
  phone: string | null;
  createdByUserId: string;
  ownerUserId: string;
};

export type ContactUpdateInput = {
  name?: string;
  type?: StoredContactType;
  email?: string | null;
  phone?: string | null;
};

export type ContactDuplicateProbe = {
  name: string;
  phone: string | null;
  excludeId: string | null;
};

const contactSelect = {
  id: true,
  tenantId: true,
  name: true,
  type: true,
  email: true,
  phone: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  createdByUserId: true,
  ownerUserId: true,
  owner: { select: { name: true } },
} as const;

type ContactRow = Prisma.ContactGetPayload<{ select: typeof contactSelect }>;

type ContactDb = PrismaClient | Prisma.TransactionClient;

/** Contact reads and writes. This object cannot open a transaction. */
export type ContactOperations = {
  findById(id: string): Promise<ContactRecord | null>;
  findSummaries(ids: readonly string[]): Promise<Array<{ id: string; name: string }>>;
  list(query: ContactListQuery): Promise<ContactRecord[]>;
  countActive(): Promise<number>;
  findDuplicateIds(probe: ContactDuplicateProbe): Promise<string[]>;
  update(id: string, input: ContactUpdateInput): Promise<number>;
  setArchived(id: string, archivedAt: Date | null): Promise<number>;
  create(input: ContactCreateInput): Promise<ContactRecord>;
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

  async findById(id: string): Promise<ContactRecord | null> {
    const row = await this.db.contact.findFirst({
      where: { id, tenantId: this.tenantId },
      select: contactSelect,
    });
    return row === null ? null : toContactRecord(row);
  }

  findSummaries(ids: readonly string[]): Promise<Array<{ id: string; name: string }>> {
    return this.db.contact.findMany({
      where: { tenantId: this.tenantId, id: { in: [...ids] } },
      select: { id: true, name: true },
    });
  }

  async list(query: ContactListQuery): Promise<ContactRecord[]> {
    const rows = await this.db.contact.findMany({
      where: { tenantId: this.tenantId, ...contactListFilter(query) },
      orderBy: contactListOrder(query.sort),
      take: query.limit + 1,
      select: contactSelect,
    });
    return rows.map(toContactRecord);
  }

  countActive(): Promise<number> {
    return this.db.contact.count({
      where: { tenantId: this.tenantId, archivedAt: null },
    });
  }

  async findDuplicateIds(probe: ContactDuplicateProbe): Promise<string[]> {
    const matches = await this.db.contact.findMany({
      where: {
        tenantId: this.tenantId,
        archivedAt: null,
        ...(probe.excludeId === null ? {} : { id: { not: probe.excludeId } }),
        OR: duplicateMatch(probe),
      },
      select: { id: true },
      take: 5,
    });
    return matches.map((match) => match.id);
  }

  async update(id: string, input: ContactUpdateInput): Promise<number> {
    const updated = await this.db.contact.updateMany({
      where: { id, tenantId: this.tenantId },
      data: input,
    });
    return updated.count;
  }

  async setArchived(id: string, archivedAt: Date | null): Promise<number> {
    const updated = await this.db.contact.updateMany({
      where: {
        id,
        tenantId: this.tenantId,
        archivedAt: archivedAt === null ? { not: null } : null,
      },
      data: { archivedAt },
    });
    return updated.count;
  }

  async create(input: ContactCreateInput): Promise<ContactRecord> {
    const row = await this.db.contact.create({
      data: {
        tenantId: this.tenantId,
        name: input.name,
        type: input.type,
        email: input.email,
        phone: input.phone,
        createdByUserId: input.createdByUserId,
        ownerUserId: input.ownerUserId,
      },
      select: contactSelect,
    });
    return toContactRecord(row);
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

function toContactRecord(row: ContactRow): ContactRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    type: row.type,
    email: row.email,
    phone: row.phone,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByUserId: row.createdByUserId,
    ownerUserId: row.ownerUserId,
    ownerName: row.owner.name,
  };
}

function duplicateMatch(probe: ContactDuplicateProbe): Prisma.ContactWhereInput[] {
  const matches: Prisma.ContactWhereInput[] = [
    { name: { equals: probe.name, mode: 'insensitive' } },
  ];
  if (probe.phone !== null) {
    matches.push({ phone: probe.phone });
  }
  return matches;
}
