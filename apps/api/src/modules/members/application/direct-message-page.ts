import type { DirectMessage } from '@lobby/contracts';
import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };

import { encodeCursor } from '../../../common/pagination';
import type { MessageCursor } from './direct-message-query';

type StoredMessage = {
  id: string;
  authorUserId: string;
  body: string;
  createdAt: Date;
  author: { name: string };
};

/** Messages strictly newer than the cursor, using id when timestamps match. */
export function newerThan(cursor: MessageCursor): Prisma.DirectMessageWhereInput {
  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [{ createdAt: { gt: createdAt } }, { createdAt, id: { gt: cursor.id } }],
  };
}

/** Messages strictly older than the cursor, using id when timestamps match. */
export function olderThan(cursor: MessageCursor | undefined): Prisma.DirectMessageWhereInput {
  if (cursor === undefined) {
    return {};
  }
  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }],
  };
}

/**
 * One chat page. The query is newest-first; the response is oldest-first.
 * `nextCursor` asks for the page older than this one.
 */
export function toMessagePage(rows: readonly StoredMessage[], limit: number, memberId: string): MessageListPage {
  const visible = rows.slice(0, limit).reverse().map(toMessage);
  const oldest = visible[0];
  return {
    data: visible,
    page: {
      nextCursor:
        rows.length > limit && oldest !== undefined ? messageCursor(oldest, memberId) : null,
      syncCursor: messageCursor(visible.at(-1), memberId),
    },
  };
}

/**
 * One forward page. The query is oldest-first.
 * `nextCursor` asks for messages newer than this page.
 */
export function toForwardPage(rows: readonly StoredMessage[], limit: number, memberId: string): MessageListPage {
  const visible = rows.slice(0, limit).map(toMessage);
  const newest = visible.at(-1);
  return {
    data: visible,
    page: {
      nextCursor: rows.length > limit ? messageCursor(newest, memberId) : null,
      syncCursor: messageCursor(newest, memberId),
    },
  };
}

type MessageListPage = {
  data: DirectMessage[];
  page: { nextCursor: string | null; syncCursor: string | null };
};

function messageCursor(message: DirectMessage | undefined, memberId: string): string | null {
  if (message === undefined) {
    return null;
  }
  return encodeCursor({ createdAt: message.createdAt, id: message.id, memberId });
}

function toMessage(message: StoredMessage): DirectMessage {
  return {
    id: message.id,
    authorUserId: message.authorUserId,
    authorName: message.author.name,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}
