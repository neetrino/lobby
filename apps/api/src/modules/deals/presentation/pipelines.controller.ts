import { Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { z } from 'zod';

import { CurrentRequest } from '../../../common/auth/current-request';
import { Authorize } from '../../../common/authorization/permission.guard';
import { ZodBody, ZodParam } from '../../../common/pipes/zod-input';
import type { RequestContext } from '../../../common/tenant/request-context';
import type { PipelineKindName } from '../application/pipeline-defaults';
import { PipelineService, type PipelineBoard } from '../application/pipeline.service';
import {
  cardCreateSchema,
  cardMessageCreateSchema,
  cardNoteCreateSchema,
  cardPatchSchema,
  columnCreateSchema,
  columnPatchSchema,
  pipelineKindSchema,
  pipelinePatchSchema,
  statusCreateSchema,
  statusPatchSchema,
  type CardCreate,
  type CardMessageCreate,
  type CardNoteCreate,
  type CardPatch,
  type ColumnCreate,
  type ColumnPatch,
  type PipelinePatch,
  type StatusCreate,
  type StatusPatch,
} from '../application/pipeline.schema';
import type { PipelineMessage, PipelineNote } from '@lobby/contracts';

const idSchema = z.uuid();

@Controller('pipelines')
export class PipelinesController {
  constructor(private readonly pipelines: PipelineService) {}

  @Get('lead')
  @Authorize('leads:read')
  readLead(@CurrentRequest() context: RequestContext): Promise<{ data: PipelineBoard }> {
    return this.read(context, 'lead');
  }

  @Get('deal')
  @Authorize('deals:read')
  readDeal(@CurrentRequest() context: RequestContext): Promise<{ data: PipelineBoard }> {
    return this.read(context, 'deal');
  }

  @Patch(':kind')
  @Authorize('pipelines:configure')
  async rename(
    @CurrentRequest() context: RequestContext,
    @ZodParam('kind', pipelineKindSchema) kind: PipelineKindName,
    @ZodBody(pipelinePatchSchema) body: PipelinePatch,
  ): Promise<{ data: PipelineBoard }> {
    return { data: await this.pipelines.rename(context, kind, body) };
  }

  @Post(':kind/columns')
  @Authorize('pipelines:add-column')
  @HttpCode(201)
  async addColumn(
    @CurrentRequest() context: RequestContext,
    @ZodParam('kind', pipelineKindSchema) kind: PipelineKindName,
    @ZodBody(columnCreateSchema) body: ColumnCreate,
  ): Promise<{ data: PipelineBoard }> {
    return { data: await this.pipelines.addColumn(context, kind, body) };
  }

  @Patch(':kind/columns/:columnId')
  @Authorize('pipelines:resize')
  async updateColumn(
    @CurrentRequest() context: RequestContext,
    @ZodParam('kind', pipelineKindSchema) kind: PipelineKindName,
    @ZodParam('columnId', idSchema) columnId: string,
    @ZodBody(columnPatchSchema) body: ColumnPatch,
  ): Promise<{ data: PipelineBoard }> {
    return { data: await this.pipelines.updateColumn(context, kind, columnId, body) };
  }

  @Delete(':kind/columns/:columnId')
  @Authorize('pipelines:configure')
  async removeColumn(
    @CurrentRequest() context: RequestContext,
    @ZodParam('kind', pipelineKindSchema) kind: PipelineKindName,
    @ZodParam('columnId', idSchema) columnId: string,
  ): Promise<{ data: PipelineBoard }> {
    return { data: await this.pipelines.removeColumn(context, kind, columnId) };
  }

  @Post(':kind/statuses')
  @Authorize('pipelines:configure')
  @HttpCode(201)
  async addStatus(
    @CurrentRequest() context: RequestContext,
    @ZodParam('kind', pipelineKindSchema) kind: PipelineKindName,
    @ZodBody(statusCreateSchema) body: StatusCreate,
  ): Promise<{ data: PipelineBoard }> {
    return { data: await this.pipelines.addStatus(context, kind, body) };
  }

  @Patch(':kind/statuses/:statusId')
  @Authorize('pipelines:configure')
  async changeStatus(
    @CurrentRequest() context: RequestContext,
    @ZodParam('kind', pipelineKindSchema) kind: PipelineKindName,
    @ZodParam('statusId', idSchema) statusId: string,
    @ZodBody(statusPatchSchema) body: StatusPatch,
  ): Promise<{ data: PipelineBoard }> {
    return { data: await this.pipelines.changeStatus(context, kind, statusId, body) };
  }

  @Delete(':kind/statuses/:statusId')
  @Authorize('pipelines:configure')
  async removeStatus(
    @CurrentRequest() context: RequestContext,
    @ZodParam('kind', pipelineKindSchema) kind: PipelineKindName,
    @ZodParam('statusId', idSchema) statusId: string,
  ): Promise<{ data: PipelineBoard }> {
    return { data: await this.pipelines.removeStatus(context, kind, statusId) };
  }

  @Post('lead/cards')
  @Authorize('leads:create')
  @HttpCode(201)
  addLeadCard(
    @CurrentRequest() context: RequestContext,
    @ZodBody(cardCreateSchema) body: CardCreate,
  ): Promise<{ data: PipelineBoard }> {
    return this.addCard(context, 'lead', body);
  }

  @Post('deal/cards')
  @Authorize('deals:create')
  @HttpCode(201)
  addDealCard(
    @CurrentRequest() context: RequestContext,
    @ZodBody(cardCreateSchema) body: CardCreate,
  ): Promise<{ data: PipelineBoard }> {
    return this.addCard(context, 'deal', body);
  }

  @Patch('lead/cards/:cardId')
  @Authorize('leads:update')
  updateLeadCard(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
    @ZodBody(cardPatchSchema) body: CardPatch,
  ): Promise<{ data: PipelineBoard }> {
    return this.updateCard(context, 'lead', cardId, body);
  }

  @Patch('deal/cards/:cardId')
  @Authorize('deals:update')
  updateDealCard(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
    @ZodBody(cardPatchSchema) body: CardPatch,
  ): Promise<{ data: PipelineBoard }> {
    return this.updateCard(context, 'deal', cardId, body);
  }

  @Delete('lead/cards/:cardId')
  @Authorize('leads:delete')
  removeLeadCard(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
  ): Promise<{ data: PipelineBoard }> {
    return this.removeCard(context, 'lead', cardId);
  }

  @Post('lead/cards/:cardId/convert')
  @Authorize('leads:update')
  @HttpCode(201)
  async convertLead(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
  ): Promise<{ data: PipelineBoard }> {
    return { data: await this.pipelines.convert(context, cardId) };
  }

  @Delete('deal/cards/:cardId')
  @Authorize('deals:delete')
  removeDealCard(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
  ): Promise<{ data: PipelineBoard }> {
    return this.removeCard(context, 'deal', cardId);
  }

  @Get('lead/cards/:cardId/messages')
  @Authorize('leads:read')
  async listLeadMessages(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
  ): Promise<{ data: PipelineMessage[] }> {
    return { data: await this.pipelines.listMessages(context, 'lead', cardId) };
  }

  @Post('lead/cards/:cardId/messages')
  @Authorize('leads:update')
  @HttpCode(201)
  async addLeadMessage(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
    @ZodBody(cardMessageCreateSchema) body: CardMessageCreate,
  ): Promise<{ data: PipelineMessage }> {
    return { data: await this.pipelines.addMessage(context, 'lead', cardId, body) };
  }

  @Get('deal/cards/:cardId/messages')
  @Authorize('deals:read')
  async listDealMessages(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
  ): Promise<{ data: PipelineMessage[] }> {
    return { data: await this.pipelines.listMessages(context, 'deal', cardId) };
  }

  @Post('deal/cards/:cardId/messages')
  @Authorize('deals:update')
  @HttpCode(201)
  async addDealMessage(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
    @ZodBody(cardMessageCreateSchema) body: CardMessageCreate,
  ): Promise<{ data: PipelineMessage }> {
    return { data: await this.pipelines.addMessage(context, 'deal', cardId, body) };
  }

  @Get('lead/cards/:cardId/notes')
  @Authorize('leads:read')
  async listLeadNotes(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
  ): Promise<{ data: PipelineNote[] }> {
    return { data: await this.pipelines.listNotes(context, 'lead', cardId) };
  }

  @Post('lead/cards/:cardId/notes')
  @Authorize('leads:update')
  @HttpCode(201)
  async addLeadNote(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
    @ZodBody(cardNoteCreateSchema) body: CardNoteCreate,
  ): Promise<{ data: PipelineNote }> {
    return { data: await this.pipelines.addNote(context, 'lead', cardId, body) };
  }

  @Get('deal/cards/:cardId/notes')
  @Authorize('deals:read')
  async listDealNotes(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
  ): Promise<{ data: PipelineNote[] }> {
    return { data: await this.pipelines.listNotes(context, 'deal', cardId) };
  }

  @Post('deal/cards/:cardId/notes')
  @Authorize('deals:update')
  @HttpCode(201)
  async addDealNote(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
    @ZodBody(cardNoteCreateSchema) body: CardNoteCreate,
  ): Promise<{ data: PipelineNote }> {
    return { data: await this.pipelines.addNote(context, 'deal', cardId, body) };
  }

  @Patch('lead/cards/:cardId/notes/:noteId')
  @Authorize('leads:update')
  async updateLeadNote(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
    @ZodParam('noteId', idSchema) noteId: string,
    @ZodBody(cardNoteCreateSchema) body: CardNoteCreate,
  ): Promise<{ data: PipelineNote }> {
    return { data: await this.pipelines.updateNote(context, 'lead', cardId, noteId, body) };
  }

  @Patch('deal/cards/:cardId/notes/:noteId')
  @Authorize('deals:update')
  async updateDealNote(
    @CurrentRequest() context: RequestContext,
    @ZodParam('cardId', idSchema) cardId: string,
    @ZodParam('noteId', idSchema) noteId: string,
    @ZodBody(cardNoteCreateSchema) body: CardNoteCreate,
  ): Promise<{ data: PipelineNote }> {
    return { data: await this.pipelines.updateNote(context, 'deal', cardId, noteId, body) };
  }

  private async read(context: RequestContext, kind: PipelineKindName): Promise<{ data: PipelineBoard }> {
    return { data: await this.pipelines.read(context, kind) };
  }

  private async addCard(
    context: RequestContext,
    kind: PipelineKindName,
    body: CardCreate,
  ): Promise<{ data: PipelineBoard }> {
    return { data: await this.pipelines.addCard(context, kind, body) };
  }

  private async updateCard(
    context: RequestContext,
    kind: PipelineKindName,
    cardId: string,
    body: CardPatch,
  ): Promise<{ data: PipelineBoard }> {
    return { data: await this.pipelines.updateCard(context, kind, cardId, body) };
  }

  private async removeCard(
    context: RequestContext,
    kind: PipelineKindName,
    cardId: string,
  ): Promise<{ data: PipelineBoard }> {
    return { data: await this.pipelines.removeCard(context, kind, cardId) };
  }
}
