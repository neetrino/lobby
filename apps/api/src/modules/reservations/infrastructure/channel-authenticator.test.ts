import { createTestPrismaClient, disposeTestPrismaClient, type PrismaClient } from '@lobby/database/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthorizationError } from '../../../common/auth/authorization';
import { clearTestTenantData } from '../../../testing/clear-test-tenant-data';
import { reservationActorFromChannel } from '../application/reservation-actor';
import { channelBodySignature, ChannelAuthenticator, hashChannelCredential } from './channel-authenticator';
import { ReservationChannelStore } from './reservation-channel.store';

const credential = 'channel-secret';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = await createTestPrismaClient();
});

afterAll(async () => {
  await clearTestTenantData(prisma);
  await disposeTestPrismaClient(prisma);
});

beforeEach(async () => {
  await clearTestTenantData(prisma);
});

describe('ChannelAuthenticator', () => {
  it('reads tenant, provider, and account from the stored channel, not the body', async () => {
    const tenant = await seedTenant();
    await storeChannel(tenant.id);
    const rawBody = Buffer.from('{"tenantId":"forged","provider":"INSTAGRAM","channelAccountId":"forged"}');
    const channel = await authenticator().authenticate(signed(credential, rawBody), rawBody);
    const actor = reservationActorFromChannel(channel, '33333333-3333-4333-8333-333333333333');

    expect(channel.tenantId).toBe(tenant.id);
    expect(channel.provider).toBe('WHATSAPP');
    expect(channel.channelAccountId).toBe('channel-1');
    expect(actor).toMatchObject({ type: 'INTEGRATION', provider: 'WHATSAPP', channelAccountId: 'channel-1' });
  });

  it('rejects a signature or credential that does not match the stored channel', async () => {
    const tenant = await seedTenant();
    await storeChannel(tenant.id);
    const rawBody = Buffer.from('{}');

    await expect(
      authenticator().authenticate(
        { 'x-lobby-channel-credential': credential, 'x-lobby-channel-signature': 'ab' },
        rawBody,
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(authenticator().authenticate(signed('other-secret', rawBody), rawBody)).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });
});

function authenticator(): ChannelAuthenticator {
  return new ChannelAuthenticator(new ReservationChannelStore(prisma));
}

function signed(secret: string, rawBody: Uint8Array): Record<string, string> {
  return {
    'X-Lobby-Channel-Credential': secret,
    'X-Lobby-Channel-Signature': channelBodySignature(secret, rawBody),
  };
}

async function seedTenant(): Promise<{ id: string }> {
  return prisma.tenant.create({ data: { name: 'Channel', subdomain: 'channel', plan: 'STARTER' } });
}

async function storeChannel(tenantId: string): Promise<void> {
  await prisma.reservationChannel.create({
    data: {
      tenantId,
      provider: 'WHATSAPP',
      channelAccountId: 'channel-1',
      credentialHash: hashChannelCredential(credential),
    },
  });
}
