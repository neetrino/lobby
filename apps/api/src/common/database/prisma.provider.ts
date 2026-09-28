import type { Provider } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from './database.tokens';

/** Nest calls this factory once and reuses the client for the process. */
export const prismaClientProvider: Provider = {
  provide: PRISMA_CLIENT,
  useFactory: async (): Promise<PrismaClient> => {
    const { createPrismaClient, readDatabaseUrl } = await import('@lobby/database');
    return createPrismaClient(readDatabaseUrl());
  },
};
