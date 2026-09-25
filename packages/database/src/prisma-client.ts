import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/client/client';

export function createPrismaClient(connectionString: string): PrismaClient {
  if (connectionString.trim() === '') {
    throw new Error('Database connection string is required');
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

export function readDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const connectionString = env.DATABASE_URL;
  if (!connectionString || connectionString.trim() === '') {
    throw new Error('DATABASE_URL is required');
  }
  return connectionString;
}
