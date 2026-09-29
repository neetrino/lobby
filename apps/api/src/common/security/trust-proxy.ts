import { z } from 'zod';

/** Express `trust proxy` value. `false` ignores `X-Forwarded-For`. */
export type TrustProxySetting = false | number | string;

const MAX_PROXY_HOPS = 8;

const hopCountSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform((value) => Number(value))
  .refine((value) => value <= MAX_PROXY_HOPS);

const proxyAddressSchema = z.string().refine(isProxyAddressList);

const trustProxySchema = z.union([hopCountSchema, proxyAddressSchema]);

/**
 * Reads `TRUST_PROXY`. Unset means off.
 * A hop count or an explicit proxy address is allowed. `true` is rejected.
 */
export function readTrustProxy(env: NodeJS.ProcessEnv = process.env): TrustProxySetting {
  const raw = env.TRUST_PROXY?.trim() ?? '';
  if (isDisabled(raw)) {
    return false;
  }
  if (raw === 'true' || raw === '*') {
    throw new Error('TRUST_PROXY cannot trust every X-Forwarded-For value.');
  }

  const parsed = trustProxySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error('TRUST_PROXY is invalid.');
  }
  return parsed.data;
}

/** Applies a setting that has already been validated. The default leaves forwarding headers untrusted. */
export function applyTrustProxy(
  app: { set(setting: 'trust proxy', value: TrustProxySetting): void },
  setting: TrustProxySetting,
): void {
  app.set('trust proxy', setting);
}

function isDisabled(value: string): boolean {
  return value.length === 0 || value === 'false' || value === '0' || value === 'off';
}

function isProxyAddressList(value: string): boolean {
  const addresses = value.split(',');
  return addresses.length > 0 && addresses.every(isProxyAddress);
}

function isProxyAddress(value: string): boolean {
  if (value === 'loopback' || value === 'linklocal' || value === 'uniquelocal') {
    return true;
  }

  const [address, prefix, extra] = value.split('/');
  if (extra !== undefined || address === undefined) {
    return false;
  }
  if (prefix !== undefined && (!/^\d{1,2}$/.test(prefix) || Number(prefix) > 32)) {
    return false;
  }

  const octets = address.split('.');
  return (
    octets.length === 4 && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)
  );
}
