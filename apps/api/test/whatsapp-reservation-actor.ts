import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { reservationActorFromChannel, type ReservationActor } from '../src/modules/reservations/application/reservation-actor';
import {
  channelBodySignature,
  ChannelAuthenticator,
  hashChannelCredential,
} from '../src/modules/reservations/infrastructure/channel-authenticator';
import { ReservationChannelStore } from '../src/modules/reservations/infrastructure/reservation-channel.store';

/** Test-only actor. This file is outside `src` and is not part of the API build. */
export async function whatsappActor(
  prisma: PrismaClient,
  tenantId: string,
  requestId: string,
): Promise<ReservationActor> {
  const credential = 'channel-secret';
  const rawBody = Buffer.from('{"provider":"INSTAGRAM","channelAccountId":"forged"}');
  await prisma.reservationChannel.create({
    data: {
      tenantId,
      provider: 'WHATSAPP',
      channelAccountId: 'channel-1',
      credentialHash: hashChannelCredential(credential),
    },
  });
  const authenticated = await new ChannelAuthenticator(new ReservationChannelStore(prisma)).authenticate(
    {
      'x-lobby-channel-credential': credential,
      'x-lobby-channel-signature': channelBodySignature(credential, rawBody),
    },
    rawBody,
  );
  return reservationActorFromChannel(authenticated, requestId);
}
