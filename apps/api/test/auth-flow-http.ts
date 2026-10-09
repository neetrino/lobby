import {
  BadRequestException,
  ConsoleLogger,
  Logger,
  type ArgumentsHost,
  type LoggerService,
} from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { ApiError } from '../src/common/http/api-error';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter';
import { SESSION_IDLE_TTL_MS } from '../src/modules/identity/domain/session-policy';
import { IdentityExceptionFilter } from '../src/modules/identity/presentation/identity-exception.filter';
import {
  SESSION_COOKIE_NAME,
  type SessionCookieOptions,
  type SessionCookieWriter,
} from '../src/modules/identity/infrastructure/session-cookie';

/** Matches the local allowlist in `.env.example`. */
export const AUTH_FLOW_ORIGIN = 'http://localhost:3000';

const BODY_LIMIT_BYTES = 16_384;
const CLEARED_COOKIE_EXPIRES = 'Thu, 01 Jan 1970 00:00:00 GMT';

export const capturedLogs: string[] = [];

export type HttpResult = {
  status: number;
  body: unknown;
  setCookie: string | undefined;
  requestId: string | null;
};

/**
 * Records Nest's logger and the console for the whole suite.
 * Identity incidents go through `Logger`, not `console`.
 */
export function installLogCapture(): () => void {
  const previous = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };
  console.log = wrap(previous.log);
  console.error = wrap(previous.error);
  console.warn = wrap(previous.warn);
  console.info = wrap(previous.info);
  console.debug = wrap(previous.debug);
  const logger: LoggerService = {
    log: capture,
    error: capture,
    warn: capture,
    debug: capture,
    verbose: capture,
    fatal: capture,
  };
  Logger.overrideLogger(logger);
  return () => {
    console.log = previous.log;
    console.error = previous.error;
    console.warn = previous.warn;
    console.info = previous.info;
    console.debug = previous.debug;
    Logger.overrideLogger(new ConsoleLogger());
  };
}

export async function send(
  baseUrl: string,
  path: string,
  init: {
    method: string;
    body?: unknown;
    cookie?: string;
    origin?: string | null;
    headers?: Record<string, string>;
  },
): Promise<HttpResult> {
  const headers = new Headers(init.headers);
  if (init.origin !== null) {
    headers.set('origin', init.origin ?? AUTH_FLOW_ORIGIN);
  }
  if (init.cookie !== undefined) {
    headers.set('cookie', `${SESSION_COOKIE_NAME}=${init.cookie}`);
  }
  if (init.body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return {
    status: response.status,
    body: await readResponse(response),
    setCookie: readSetCookie(response),
    requestId: response.headers.get('x-request-id'),
  };
}

export function cookieWriter(response: ServerResponse): SessionCookieWriter {
  return {
    cookie(name, value, options) {
      response.setHeader('Set-Cookie', serializeCookie(name, value, options, false));
    },
    clearCookie(name, options) {
      response.setHeader('Set-Cookie', serializeCookie(name, '', options, true));
    },
  };
}

export function sendError(response: ServerResponse, error: unknown): void {
  const state: { statusCode: number; body: unknown } = { statusCode: 500, body: undefined };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({
        status(statusCode: number) {
          state.statusCode = statusCode;
          return {
            json(body: unknown) {
              state.body = body;
            },
          };
        },
      }),
    }),
  } as ArgumentsHost;
  if (error instanceof ApiError) {
    new ApiExceptionFilter().catch(error, host);
  } else {
    new IdentityExceptionFilter().catch(error, host);
  }
  writeJson(response, state.statusCode, state.body);
}

export function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > BODY_LIMIT_BYTES) {
        reject(new BadRequestException());
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(parseJson(Buffer.concat(chunks).toString('utf8'))));
    request.on('error', () => reject(new BadRequestException()));
  });
}

export function idleCookieMaxAge(): number {
  return Math.floor(SESSION_IDLE_TTL_MS / 1000);
}

/**
 * Express 5 `res.cookie` emits `Max-Age` in seconds.
 * `res.clearCookie` drops `maxAge` and sets `Expires` to the epoch.
 */
function serializeCookie(
  name: string,
  value: string,
  options: SessionCookieOptions,
  clear: boolean,
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (clear) {
    parts.push(`Expires=${CLEARED_COOKIE_EXPIRES}`);
  } else {
    parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  }
  parts.push(`Path=${options.path}`);
  if (options.httpOnly) {
    parts.push('HttpOnly');
  }
  if (options.secure) {
    parts.push('Secure');
  }
  parts.push('SameSite=Lax');
  return parts.join('; ');
}

function parseJson(raw: string): unknown {
  if (raw.length === 0) {
    return {};
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new BadRequestException();
  }
}

async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }
  return response.json() as Promise<unknown>;
}

function readSetCookie(response: Response): string | undefined {
  const cookies = response.headers.getSetCookie();
  return cookies[0] ?? response.headers.get('set-cookie') ?? undefined;
}

function capture(...parts: unknown[]): void {
  capturedLogs.push(parts.map(textOf).join(' '));
}

function wrap(original: (...parts: unknown[]) => void): (...parts: unknown[]) => void {
  return (...parts: unknown[]) => {
    capture(...parts);
    original(...parts);
  };
}

function textOf(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
