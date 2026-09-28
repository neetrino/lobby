import { Injectable } from '@nestjs/common';

import { SESSION_IDLE_TTL_MS } from '../domain/session-policy';
import { isRawSessionId } from './session-id';

export const SESSION_COOKIE_NAME = 'session';

const OPAQUE_SESSION_ID_REQUIRED = 'Session cookie value must be an opaque session id.';

/** Express `maxAge` is milliseconds. */
export type SessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
};

export type SessionCookieWriter = {
  cookie(name: string, value: string, options: SessionCookieOptions): void;
  clearCookie(name: string, options: SessionCookieOptions): void;
};

@Injectable()
export class SessionCookie {
  constructor(private readonly secure: boolean) {}

  set(response: SessionCookieWriter, rawSessionId: string): void {
    if (!isRawSessionId(rawSessionId)) {
      throw new Error(OPAQUE_SESSION_ID_REQUIRED);
    }

    response.cookie(SESSION_COOKIE_NAME, rawSessionId, this.options());
  }

  clear(response: SessionCookieWriter): void {
    response.clearCookie(SESSION_COOKIE_NAME, this.options());
  }

  read(cookieHeader: string | readonly string[] | undefined): string | null {
    const header = joinCookieHeader(cookieHeader);
    if (header === undefined || header.length === 0) {
      return null;
    }

    const value = readCookieValue(header, SESSION_COOKIE_NAME);
    if (value === null || !isRawSessionId(value)) {
      return null;
    }

    return value;
  }

  private options(): SessionCookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      // Lax does not replace the Origin guard. Cross-site frontends need a CSRF token.
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_IDLE_TTL_MS,
    };
  }
}

/** Secure cookies in production. Local HTTP development keeps `secure` off. */
export function readSessionCookieSecure(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production';
}

function joinCookieHeader(cookieHeader: string | readonly string[] | undefined): string | undefined {
  if (cookieHeader === undefined) {
    return undefined;
  }

  return typeof cookieHeader === 'string' ? cookieHeader : cookieHeader.join('; ');
}

function readCookieValue(header: string, name: string): string | null {
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = part.slice(0, separator).trim();
    if (key !== name) {
      continue;
    }

    const rawValue = part.slice(separator + 1).trim();
    if (rawValue.length === 0) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
}
