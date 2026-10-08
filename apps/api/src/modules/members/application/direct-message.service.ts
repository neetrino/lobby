import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { DirectMessage, DirectMessagePage } from '@lobby/contracts';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { scopedTenantId } from '../../../common/auth/authorization';
import { requirePermission } from '../../../common/authorization/require-permission';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import { ValidationError } from '../../../common/http/validation-error';
import type { RequestContext } from '../../../common/tenant/request-context';
import { newerThan, olderThan, toForwardPage, toMessagePage } from './direct-message-page';
import type { DirectMessageListQuery, MessageCursor } from './direct-message-query';

type ConversationKey = { tenantId: string; userLowId: string; userHighId: string };

/** Private messages between the caller and one coworker in the same organization. */
@Injectable()
export class DirectMessageService {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async list(
    context: RequestContext,
    memberId: string,
    query: DirectMessageListQuery,
  ): Promise<DirectMessagePage> {
    const pair = await this.pair(context, memberId, 'team:read');
    this.requireCursorPeer(query, memberId);
    const conversation = await this.prisma.directConversation.findUnique({
      where: { tenantId_userLowId_userHighId: pair },
      select: { id: true },
    });
    if (conversation === null) {
      return { data: [], page: { nextCursor: null, syncCursor: null } };
    }
    return query.after === undefined
      ? this.messagesBefore(pair.tenantId, conversation.id, query, memberId)
      : this.messagesAfter(pair.tenantId, conversation.id, query.after, query.limit, memberId);
  }

  private async messagesBefore(
    tenantId: string,
    conversationId: string,
    query: DirectMessageListQuery,
    memberId: string,
  ): Promise<DirectMessagePage> {
    const messages = await this.prisma.directMessage.findMany({
      where: { tenantId, conversationId, ...olderThan(query.cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: { author: { select: { name: true } } },
    });
    const page = toMessagePage(messages, query.limit, memberId);
    if (query.cursor === undefined) {
      return page;
    }
    return { data: page.data, page: { nextCursor: page.page.nextCursor, syncCursor: null } };
  }

  private async messagesAfter(
    tenantId: string,
    conversationId: string,
    after: MessageCursor,
    limit: number,
    memberId: string,
  ): Promise<DirectMessagePage> {
    const messages = await this.prisma.directMessage.findMany({
      where: { tenantId, conversationId, ...newerThan(after) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      include: { author: { select: { name: true } } },
    });
    return toForwardPage(messages, limit, memberId);
  }

  async add(context: RequestContext, memberId: string, body: string): Promise<DirectMessage> {
    const pair = await this.pair(context, memberId, 'team:message');
    const conversation = await this.prisma.directConversation.upsert({
      where: { tenantId_userLowId_userHighId: pair },
      create: pair,
      update: {},
      select: { id: true },
    });
    const message = await this.prisma.directMessage.create({
      data: { tenantId: pair.tenantId, conversationId: conversation.id, authorUserId: context.userId, body },
      include: { author: { select: { name: true } } },
    });
    return {
      id: message.id,
      authorUserId: message.authorUserId,
      authorName: message.author.name,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private requireCursorPeer(query: DirectMessageListQuery, memberId: string): void {
    if (query.cursor !== undefined && query.cursor.memberId !== memberId) {
      throw new ValidationError([{ path: 'cursor' }]);
    }
    if (query.after !== undefined && query.after.memberId !== memberId) {
      throw new ValidationError([{ path: 'after' }]);
    }
  }

  private async pair(
    context: RequestContext,
    memberId: string,
    permission: 'team:read' | 'team:message',
  ): Promise<ConversationKey> {
    requirePermission(context, permission);
    if (memberId === context.userId) {
      throw new ValidationError([{ path: 'memberId' }]);
    }
    const tenantId = scopedTenantId(context);
    const peer = await this.prisma.user.findFirst({
      where: { id: memberId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (peer === null) {
      throw new NotFoundException();
    }
    const [userLowId, userHighId] = context.userId < memberId ? [context.userId, memberId] : [memberId, context.userId];
    return { tenantId, userLowId, userHighId };
  }
}
