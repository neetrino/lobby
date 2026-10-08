import type { RequestContext } from '../../../common/tenant/request-context';
import type { TenantId } from '../../../common/tenant/tenant-id';

export const integrationProviders = ['WEBSITE', 'INSTAGRAM', 'WHATSAPP', 'TELEGRAM'] as const;

export type IntegrationProvider = (typeof integrationProviders)[number];

/**
 * Who is allowed to create a booking.
 * A user comes from the session. An integration actor is a trusted channel adapter, not a request body.
 */
export type ReservationActor =
  | { type: 'USER'; context: RequestContext }
  | {
      type: 'INTEGRATION';
      tenantId: TenantId;
      channelAccountId: string;
      provider: IntegrationProvider;
    };
