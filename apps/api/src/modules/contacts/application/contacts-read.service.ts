import { Injectable } from '@nestjs/common';

import { scopedTenantId } from '../../../common/auth/authorization';
import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import { requirePermission } from '../../../common/authorization/require-permission';
import { ValidationError } from '../../../common/http/validation-error';
import type { RequestContext } from '../../../common/tenant/request-context';
import { ContactRepository } from '../infrastructure/contact.repository';

/** Public identity other modules may store. Email and phone are not included. */
export type ContactSummary = {
  id: string;
  name: string;
};

const MAX_CONTACT_SUMMARIES = 100;

/**
 * Synchronous read door for other modules.
 * Callers pass their own request context. They do not query `prisma.contact`.
 * The door checks the caller's tenant, the contacts entitlement, and `contacts:read`
 * before it returns a name. Resource scope is the tenant-bound repository.
 * A missing row and a row in another tenant are both absent.
 * An archived contact still exists, so related deals can keep their reference.
 */
@Injectable()
export class ContactsReadService {
  constructor(
    private readonly contacts: ContactRepository,
    private readonly entitlements: ModuleEntitlementService,
  ) {}

  async exists(context: RequestContext, contactId: string): Promise<boolean> {
    const summary = await this.getSummary(context, contactId);
    return summary !== null;
  }

  async getSummary(context: RequestContext, contactId: string): Promise<ContactSummary | null> {
    await this.authorize(context);
    const contact = await this.contacts.forTenant(context).findById(contactId);
    if (contact === null) {
      return null;
    }
    return { id: contact.id, name: contact.name };
  }

  async getSummaries(
    context: RequestContext,
    contactIds: readonly string[],
  ): Promise<Map<string, ContactSummary>> {
    await this.authorize(context);
    if (contactIds.length > MAX_CONTACT_SUMMARIES) {
      throw new ValidationError([{ path: 'ids' }]);
    }
    const uniqueIds = [...new Set(contactIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const rows = await this.contacts.forTenant(context).findSummaries(uniqueIds);
    return new Map(rows.map((row) => [row.id, { id: row.id, name: row.name }]));
  }

  /** Tenant, entitlement, then `contacts:read`. The repository supplies tenant scope. */
  private async authorize(context: RequestContext): Promise<void> {
    await this.entitlements.requireEnabled(scopedTenantId(context), 'contacts');
    requirePermission(context, 'contacts:read');
  }
}
