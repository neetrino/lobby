import type { RequestContext } from '../../../common/tenant/request-context';
import type { TenantId } from '../../../common/tenant/tenant-id';

export const integrationProviders = ['WEBSITE', 'INSTAGRAM', 'WHATSAPP', 'TELEGRAM'] as const;

export type IntegrationProvider = (typeof integrationProviders)[number];

const integrationActorBrand: unique symbol = Symbol('reservation-integration-actor');

declare const authenticatedChannelBrand: unique symbol;

/**
 * Channel account minted by `ChannelAuthenticator` from a stored configuration row.
 * A plain `{ tenantId, provider, channelAccountId }` is not this type.
 * The webhook body is not a source for these fields.
 */
export type AuthenticatedChannel = {
  readonly tenantId: TenantId;
  readonly provider: IntegrationProvider;
  readonly channelAccountId: string;
} & { readonly [authenticatedChannelBrand]: true };

/**
 * Who is allowed to create a booking.
 * A user comes from the session.
 * An integration actor is minted only by `reservationActorFromChannel`.
 */
export type ReservationActor =
  | { type: 'USER'; context: RequestContext }
  | {
      type: 'INTEGRATION';
      tenantId: TenantId;
      channelAccountId: string;
      provider: IntegrationProvider;
      requestId: string;
      readonly [integrationActorBrand]: true;
    };

/**
 * Builds the integration actor from a channel that has already been authenticated.
 * `requestId` is the API request id, not a credential or a body field.
 * There is no factory from tenant, provider, and account fields.
 */
export function reservationActorFromChannel(
  channel: AuthenticatedChannel,
  requestId: string,
): ReservationActor {
  return {
    type: 'INTEGRATION',
    tenantId: channel.tenantId,
    channelAccountId: channel.channelAccountId,
    provider: channel.provider,
    requestId,
    [integrationActorBrand]: true,
  };
}
