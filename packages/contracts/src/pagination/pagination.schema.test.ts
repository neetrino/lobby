import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, pageLimitSchema, sortDirectionSchema } from './index.js';

const page = z.strictObject({ limit: pageLimitSchema });

describe('pagination primitives', () => {
  it('defaults the page size to 50 and rejects a size outside 1..100', () => {
    expect(page.parse({}).limit).toBe(DEFAULT_PAGE_LIMIT);
    expect(page.parse({ limit: '100' }).limit).toBe(MAX_PAGE_LIMIT);
    expect(page.safeParse({ limit: '0' }).success).toBe(false);
    expect(page.safeParse({ limit: '101' }).success).toBe(false);
    expect(page.safeParse({ limit: '1.5' }).success).toBe(false);
  });

  it('accepts only asc and desc', () => {
    expect(sortDirectionSchema.parse('asc')).toBe('asc');
    expect(sortDirectionSchema.parse('desc')).toBe('desc');
    expect(sortDirectionSchema.safeParse('occurredAt').success).toBe(false);
  });
});
