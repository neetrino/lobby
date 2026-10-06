import { describe, expect, it } from 'vitest';

import { PIPELINE_AMOUNT_MAX, cardCreateSchema } from './pipeline.schema';

const columnId = '00000000-0000-4000-8000-000000000001';

describe('pipeline schemas', () => {
  it('keeps the amount inside the PostgreSQL integer range', () => {
    const accepted = cardCreateSchema.safeParse({ columnId, title: 'Ada', amount: PIPELINE_AMOUNT_MAX });
    const rejected = cardCreateSchema.safeParse({ columnId, title: 'Ada', amount: PIPELINE_AMOUNT_MAX + 1 });

    expect(accepted.success).toBe(true);
    expect(rejected.success).toBe(false);
  });

  it('rejects a field the card schema does not declare', () => {
    const parsed = cardCreateSchema.safeParse({ columnId, title: 'Ada', tenantId: 'other' });

    expect(parsed.success).toBe(false);
  });
});
