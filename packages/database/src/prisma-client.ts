import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/client/client';

export function createPrismaClient(connectionString: string): PrismaClient {
  if (connectionString.trim() === '') {
    throw new Error('Database connection string is required');
  }

  const url = new URL(connectionString);
  const schema = url.searchParams.get('schema')?.trim();
  url.searchParams.delete('schema');
  if (schema !== undefined && schema.length > 0) {
    assertPostgresIdentifier(schema);
    // Prisma's schema option scopes generated queries. PostgreSQL's search_path
    // also scopes intentionally raw SQL used by the outbox worker.
    url.searchParams.set('options', `-c search_path=${schema}`);
  }

  return new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: url.toString() },
      schema === undefined || schema.length === 0 ? undefined : { schema },
    ),
  });
}

function assertPostgresIdentifier(value: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error('Database schema must be a valid PostgreSQL identifier');
  }
}

export function readDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const connectionString = env.DATABASE_URL;
  if (!connectionString || connectionString.trim() === '') {
    throw new Error('DATABASE_URL is required');
  }
  return connectionString;
}
