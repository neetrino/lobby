import { Controller, Get, HttpCode, Patch, Post, Req } from '@nestjs/common';

import { CurrentRequest } from '../../../common/auth/current-request';
import { Authorize } from '../../../common/authorization/permission.guard';
import { ZodBody, ZodParam, ZodQuery } from '../../../common/pipes/zod-input';
import { readClientAddress } from '../../../common/security/client-address';
import type { RequestContext } from '../../../common/tenant/request-context';
import { AuthRateLimitService } from '../../identity';
import { DirectMessageService } from '../application/direct-message.service';
import {
  directMessageListQuerySchema,
  type DirectMessageListQuery,
} from '../application/direct-message-query';
import { TeamDirectoryService } from '../application/team-directory.service';
import {
  directMessageBodySchema,
  jobTitlePatchSchema,
  teamMemberIdSchema,
  type DirectMessageBody,
  type JobTitlePatch,
} from './dto/team.schema';

@Controller('team')
export class TeamController {
  constructor(
    private readonly directory: TeamDirectoryService,
    private readonly messages: DirectMessageService,
    private readonly rates: AuthRateLimitService,
  ) {}

  @Get()
  @Authorize('team:read')
  async list(@CurrentRequest() context: RequestContext) {
    return { data: await this.directory.list(context) };
  }

  @Patch('members/:userId')
  @Authorize('team:manage')
  async updateJobTitle(
    @CurrentRequest() context: RequestContext,
    @ZodParam('userId', teamMemberIdSchema) userId: string,
    @ZodBody(jobTitlePatchSchema) body: JobTitlePatch,
  ) {
    return { data: await this.directory.updateJobTitle(context, userId, body.jobTitle) };
  }

  @Get('members/:userId/messages')
  @Authorize('team:read')
  async listMessages(
    @CurrentRequest() context: RequestContext,
    @ZodParam('userId', teamMemberIdSchema) userId: string,
    @ZodQuery(directMessageListQuerySchema) query: DirectMessageListQuery,
  ) {
    return this.messages.list(context, userId, query);
  }

  @Post('members/:userId/messages')
  @Authorize('team:message')
  @HttpCode(201)
  async addMessage(
    @CurrentRequest() context: RequestContext,
    @ZodParam('userId', teamMemberIdSchema) userId: string,
    @ZodBody(directMessageBodySchema) body: DirectMessageBody,
    @Req() request: { ip?: string; socket?: { remoteAddress?: string } },
  ) {
    await this.rates.consumeTeamMessage(readClientAddress(request), context.tenantId, context.userId);
    return { data: await this.messages.add(context, userId, body.body) };
  }
}
