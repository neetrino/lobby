import { Injectable } from '@nestjs/common';

import { scopedTenantId } from '../auth/authorization';
import { requirePermission } from '../authorization/require-permission';
import type { RequestContext } from '../tenant/request-context';
import { AuditEventStore } from './audit-event.store';
import type { AuditEventPage } from './list-audit-events.query';
import type { AuditEventListQuery } from './list-audit-events.schema';

/** Tenant-scoped audit read. Owner and Admin pass `audit:read`. Audit is not a product module. */
@Injectable()
export class AuditAccessService {
  constructor(private readonly events: AuditEventStore) {}

  list(context: RequestContext, query: AuditEventListQuery): Promise<AuditEventPage> {
    requirePermission(context, 'audit:read');
    return this.events.list(scopedTenantId(context), query);
  }
}
