import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { scopedTenantId } from '../../../common/auth/authorization';
import { AuditEventStore } from '../../../common/audit/audit-event.store';
import { ModuleEntitlementService } from '../../../common/authorization/module-entitlement';
import type { Permission } from '../../../common/authorization/role-permissions';
import { requirePermission } from '../../../common/authorization/require-permission';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import { OutboxService } from '../../../common/outbox/outbox.service';
import type { RequestContext } from '../../../common/tenant/request-context';
import { LeadsDisabledError } from './leads-disabled.error';
import type { PipelineKindName } from './pipeline-defaults';
import {
  appendCard,
  appendColumn,
  convertLead,
  deleteCard,
  deleteColumn,
  existingPipeline,
  loadBoard,
  patchCard,
  patchColumn,
  renamePipeline,
  type AfterWrite,
  type PipelineBoard,
} from './pipeline-board';
import { pipelineTrace } from './pipeline-record';
import type { CardCreate, CardPatch, ColumnCreate, ColumnPatch, PipelinePatch } from './pipeline.schema';

export type { PipelineBoard };

@Injectable()
export class PipelineService {
  constructor(
    private readonly entitlements: ModuleEntitlementService,
    private readonly audit: AuditEventStore,
    private readonly outbox: OutboxService,
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async read(context: RequestContext, kind: PipelineKindName): Promise<PipelineBoard> {
    await this.gate(context, cardPermission(kind, 'read'));
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    return loadBoard(this.prisma, tenantId, pipeline.id, kind);
  }

  async rename(context: RequestContext, kind: PipelineKindName, patch: PipelinePatch): Promise<PipelineBoard> {
    await this.gate(context, 'pipelines:configure');
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await renamePipeline(this.prisma, pipeline.id, patch, this.configured(context, kind, pipeline.id));
    return loadBoard(this.prisma, tenantId, pipeline.id, kind);
  }

  async addColumn(context: RequestContext, kind: PipelineKindName, input: ColumnCreate): Promise<PipelineBoard> {
    await this.gate(context, 'pipelines:configure');
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await appendColumn(this.prisma, tenantId, pipeline.id, input.name, this.configured(context, kind, pipeline.id));
    return loadBoard(this.prisma, tenantId, pipeline.id, kind);
  }

  async updateColumn(
    context: RequestContext,
    kind: PipelineKindName,
    columnId: string,
    patch: ColumnPatch,
  ): Promise<PipelineBoard> {
    await this.gate(context, 'pipelines:configure');
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await patchColumn(this.prisma, tenantId, pipeline.id, columnId, patch, this.configured(context, kind, pipeline.id));
    return loadBoard(this.prisma, tenantId, pipeline.id, kind);
  }

  async removeColumn(context: RequestContext, kind: PipelineKindName, columnId: string): Promise<PipelineBoard> {
    await this.gate(context, 'pipelines:configure');
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await deleteColumn(this.prisma, tenantId, pipeline.id, columnId, this.configured(context, kind, pipeline.id));
    return loadBoard(this.prisma, tenantId, pipeline.id, kind);
  }

  async addCard(context: RequestContext, kind: PipelineKindName, input: CardCreate): Promise<PipelineBoard> {
    await this.gate(context, cardPermission(kind, 'create'));
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await appendCard(this.prisma, tenantId, pipeline.id, input);
    return loadBoard(this.prisma, tenantId, pipeline.id, kind);
  }

  async updateCard(
    context: RequestContext,
    kind: PipelineKindName,
    cardId: string,
    patch: CardPatch,
  ): Promise<PipelineBoard> {
    await this.gate(context, cardPermission(kind, 'update'));
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await patchCard(
      this.prisma,
      tenantId,
      pipeline.id,
      cardId,
      patch,
      this.fieldChange(context, kind, cardId, patch),
      this.stageChange(context, kind, cardId),
    );
    return loadBoard(this.prisma, tenantId, pipeline.id, kind);
  }

  async removeCard(context: RequestContext, kind: PipelineKindName, cardId: string): Promise<PipelineBoard> {
    await this.gate(context, cardPermission(kind, 'delete'));
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await deleteCard(this.prisma, tenantId, pipeline.id, cardId, this.removed(context, kind, cardId));
    return loadBoard(this.prisma, tenantId, pipeline.id, kind);
  }

  async convert(context: RequestContext, cardId: string): Promise<PipelineBoard> {
    await this.gate(context, 'leads:update');
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, 'lead');
    await convertLead(this.prisma, tenantId, cardId, this.converted(context, cardId));
    return loadBoard(this.prisma, tenantId, pipeline.id, 'lead');
  }

