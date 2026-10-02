import type { CursorPage } from '@lobby/contracts';
import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };

import { encodeContactCursor, type ContactListQuery } from './list-contacts.schema';

/** Extra predicates for one contact page. The repository adds the tenant id. */
export function contactListFilter(query: ContactListQuery): Prisma.ContactWhereInput {
  const filters: Prisma.ContactWhereInput[] = [
    { archivedAt: query.archived ? { not: null } : null },
  ];
  if (query.search !== undefined && query.search.length > 0) {
    filters.push({
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ],
    });
  }
  if (query.cursor !== undefined) {
    filters.push(cursorFilter(query.cursor.name, query.cursor.id, query.sort));
  }
  return { AND: filters };
}

/** Name direction. `id` keeps the page stable when names match. */
export function contactListOrder(
  sort: ContactListQuery['sort'],
): Prisma.ContactOrderByWithRelationInput[] {
  return [{ name: sort }, { id: sort }];
}

export function toContactPage<T extends { id: string; name: string }>(
  rows: readonly T[],
  query: ContactListQuery,
): CursorPage<T> {
  const visible = rows.slice(0, query.limit);
  const last = visible.at(-1);
  return {
    data: [...visible],
    page: {
      nextCursor:
        rows.length > query.limit && last !== undefined
          ? encodeContactCursor({ name: last.name, id: last.id }, query)
          : null,
    },
  };
}

function cursorFilter(
  name: string,
  id: string,
  sort: ContactListQuery['sort'],
): Prisma.ContactWhereInput {
  if (sort === 'asc') {
    return { OR: [{ name: { gt: name } }, { AND: [{ name }, { id: { gt: id } }] }] };
  }
  return { OR: [{ name: { lt: name } }, { AND: [{ name }, { id: { lt: id } }] }] };
}
