import { Controller, Get } from '@nestjs/common';

import { CurrentRequest } from '../auth/current-request';
import { Authorize } from '../authorization/permission.guard';
import { ZodQuery } from '../pipes/zod-input';
import type { RequestContext } from '../tenant/request-context';
import { AuditAccessService } from './audit-access.service';
import type { AuditEventPage } from './list-audit-events.query';
import { auditEventListQuerySchema, type AuditEventListQuery } from './list-audit-events.schema';

@Controller('audit-events')
export class AuditEventsController {
  constructor(private readonly access: AuditAccessService) {}

  @Get()
  @Authorize('audit:read')
  list(
    @CurrentRequest() context: RequestContext,
    @ZodQuery(auditEventListQuerySchema) query: AuditEventListQuery,
  ): Promise<AuditEventPage> {
    return this.access.list(context, query);
  }
}
