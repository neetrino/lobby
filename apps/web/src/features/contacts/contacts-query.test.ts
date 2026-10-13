import { describe, expect, it } from 'vitest';

import { contactsQueryString, parseContactFilters } from './contacts-query';

describe('contacts query', () => {
  it('encodes the list the API accepts', () => {
    const query = contactsQueryString({
      search: '  Աննա  ',
      archived: false,
      sort: 'asc',
      limit: 50,
      type: 'person',
      owner: '11111111-1111-4111-8111-111111111111',
    });

    const params = new URLSearchParams(query);
    expect(params.get('limit')).toBe('50');
    expect(params.get('sort')).toBe('asc');
    expect(params.get('archived')).toBe('false');
    expect(params.get('search')).toBe('Աննա');
    expect(params.get('type')).toBe('person');
    expect(params.get('owner')).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('keeps a cursor and drops a blank search', () => {
    const query = contactsQueryString({
      search: '   ',
      archived: true,
      sort: 'desc',
      limit: 25,
      type: 'all',
      owner: '',
      cursor: 'opaque',
    });

    expect(new URLSearchParams(query).get('cursor')).toBe('opaque');
    expect(new URLSearchParams(query).has('search')).toBe(false);
    expect(new URLSearchParams(query).has('type')).toBe(false);
    expect(new URLSearchParams(query).has('owner')).toBe(false);
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
      type: 'all',
      owner: '',
      cursor: 'abc',
    });
  });
});
