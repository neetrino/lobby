import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import { AuthorizationError } from '../../../common/auth/authorization';
import type { TenantId } from '../../../common/tenant/tenant-id';
import {
  integrationProviders,
  type AuthenticatedChannel,
  type IntegrationProvider,
} from '../application/reservation-actor';
import type { ChannelConfiguration, ReservationChannelStore } from './reservation-channel.store';

const CREDENTIAL_HEADER = 'x-lobby-channel-credential';
const SIGNATURE_HEADER = 'x-lobby-channel-signature';

export type WebhookHeaders = Readonly<Record<string, string | undefined>>;

/**
 * Resolves a webhook to the stored channel account.
 * Identity comes from the credential lookup, never from the request body.
 * No webhook controller is wired yet. When one is added, it must pass the request's
 * original bytes before a body parser rewrites them, and mint the actor only
 * through `reservationActorFromChannel`.
 */
export class ChannelAuthenticator {
  constructor(private readonly channels: ReservationChannelStore) {}

  async authenticate(headers: WebhookHeaders, rawBody: Uint8Array): Promise<AuthenticatedChannel> {
    const credential = headerValue(headers, CREDENTIAL_HEADER);
    const signature = headerValue(headers, SIGNATURE_HEADER);
    if (credential === undefined || signature === undefined || !signatureMatches(credential, rawBody, signature)) {
      throw new AuthorizationError();
    }
    const row = await this.channels.findByCredentialHash(hashChannelCredential(credential));
    const provider = row === null ? null : integrationProvider(row.provider);
    if (row === null || provider === null) {
      throw new AuthorizationError();
    }
    return authenticatedChannel(row, provider);
  }
}

/** SHA-256 hex of the channel secret. Store this, not the secret. */
export function hashChannelCredential(credential: string): string {
  return createHash('sha256').update(credential, 'utf8').digest('hex');
}

/** HMAC-SHA256 hex of the exact webhook bytes, keyed by the channel secret. */
export function channelBodySignature(credential: string, rawBody: Uint8Array): string {
  return createHmac('sha256', credential).update(rawBody).digest('hex');
}

function authenticatedChannel(row: ChannelConfiguration, provider: IntegrationProvider): AuthenticatedChannel {
  return {
    tenantId: row.tenantId as TenantId,
    provider,
    channelAccountId: row.channelAccountId,
  } as AuthenticatedChannel;
}

function integrationProvider(value: string): IntegrationProvider | null {
  const providers: readonly string[] = integrationProviders;
  if (!providers.includes(value)) {
    return null;
  }
  return value as IntegrationProvider;
}

function headerValue(headers: WebhookHeaders, name: string): string | undefined {
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  const value = found?.[1]?.trim();
  if (value === undefined || value.length === 0) {
    return undefined;
  }
  return value;
}

function signatureMatches(credential: string, rawBody: Uint8Array, presented: string): boolean {
  const expected = createHmac('sha256', credential).update(rawBody).digest();
  const actual = Buffer.from(presented, 'hex');
  if (presented.length !== expected.length * 2 || actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
