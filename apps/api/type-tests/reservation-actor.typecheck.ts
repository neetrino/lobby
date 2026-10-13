import { requestContextFromSession } from '../src/common/tenant/request-context';
import {
  reservationActorFromChannel,
  type ReservationActor,
} from '../src/modules/reservations/application/reservation-actor';

const session = requestContextFromSession(
  {
    tenantId: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    role: 'OWNER',
  },
  'req-1',
);

/** Typecheck rejects a hand-built channel, including one that already has a session tenant id. */
export function plainObjectIsNotAnAuthenticatedChannel(): void {
  const plain = {
    tenantId: session.tenantId,
    provider: 'WHATSAPP' as const,
    channelAccountId: 'channel-1',
  };
  // @ts-expect-error A plain object is not an AuthenticatedChannel.
  reservationActorFromChannel(plain, '33333333-3333-4333-8333-333333333333');
}

/** Typecheck rejects a hand-built integration actor. */
export function plainObjectIsNotAReservationActor(): ReservationActor {
  // @ts-expect-error A plain object is not a ReservationActor.
  return {
    type: 'INTEGRATION',
    tenantId: session.tenantId,
    provider: 'WHATSAPP',
    channelAccountId: 'channel-1',
    requestId: '33333333-3333-4333-8333-333333333333',
  };
}
