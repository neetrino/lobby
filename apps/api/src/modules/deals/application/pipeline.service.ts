import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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
import { createStatus, deleteStatus, updateStatus } from './pipeline-status';
import type {
  CardMessageCreate,
  CardNoteCreate,
  CardCreate,
  CardPatch,
  ColumnCreate,
  ColumnPatch,
  PipelinePatch,
  StatusCreate,
  StatusPatch,
} from './pipeline.schema';
import type { PipelineMessage, PipelineNote } from '@lobby/contracts';

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
    await this.gate(context, patch.name === undefined ? 'pipelines:resize' : 'pipelines:configure');
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
    await appendCard(this.prisma, tenantId, pipeline.id, input, context.userId);
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
    await convertLead(this.prisma, tenantId, cardId, context.userId, this.converted(context, cardId));
    return loadBoard(this.prisma, tenantId, pipeline.id, 'lead');
  }

  async addStatus(context: RequestContext, kind: PipelineKindName, input: StatusCreate): Promise<PipelineBoard> {
    await this.gate(context, 'pipelines:configure');
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await createStatus(this.prisma, tenantId, input);
    return loadBoard(this.prisma, tenantId, pipeline.id, kind);
  }

  async changeStatus(
    context: RequestContext,
    kind: PipelineKindName,
    statusId: string,
    patch: StatusPatch,
  ): Promise<PipelineBoard> {
    await this.gate(context, 'pipelines:configure');
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await updateStatus(this.prisma, tenantId, statusId, patch);
    return loadBoard(this.prisma, tenantId, pipeline.id, kind);
  }

  async removeStatus(context: RequestContext, kind: PipelineKindName, statusId: string): Promise<PipelineBoard> {
    await this.gate(context, 'pipelines:configure');
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await deleteStatus(this.prisma, tenantId, statusId);
    return loadBoard(this.prisma, tenantId, pipeline.id, kind);
  }

  async listMessages(
    context: RequestContext,
    kind: PipelineKindName,
    cardId: string,
  ): Promise<PipelineMessage[]> {
    await this.gate(context, cardPermission(kind, 'read'));
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await this.requireCard(tenantId, pipeline.id, cardId);
    const messages = await this.prisma.pipelineCardMessage.findMany({
      where: { tenantId, cardId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 200,
      include: { author: { select: { name: true } } },
    });
    return messages.map((message) => ({
      id: message.id,
      cardId: message.cardId,
      authorUserId: message.authorUserId,
      authorName: message.author.name,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    }));
  }

  async addMessage(
    context: RequestContext,
    kind: PipelineKindName,
    cardId: string,
    input: CardMessageCreate,
  ): Promise<PipelineMessage> {
    await this.gate(context, cardPermission(kind, 'update'));
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await this.requireCard(tenantId, pipeline.id, cardId);
    const message = await this.prisma.pipelineCardMessage.create({
      data: { tenantId, cardId, authorUserId: context.userId, body: input.body },
      include: { author: { select: { name: true } } },
    });
    return {
      id: message.id,
      cardId: message.cardId,
      authorUserId: message.authorUserId,
      authorName: message.author.name,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    };
  }

  async listNotes(context: RequestContext, kind: PipelineKindName, cardId: string): Promise<PipelineNote[]> {
    await this.gate(context, cardPermission(kind, 'read'));
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await this.requireCard(tenantId, pipeline.id, cardId);
    const notes = await this.prisma.pipelineCardNote.findMany({
      where: { tenantId, cardId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
      include: { author: { select: { name: true } } },
    });
    return notes.map((note) => ({
      id: note.id,
      cardId: note.cardId,
      authorUserId: note.authorUserId,
      authorName: note.author.name,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    }));
  }

  async addNote(
    context: RequestContext,
    kind: PipelineKindName,
    cardId: string,
    input: CardNoteCreate,
  ): Promise<PipelineNote> {
    await this.gate(context, cardPermission(kind, 'update'));
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await this.requireCard(tenantId, pipeline.id, cardId);
    const note = await this.prisma.pipelineCardNote.create({
      data: { tenantId, cardId, authorUserId: context.userId, body: input.body },
      include: { author: { select: { name: true } } },
    });
    return {
      id: note.id,
      cardId: note.cardId,
      authorUserId: note.authorUserId,
      authorName: note.author.name,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    };
  }

  async updateNote(
    context: RequestContext,
    kind: PipelineKindName,
    cardId: string,
    noteId: string,
    input: CardNoteCreate,
  ): Promise<PipelineNote> {
    await this.gate(context, cardPermission(kind, 'update'));
    const tenantId = scopedTenantId(context);
    const pipeline = await existingPipeline(this.prisma, tenantId, kind);
    await this.requireCard(tenantId, pipeline.id, cardId);
    const existing = await this.prisma.pipelineCardNote.findFirst({ where: { id: noteId, cardId, tenantId } });
    if (existing === null) throw new NotFoundException();
    const note = await this.prisma.pipelineCardNote.update({
      where: { id: noteId },
      data: { body: input.body, authorUserId: context.userId },
      include: { author: { select: { name: true } } },
    });
    return {
      id: note.id,
      cardId: note.cardId,
      authorUserId: note.authorUserId,
      authorName: note.author.name,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    };
  }

  private async requireCard(tenantId: ReturnType<typeof scopedTenantId>, pipelineId: string, cardId: string): Promise<void> {
    const card = await this.prisma.pipelineCard.findFirst({
      where: { id: cardId, tenantId, pipelineId },
      select: { id: true },
    });
    if (card === null) {
      throw new NotFoundException();
    }
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
    patch.ownerUserId !== undefined ||
    patch.statusId !== undefined ||
    patch.priority !== undefined
  );
}

function cardPermission(
  kind: PipelineKindName,
  action: 'create' | 'read' | 'update' | 'delete',
): Permission {
  return cardPermissions[kind][action];
}
