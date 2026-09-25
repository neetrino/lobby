import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { createPrismaClient } from '../prisma-client.js';
import type { PrismaClient } from '../../generated/client/client';

export type { PrismaClient };

const execFileAsync = promisify(execFile);
const LOCAL_ADMIN_URL = 'postgresql://lobby:lobby@127.0.0.1:54329/lobby';
const LOCAL_TEST_URL = 'postgresql://lobby:lobby@127.0.0.1:54329/lobby_outbox_test';
const ALLOWED_TEST_DATABASES = new Set(['lobby_outbox_test', 'lobby_outbox_api_test', 'lobby_outbox_worker_test']);

export function resolveTestDatabaseUrl(): string {
  const connectionString = process.env.OUTBOX_TEST_DATABASE_URL ?? LOCAL_TEST_URL;
  assertLocalDatabase(connectionString);
  return connectionString;
}

export async function createTestPrismaClient(): Promise<PrismaClient> {
  const connectionString = resolveTestDatabaseUrl();
  await ensureTestDatabase();
  await deployMigrations(connectionString);
  const prisma = createPrismaClient(connectionString);
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "outbox_events", "contacts", "users", "tenants" CASCADE',
  );
  return prisma;
}

export function assertLocalDatabase(connectionString: string): void {
  const host = new URL(connectionString).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('Refusing to run outbox tests against a non-local database');
  }
}

async function ensureTestDatabase(): Promise<void> {
  const databaseName = new URL(resolveTestDatabaseUrl()).pathname.slice(1);
  if (!ALLOWED_TEST_DATABASES.has(databaseName)) {
    throw new Error('Outbox tests must use a dedicated local test database');
  }
  const admin = new pg.Client({ connectionString: LOCAL_ADMIN_URL });
  await admin.connect();
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE ${databaseName}`);
    }
  } finally {
    await admin.end();
  }
}

async function deployMigrations(connectionString: string): Promise<void> {
  const packageRoot = findPackageRoot(path.dirname(fileURLToPath(import.meta.url)));
  const prismaCli = path.join(packageRoot, 'node_modules', 'prisma', 'build', 'index.js');
  await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: packageRoot,
    env: {
      ...process.env,
      DATABASE_URL: connectionString,
      DIRECT_URL: connectionString,
    },
  });
}

function findPackageRoot(start: string): string {
  let current = start;
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(path.join(current, 'prisma', 'schema.prisma'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }
  throw new Error('Could not find the database package root');
}
