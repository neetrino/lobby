import { Injectable } from '@nestjs/common';
import { auditActions } from '@lobby/contracts';

import { AuthorizationError, scopedTenantId } from '../../../common/auth/authorization';
import { AuditEventStore, type AuditWrite } from '../../../common/audit/audit-event.store';
import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import { canAccessResource } from '../../../common/authorization/resource-scope';
import { requirePermission } from '../../../common/authorization/require-permission';
import type { RequestContext } from '../../../common/tenant/request-context';
import { ContactRepository, type ContactRecord } from '../infrastructure/contact.repository';
import { canManageContactLifecycle } from './contact-lifecycle.policy';

@Injectable()
export class ContactLifecycleService {
  constructor(
    private readonly contacts: ContactRepository,
    private readonly audit: AuditEventStore,
    private readonly entitlements: ModuleEntitlementService,
  ) {}

  archive(context: RequestContext, contactId: string): Promise<ContactRecord | null> {
    return this.changeArchive(context, contactId, true);
  }

  restore(context: RequestContext, contactId: string): Promise<ContactRecord | null> {
    return this.changeArchive(context, contactId, false);
  }

  private async changeArchive(
    context: RequestContext,
    contactId: string,
    archive: boolean,
  ): Promise<ContactRecord | null> {
    const tenantId = scopedTenantId(context);
    await this.entitlements.requireEnabled(tenantId, 'contacts');
    requirePermission(context, 'contacts:update');
    const current = await this.visible(context, contactId);
    if (current === null) {
      return null;
    }
    if (!canManageContactLifecycle(context, current.ownerUserId)) {
      throw new AuthorizationError();
    }
    if (archive ? current.archivedAt !== null : current.archivedAt === null) {
      return current;
    }
    return this.writeArchive(context, contactId, archive);
  }

  private async writeArchive(
    context: RequestContext,
    contactId: string,
    archive: boolean,
  ): Promise<ContactRecord | null> {
    const archivedAt = archive ? new Date() : null;
    return this.contacts.forTenant(context).transaction(async (contacts, tx) => {
      const updated = await contacts.setArchived(contactId, archivedAt);
      if (updated !== 1) {
        return contacts.findById(contactId);
      }
      const contact = await contacts.findById(contactId);
      if (contact === null) {
        return null;
      }
      if (archive && contact.archivedAt !== null) {
        await this.audit.append(tx, lifecycleAudit(context, contact.id, 'contact.archived'));
      }
      if (!archive && contact.archivedAt === null) {
        await this.audit.append(tx, lifecycleAudit(context, contact.id, 'contact.restored'));
      }
      return contact;
    });
  }

  private async visible(context: RequestContext, contactId: string): Promise<ContactRecord | null> {
    const contact = await this.contacts.forTenant(context).findById(contactId);
    if (contact === null || !canAccessResource(context, 'tenant', contact)) {
      return null;
    }
    return contact;
  }
}

function lifecycleAudit(
  context: RequestContext,
  contactId: string,
  action: typeof auditActions.CONTACT_ARCHIVED | typeof auditActions.CONTACT_RESTORED,
): AuditWrite {
  return {
    tenantId: context.tenantId,
    actorUserId: context.userId,
    actorRole: context.role,
    actorType: 'USER',
    action,
    resourceType: 'contact',
    resourceId: contactId,
    outcome: 'SUCCESS',
    changes: null,
    reason: null,
    requestId: context.requestId,
    ipHash: null,
    userAgent: null,
  };
}
