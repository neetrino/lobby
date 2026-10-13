import type { PrismaClient } from './dist/index';

export function resolveTestDatabaseUrl(): string;

export function createTestPrismaClient(): Promise<PrismaClient>;

export function disposeTestPrismaClient(prisma: PrismaClient | undefined): Promise<void>;

export function assertLocalDatabase(connectionString: string): void;

export type { PrismaClient };
