import { readSessionCookieSecure } from '../../identity';

export const INVITATION_ACCESS_COOKIE = 'invitation_accept';
export const INVITATION_ACCESS_COOKIE_PATH = '/api/v1/auth/invitations';

export type InvitationCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: typeof INVITATION_ACCESS_COOKIE_PATH;
  maxAge: number;
};

export type InvitationCookieWriter = {
  cookie(name: string, value: string, options: InvitationCookieOptions): void;
  clearCookie(name: string, options: InvitationCookieOptions): void;
};

/**
 * HttpOnly cookie that holds the sealed invitation token after the URL exchange.
 * SameSite=Lax, so the web app and API must share a site. A cross-site API host
 * does not receive this cookie on credentialed fetch.
 */
export class InvitationAccessCookie {
  constructor(private readonly secure: boolean) {}

  set(response: InvitationCookieWriter, sealed: string, maxAgeMs: number): void {
    response.cookie(INVITATION_ACCESS_COOKIE, sealed, this.options(maxAgeMs));
  }

  clear(response: InvitationCookieWriter): void {
    response.clearCookie(INVITATION_ACCESS_COOKIE, this.options(0));
  }

  read(cookieHeader: string | readonly string[] | undefined): string | null {
    const header = joinCookieHeader(cookieHeader);
    if (header === undefined || header.length === 0) {
      return null;
    }
    return readCookieValue(header, INVITATION_ACCESS_COOKIE);
  }

  private options(maxAgeMs: number): InvitationCookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: INVITATION_ACCESS_COOKIE_PATH,
      maxAge: maxAgeMs,
    };
  }
}

export function invitationAccessCookie(): InvitationAccessCookie {
  return new InvitationAccessCookie(readSessionCookieSecure());
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
