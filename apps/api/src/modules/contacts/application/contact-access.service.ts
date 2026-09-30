import { Injectable } from '@nestjs/common';

import { scopedTenantId } from '../../../common/auth/authorization';
import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import { canAccessResource } from '../../../common/authorization/resource-scope';
import { requirePermission } from '../../../common/authorization/require-permission';
import type { RequestContext } from '../../../common/tenant/request-context';
import { ContactRepository, type ContactRecord } from '../infrastructure/contact.repository';
import { renameContactSchema, type RenameContactInput } from './rename-contact.schema';

export type { ContactRecord };

@Injectable()
export class ContactAccessService {
  constructor(
    private readonly contacts: ContactRepository,
    private readonly entitlements: ModuleEntitlementService,
  ) {}

  async read(context: RequestContext, contactId: string): Promise<ContactRecord | null> {
    const tenantId = scopedTenantId(context);
    await this.entitlements.requireEnabled(tenantId, 'contacts');
    requirePermission(context, 'contacts:read');
    return this.visibleContact(context, contactId);
  }

  async rename(
    context: RequestContext,
    contactId: string,
    input: RenameContactInput,
  ): Promise<ContactRecord | null> {
    const tenantId = scopedTenantId(context);
    await this.entitlements.requireEnabled(tenantId, 'contacts');
    requirePermission(context, 'contacts:update');
    const name = renameContactSchema.parse(input).name;
    const updated = await this.contacts.forTenant(context).rename(contactId, name);
    if (updated !== 1) {
      return null;
    }
    return this.visibleContact(context, contactId);
  }

  private async visibleContact(
    context: RequestContext,
    contactId: string,
  ): Promise<ContactRecord | null> {
    const contact = await this.contacts.forTenant(context).findById(contactId);
    if (contact === null || !canAccessResource(context, 'tenant', contact)) {
      return null;
    }
    return contact;
  }
}
