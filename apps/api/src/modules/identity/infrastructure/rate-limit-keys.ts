import { createHash } from 'node:crypto';

/** SHA-256 hex. The raw subject must not appear in the Redis key. */
export function hashRateLimitSubject(subject: string): string {
  return createHash('sha256').update(subject, 'utf8').digest('hex');
}

export function loginIpKey(ip: string): string {
  return `rate_limit:login:ip:${hashRateLimitSubject(ip)}`;
}

export function loginAccountKey(subdomain: string, email: string): string {
  const subject = `${subdomain.trim().toLowerCase()}\0${email.trim().toLowerCase()}`;
  return `rate_limit:login:account:${hashRateLimitSubject(subject)}`;
}

export function registerIpKey(ip: string): string {
  return `rate_limit:register:ip:${hashRateLimitSubject(ip)}`;
}

export function invalidSessionIpKey(ip: string): string {
  return `rate_limit:session:ip:${hashRateLimitSubject(ip)}`;
}

export function inviteIpKey(ip: string): string {
  return `rate_limit:invite:ip:${hashRateLimitSubject(ip)}`;
}

export function inviteUserKey(tenantId: string, userId: string): string {
  return `rate_limit:invite:user:${hashRateLimitSubject(`${tenantId}\0${userId}`)}`;
}

export function acceptIpKey(ip: string): string {
  return `rate_limit:accept:ip:${hashRateLimitSubject(ip)}`;
}

export function passwordResetIpKey(ip: string): string {
  return `rate_limit:password_reset:ip:${hashRateLimitSubject(ip)}`;
}

export function passwordResetAccountKey(subdomain: string, email: string): string {
  const subject = `${subdomain.trim().toLowerCase()}\0${email.trim().toLowerCase()}`;
  return `rate_limit:password_reset:account:${hashRateLimitSubject(subject)}`;
}

export function passwordResetConfirmIpKey(ip: string): string {
  return `rate_limit:password_reset:confirm:ip:${hashRateLimitSubject(ip)}`;
}

export function teamMessageIpKey(ip: string): string {
  return `rate_limit:team_message:ip:${hashRateLimitSubject(ip)}`;
}

export function teamMessageUserKey(tenantId: string, userId: string): string {
  return `rate_limit:team_message:user:${hashRateLimitSubject(`${tenantId}\0${userId}`)}`;
}
