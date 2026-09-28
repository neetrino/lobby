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
