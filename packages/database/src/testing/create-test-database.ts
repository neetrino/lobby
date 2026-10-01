import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
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
const ALLOWED_TEST_DATABASES = new Set([
  'lobby_outbox_test',
  'lobby_outbox_api_test',
  'lobby_outbox_worker_test',
]);
const TEST_SCHEMA_PREFIX = 'test_';
const isolatedSchemas = new WeakMap<PrismaClient, { databaseUrl: string; schema: string }>();

export function resolveTestDatabaseUrl(): string {
  const connectionString = process.env.OUTBOX_TEST_DATABASE_URL ?? LOCAL_TEST_URL;
  assertLocalDatabase(connectionString);
  return connectionString;
}

export async function createTestPrismaClient(): Promise<PrismaClient> {
  const databaseUrl = resolveTestDatabaseUrl();
  await ensureTestDatabase(databaseUrl);
  const schema = createTestSchemaName();
  const connectionString = withSchema(databaseUrl, schema);
  try {
    await deployMigrations(connectionString);
  } catch (error) {
    await dropTestSchema(databaseUrl, schema).catch(() => undefined);
    throw error;
  }
  const prisma = createPrismaClient(connectionString);
  isolatedSchemas.set(prisma, { databaseUrl, schema });
  return prisma;
}

/** Disconnects an isolated test client and drops only the schema created for it. */
export async function disposeTestPrismaClient(prisma: PrismaClient | undefined): Promise<void> {
  if (prisma === undefined) {
    return;
  }
  const isolated = isolatedSchemas.get(prisma);
  isolatedSchemas.delete(prisma);
  try {
    await prisma.$disconnect();
  } finally {
    if (isolated !== undefined) {
      await dropTestSchema(isolated.databaseUrl, isolated.schema);
    }
  }
}

export function assertLocalDatabase(connectionString: string): void {
  const host = new URL(connectionString).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('Refusing to run outbox tests against a non-local database');
  }
}

async function ensureTestDatabase(connectionString: string): Promise<void> {
  const databaseName = new URL(connectionString).pathname.slice(1);
  if (!ALLOWED_TEST_DATABASES.has(databaseName)) {
    throw new Error('Outbox tests must use a dedicated local test database');
  }
  const admin = new pg.Client({ connectionString: LOCAL_ADMIN_URL });
  await admin.connect();
  try {
    const existing = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      databaseName,
    ]);
    if (existing.rowCount === 0) {
      try {
        await admin.query(`CREATE DATABASE ${databaseName}`);
      } catch (error) {
        if (!isDuplicateDatabaseError(error)) {
          throw error;
        }
      }
    }
  } finally {
    await admin.end();
  }
}

function isDuplicateDatabaseError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '42P04';
}

function createTestSchemaName(): string {
  return `${TEST_SCHEMA_PREFIX}${process.pid}_${crypto.randomUUID().replaceAll('-', '')}`;
}

function withSchema(connectionString: string, schema: string): string {
  assertTestSchemaName(schema);
  const url = new URL(connectionString);
  url.searchParams.set('schema', schema);
  return url.toString();
}

async function dropTestSchema(connectionString: string, schema: string): Promise<void> {
  assertTestSchemaName(schema);
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await client.end();
  }
}

function assertTestSchemaName(schema: string): void {
  if (!/^test_[a-zA-Z0-9_]+$/.test(schema)) {
    throw new Error('Invalid isolated test schema name');
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
