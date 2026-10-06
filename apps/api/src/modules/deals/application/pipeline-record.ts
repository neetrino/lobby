import { randomUUID } from 'node:crypto';
import {
  PIPELINE_CHANGED_EVENT_VERSION,
  pipelineChangedEventSchema,
  type PipelineChangedEvent,
} from '@lobby/contracts';

import { AuditEventStore, type AuditWrite } from '../../../common/audit/audit-event.store';
import { OutboxService } from '../../../common/outbox/outbox.service';
import type { RequestContext } from '../../../common/tenant/request-context';
import type { AfterWrite } from './pipeline-board';
import type { PipelineKindName } from './pipeline-defaults';

type PipelineAction =
  | 'pipeline.configured'
  | 'pipeline.card.deleted'
  | 'pipeline.card.updated'
  | 'deal.stage.changed'
  | 'lead.stage.changed'
  | 'lead.converted';

type PipelineTrace = {
  action: PipelineAction;
  resourceType: 'pipeline' | 'lead' | 'deal';
  resourceId: string;
  kind: PipelineKindName;
  change: PipelineChangedEvent['payload']['change'];
};

/** Writes the audit row and the board-change event on the caller's transaction. */
export function pipelineTrace(
  audit: AuditEventStore,
  outbox: OutboxService,
  context: RequestContext,
  trace: PipelineTrace,
): AfterWrite {
  return async (tx) => {
    await audit.append(tx, auditRow(context, trace));
    await outbox.enqueue(tx, changedEvent(context.tenantId, trace));
  };
}

function auditRow(context: RequestContext, trace: PipelineTrace): AuditWrite {
  return {
    tenantId: context.tenantId,
    actorUserId: context.userId,
    actorRole: context.role,
    actorType: 'USER',
    action: trace.action,
    resourceType: trace.resourceType,
    resourceId: trace.resourceId,
    outcome: 'SUCCESS',
    changes: null,
    reason: null,
    requestId: context.requestId,
    ipHash: null,
    userAgent: null,
  };
}

function changedEvent(tenantId: string, trace: PipelineTrace): PipelineChangedEvent {
  return pipelineChangedEventSchema.parse({
    eventId: randomUUID(),
    eventType: 'pipeline.changed',
    eventVersion: PIPELINE_CHANGED_EVENT_VERSION,
    tenantId,
    aggregateType: 'pipeline',
    aggregateId: trace.resourceId,
    occurredAt: new Date().toISOString(),
    payload: { kind: trace.kind, change: trace.change },
  });
}
