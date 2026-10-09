import { describe, expect, it } from 'vitest';

import { createBoardQueue } from './pipeline-queue';

describe('createBoardQueue', () => {
  it('runs the next mutation only after the previous one settles', async () => {
    const queue = createBoardQueue();
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const first = queue.run(
      () =>
        new Promise<string>((resolve) => {
          releaseFirst = () => {
            order.push('first');
            resolve('first');
          };
        }),
    );
    const second = queue.run(async () => {
      order.push('second');
      return 'second';
    });

    expect(order).toEqual([]);
    await Promise.resolve();
    releaseFirst();
    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(order).toEqual(['first', 'second']);
  });

  it('continues after a failed mutation', async () => {
    const queue = createBoardQueue();
    const failed = queue.run(() => Promise.reject(new Error('stale')));
    const next = queue.run(() => Promise.resolve('fresh'));

    await expect(failed).rejects.toThrow('stale');
    await expect(next).resolves.toBe('fresh');
  });
});
