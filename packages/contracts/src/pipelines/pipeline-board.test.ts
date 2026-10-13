import { describe, expect, it } from 'vitest';

import { pipelineBoardResponseSchema } from './pipeline-board.js';

describe('pipelineBoardResponseSchema', () => {
  it('accepts a board and rejects a card with a missing amount', () => {
    const board = {
      data: {
        id: '00000000-0000-4000-8000-000000000001',
        kind: 'lead',
        name: 'Leads',
        amountLabel: '',
        columns: [
          {
            id: '00000000-0000-4000-8000-000000000002',
            name: 'New',
            position: 0,
            widthPx: 300,
            cards: [
              {
                id: '00000000-0000-4000-8000-000000000003',
                title: 'Ada',
                company: '',
                amount: 10,
                position: 0,
              },
            ],
          },
        ],
      },
    };

    expect(pipelineBoardResponseSchema.safeParse(board).success).toBe(true);
    const card = board.data.columns[0]?.cards[0];
    if (card === undefined) {
      throw new Error('Fixture card is missing.');
    }
    const { amount, ...withoutAmount } = card;
    expect(amount).toBe(10);
    expect(
      pipelineBoardResponseSchema.safeParse({
        data: { ...board.data, columns: [{ ...board.data.columns[0], cards: [withoutAmount] }] },
      }).success,
    ).toBe(false);
  });
});
