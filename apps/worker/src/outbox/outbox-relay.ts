import type { OutboxWorkerConfig } from '@lobby/database';

import type { OutboxProcessor } from './outbox-processor.js';
import type { OutboxRepository } from './outbox-repository.js';

export class OutboxRelay {
  constructor(
    private readonly repository: OutboxRepository,
    private readonly processor: OutboxProcessor,
    private readonly config: OutboxWorkerConfig,
    private readonly sleep: (milliseconds: number) => Promise<void> = delay,
  ) {}

  async pollOnce(): Promise<number> {
    const claimed = await this.repository.claimBatch();
    for (const record of claimed) {
      await this.processor.process(record);
    }
    return claimed.length;
  }

  async run(signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      await this.pollOnce();
      if (signal.aborted) {
        return;
      }
      await this.sleep(this.config.pollIntervalMs);
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
