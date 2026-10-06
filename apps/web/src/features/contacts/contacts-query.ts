import type { ContactListFilters } from './contact';

const PAGE_LIMITS = [25, 50, 100] as const;
const SEARCH_MAX = 100;

export function contactsQueryString(filters: ContactListFilters): string {
  const params = new URLSearchParams();
  params.set('limit', String(filters.limit));
  params.set('sort', filters.sort);
  params.set('archived', filters.archived ? 'true' : 'false');
  const search = filters.search.trim().slice(0, SEARCH_MAX);
  if (search.length > 0) {
    params.set('search', search);
  }
  if (filters.type === 'person' || filters.type === 'organization') {
    params.set('type', filters.type);
  }
  if (isOwnerId(filters.owner)) {
    params.set('owner', filters.owner);
  }
  if (filters.cursor !== undefined && filters.cursor.length > 0) {
    params.set('cursor', filters.cursor);
  }
  return params.toString();
}

export function parseContactFilters(params: URLSearchParams): ContactListFilters {
  const limit = Number(params.get('limit'));
  const sort = params.get('sort');
  const search = params.get('search') ?? '';
  const cursor = params.get('cursor');
  const type = params.get('type');
  const owner = params.get('owner') ?? '';

  return {
    search: search.trim().slice(0, SEARCH_MAX),
    archived: params.get('archived') === 'true',
    sort: sort === 'desc' ? 'desc' : 'asc',
    limit: isPageLimit(limit) ? limit : 50,
    type: type === 'person' || type === 'organization' ? type : 'all',
    owner: isOwnerId(owner) ? owner : '',
    ...(cursor !== null && cursor.length > 0 ? { cursor } : {}),
  };
}

export function filtersWithoutCursor(filters: ContactListFilters): ContactListFilters {
  return {
    search: filters.search,
    archived: filters.archived,
    sort: filters.sort,
    limit: filters.limit,
    type: filters.type,
    owner: filters.owner,
  };
}

function isOwnerId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isPageLimit(value: number): value is ContactListFilters['limit'] {
  return PAGE_LIMITS.some((limit) => limit === value);
}
