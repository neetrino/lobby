import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

export type ChannelConfiguration = {
  tenantId: string;
  provider: string;
  channelAccountId: string;
};

/** Reads a channel row by the hash of its webhook credential. */
export class ReservationChannelStore {
  constructor(private readonly db: PrismaClient) {}

  findByCredentialHash(credentialHash: string): Promise<ChannelConfiguration | null> {
    return this.db.reservationChannel.findUnique({
      where: { credentialHash },
      select: { tenantId: true, provider: true, channelAccountId: true },
    });
  }
}
