import type { PrismaClient } from './dist/index';

export function resolveTestDatabaseUrl(): string;

export function createTestPrismaClient(): Promise<PrismaClient>;

export function assertLocalDatabase(connectionString: string): void;

export type { PrismaClient };
