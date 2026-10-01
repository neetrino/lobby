import { z } from 'zod';

import { readAuditIpHashKey } from './common/audit/audit-ip-hash';
import { readAuthRateLimitConfig, readSessionRedisTimeoutMs } from './modules/identity';
import { readAllowedOrigins } from './common/security/allowed-origins';
import { readTrustProxy, type TrustProxySetting } from './common/security/trust-proxy';

/** Listen port when `PORT` is unset. */
const DEFAULT_API_PORT = 3001;

const RATE_LIMIT_VARIABLES = [
  'RATE_LIMIT_LOGIN_IP_LIMIT',
  'RATE_LIMIT_LOGIN_IP_WINDOW_MS',
  'RATE_LIMIT_LOGIN_ACCOUNT_LIMIT',
  'RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_MS',
  'RATE_LIMIT_REGISTER_IP_LIMIT',
  'RATE_LIMIT_REGISTER_IP_WINDOW_MS',
  'RATE_LIMIT_INVALID_SESSION_IP_LIMIT',
  'RATE_LIMIT_INVALID_SESSION_IP_WINDOW_MS',
] as const;

const portSchema = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => Number(value))
  .refine((value) => value >= 1 && value <= 65535);

export type ApiConfigIssue = {
  variable: string;
  message: string;
};

/**
 * Snapshot bootstrap is allowed to read.
 * Feature modules keep their own readers and see the same environment after this gate.
 * TODO(http-foundation-review): those readers still call `process.env` after validation.
 * A separate task should decide whether every lookup goes through this object.
 */
export type ApiConfig = {
  port: number;
  databaseUrl: string;
  allowedOrigins: readonly string[];
  trustProxy: TrustProxySetting;
};

/**
 * Startup failure. The message is a variable list, not a stack trace or a parser dump.
 */
export class ApiConfigError extends Error {
  readonly issues: readonly ApiConfigIssue[];

  constructor(issues: readonly ApiConfigIssue[]) {
    super(formatApiConfigIssues(issues));
    this.name = 'ApiConfigError';
    this.issues = issues;
  }
}

export function formatApiConfigIssues(issues: readonly ApiConfigIssue[]): string {
  const lines = issues.map((issue) => `- ${issue.variable}: ${issue.message}`);
  return `Invalid environment configuration:\n${lines.join('\n')}`;
}

/**
 * Validates the environment through the existing readers, then returns a config object.
 * Bootstrap must use this result instead of reading `process.env`.
 */
export async function loadApiConfig(env: NodeJS.ProcessEnv = process.env): Promise<ApiConfig> {
  const { readDatabaseUrl } = await import('@lobby/database');
  const issues: ApiConfigIssue[] = [];
  const port = readPort(env, issues);
  const databaseUrl = capture(issues, 'DATABASE_URL', 'DATABASE_URL is required.', () =>
    readDatabaseUrl(env),
  );
  const allowedOrigins = capture(
    issues,
    'ALLOWED_ORIGINS',
    'ALLOWED_ORIGINS contains an invalid origin.',
    () => readAllowedOrigins(env),
  );
  const trustProxy = capture(issues, 'TRUST_PROXY', 'TRUST_PROXY is invalid.', () =>
    readTrustProxy(env),
  );
  capture(issues, 'SESSION_REDIS_TIMEOUT_MS', 'SESSION_REDIS_TIMEOUT_MS is invalid.', () =>
    readSessionRedisTimeoutMs(env),
  );
  capture(issues, 'AUDIT_IP_HASH_KEY', 'AUDIT_IP_HASH_KEY is invalid.', () =>
    readAuditIpHashKey(env),
  );
  collectRateLimits(env, issues);
  return completeConfig(port, databaseUrl, allowedOrigins, trustProxy, issues);
}

function readPort(env: NodeJS.ProcessEnv, issues: ApiConfigIssue[]): number {
  const raw = env.PORT?.trim() ?? '';
  if (raw.length === 0) {
    return DEFAULT_API_PORT;
  }
  const parsed = portSchema.safeParse(raw);
  if (!parsed.success) {
    issues.push({ variable: 'PORT', message: 'PORT must be an integer from 1 to 65535.' });
    return DEFAULT_API_PORT;
  }
  return parsed.data;
}

function collectRateLimits(env: NodeJS.ProcessEnv, issues: ApiConfigIssue[]): void {
  for (const variable of RATE_LIMIT_VARIABLES) {
    const raw = env[variable]?.trim() ?? '';
    if (raw.length === 0) {
      continue;
    }
    capture(issues, variable, `${variable} must be a positive integer.`, () =>
      readAuthRateLimitConfig({ [variable]: raw }),
    );
  }
}

function capture<T>(
  issues: ApiConfigIssue[],
  variable: string,
  fallback: string,
  read: () => T,
): T | undefined {
  try {
    return read();
  } catch (error) {
    issues.push({ variable, message: safeMessage(error, fallback) });
    return undefined;
  }
}

function completeConfig(
  port: number,
  databaseUrl: string | undefined,
  allowedOrigins: readonly string[] | undefined,
  trustProxy: TrustProxySetting | undefined,
  issues: readonly ApiConfigIssue[],
): ApiConfig {
  if (
    issues.length > 0 ||
    databaseUrl === undefined ||
    allowedOrigins === undefined ||
    trustProxy === undefined
  ) {
    const reported =
      issues.length > 0
        ? issues
        : [{ variable: 'CONFIG', message: 'Environment configuration could not be read.' }];
    throw new ApiConfigError(reported);
  }
  return { port, databaseUrl, allowedOrigins, trustProxy };
}

function safeMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || error.name === 'ZodError' || error.message.includes('Zod')) {
    return fallback;
  }
  return error.message;
}
