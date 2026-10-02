import { describe, expect, it } from 'vitest';

import { contactsQueryString, parseContactFilters } from './contacts-query';

describe('contacts query', () => {
  it('encodes the list the API accepts', () => {
    const query = contactsQueryString({
      search: '  Աննա  ',
      archived: false,
      sort: 'asc',
      limit: 50,
    });

    const params = new URLSearchParams(query);
    expect(params.get('limit')).toBe('50');
    expect(params.get('sort')).toBe('asc');
    expect(params.get('archived')).toBe('false');
    expect(params.get('search')).toBe('Աննա');
  });

  it('keeps a cursor and drops a blank search', () => {
    const query = contactsQueryString({
      search: '   ',
      archived: true,
      sort: 'desc',
      limit: 25,
      cursor: 'opaque',
    });

    expect(new URLSearchParams(query).get('cursor')).toBe('opaque');
    expect(new URLSearchParams(query).has('search')).toBe(false);
    expect(new URLSearchParams(query).get('archived')).toBe('true');
  });

  it('reads shareable filters and ignores an unknown page size', () => {
    const filters = parseContactFilters(
      new URLSearchParams('search=Ada&archived=true&sort=desc&limit=15&cursor=abc'),
    );

    expect(filters).toEqual({
      search: 'Ada',
      archived: true,
      sort: 'desc',
      limit: 50,
      cursor: 'abc',
    });
  });
});
