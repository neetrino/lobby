import { Module } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { OutboxService } from './outbox.service';

export const PRISMA_CLIENT = Symbol('PRISMA_CLIENT');

@Module({
  providers: [
    OutboxService,
    {
      provide: PRISMA_CLIENT,
      useFactory: async (): Promise<PrismaClient> => {
        const { createPrismaClient, readDatabaseUrl } = await import('@lobby/database');
        return createPrismaClient(readDatabaseUrl());
      },
    },
  ],
  exports: [OutboxService, PRISMA_CLIENT],
})
export class OutboxModule {}