  private async gate(context: RequestContext, permission: Permission): Promise<void> {
    const tenantId = scopedTenantId(context);
    await this.entitlements.requireEnabled(tenantId, 'deals');
    requirePermission(context, permission);
    if (permission.startsWith('leads:')) {
      await this.requireLeads(context, tenantId);
    }
  }

  private async requireLeads(context: RequestContext, tenantId: ReturnType<typeof scopedTenantId>): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id_tenantId: { id: context.userId, tenantId } },
      select: { leadsEnabled: true },
    });
    if (user === null || !user.leadsEnabled) {
      throw new LeadsDisabledError();
    }
  }

  private configured(context: RequestContext, kind: PipelineKindName, pipelineId: string): AfterWrite {
    return pipelineTrace(this.audit, this.outbox, context, {
      action: 'pipeline.configured',
      resourceType: 'pipeline',
      resourceId: pipelineId,
      kind,
      change: 'configured',
    });
  }

  private removed(context: RequestContext, kind: PipelineKindName, cardId: string): AfterWrite {
    return pipelineTrace(this.audit, this.outbox, context, {
      action: 'pipeline.card.deleted',
      resourceType: kind,
      resourceId: cardId,
      kind,
      change: 'deleted',
    });
  }

  /** Called by patchCard only after it has seen that the card left its column. */
  private stageChange(context: RequestContext, kind: PipelineKindName, cardId: string): AfterWrite {
    return pipelineTrace(this.audit, this.outbox, context, {
      action: kind === 'lead' ? 'lead.stage.changed' : 'deal.stage.changed',
      resourceType: kind,
      resourceId: cardId,
      kind,
      change: 'moved',
    });
  }

  private fieldChange(
    context: RequestContext,
    kind: PipelineKindName,
    cardId: string,
    patch: CardPatch,
  ): AfterWrite | undefined {
    if (!tracksCardFields(patch)) {
      return undefined;
    }
    return pipelineTrace(this.audit, this.outbox, context, {
      action: 'pipeline.card.updated',
      resourceType: kind,
      resourceId: cardId,
      kind,
      change: 'updated',
    });
  }

  private converted(context: RequestContext, cardId: string): AfterWrite {
    return pipelineTrace(this.audit, this.outbox, context, {
      action: 'lead.converted',
      resourceType: 'lead',
      resourceId: cardId,
      kind: 'lead',
      change: 'converted',
    });
  }
}

const cardPermissions = {
  lead: {
    create: 'leads:create',
    read: 'leads:read',
    update: 'leads:update',
    delete: 'leads:delete',
  },
  deal: {
    create: 'deals:create',
    read: 'deals:read',
    update: 'deals:update',
    delete: 'deals:delete',
  },
} as const satisfies Record<PipelineKindName, Record<'create' | 'read' | 'update' | 'delete', Permission>>;

function tracksCardFields(patch: CardPatch): boolean {
  return (
    patch.amount !== undefined ||
    patch.outcome !== undefined ||
    patch.contactId !== undefined ||
    patch.ownerUserId !== undefined
  );
}

function cardPermission(
  kind: PipelineKindName,
  action: 'create' | 'read' | 'update' | 'delete',
): Permission {
  return cardPermissions[kind][action];
}
