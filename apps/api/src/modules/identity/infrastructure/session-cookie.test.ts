import { describe, expect, it } from 'vitest';

import { SESSION_IDLE_TTL_MS } from '../domain/session-policy';
import { createRawSessionId } from './session-id';
import { readSessionCookieSecure, SESSION_COOKIE_NAME, SessionCookie, type SessionCookieOptions, type SessionCookieWriter } from './session-cookie';

describe('SessionCookie', () => {
  it('sets and clears an opaque id with flags from config', () => {
    const rawSessionId = createRawSessionId();
    const secureWriter = new RecordingCookieWriter();
    const localWriter = new RecordingCookieWriter();

    new SessionCookie(true).set(secureWriter, rawSessionId);
    new SessionCookie(false).set(localWriter, rawSessionId);
    new SessionCookie(true).clear(secureWriter);

    expect(secureWriter.setCall).toEqual({
      name: SESSION_COOKIE_NAME,
      value: rawSessionId,
      options: cookieOptions(true),
    });
    expect(localWriter.setCall?.options.secure).toBe(false);
    expect(secureWriter.clearCall).toEqual({ name: SESSION_COOKIE_NAME, options: cookieOptions(true) });
    expect(readSessionCookieSecure({ NODE_ENV: 'production' })).toBe(true);
    expect(readSessionCookieSecure({ NODE_ENV: 'development' })).toBe(false);
    expect(readSessionCookieSecure({})).toBe(false);
  });

  it('reads only an opaque session id', () => {
    const rawSessionId = createRawSessionId();
    const cookie = new SessionCookie(true);
    const writer = new RecordingCookieWriter();

    expect(cookie.read(`${SESSION_COOKIE_NAME}=${rawSessionId}`)).toBe(rawSessionId);
    expect(cookie.read(`theme=light; ${SESSION_COOKIE_NAME}=${rawSessionId}`)).toBe(rawSessionId);
    expect(cookie.read(`${SESSION_COOKIE_NAME}=eyJhbGciOiJIUzI1NiJ9.payload.sig`)).toBeNull();
    expect(cookie.read(undefined)).toBeNull();
    expect(() => cookie.set(writer, 'eyJhbGciOiJIUzI1NiJ9.payload.sig')).toThrow(
      'Session cookie value must be an opaque session id.',
    );
    expect(writer.setCall).toBeUndefined();
  });
});

function cookieOptions(secure: boolean): SessionCookieOptions {
  return { httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: SESSION_IDLE_TTL_MS };
}

class RecordingCookieWriter implements SessionCookieWriter {
  setCall?: { name: string; value: string; options: SessionCookieOptions };
  clearCall?: { name: string; options: SessionCookieOptions };

  cookie(name: string, value: string, options: SessionCookieOptions): void {
    this.setCall = { name, value, options };
  }

  clearCookie(name: string, options: SessionCookieOptions): void {
    this.clearCall = { name, options };
  }
}
