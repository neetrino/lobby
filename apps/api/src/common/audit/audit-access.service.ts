import { Injectable } from '@nestjs/common';

import { scopedTenantId } from '../auth/authorization';
import { requirePermission } from '../authorization/require-permission';
import type { RequestContext } from '../tenant/request-context';
import { AuditEventStore } from './audit-event.store';

/** Tenant-scoped audit read. Owner and Admin pass `audit:read`. */
@Injectable()
export class AuditAccessService {
  constructor(private readonly events: AuditEventStore) {}

  list(context: RequestContext) {
    requirePermission(context, 'audit:read');
    return this.events.list(scopedTenantId(context));
  }
}
