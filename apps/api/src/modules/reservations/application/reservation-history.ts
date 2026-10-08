import { Injectable } from '@nestjs/common';
import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };

type InitialHistory = {
  tenantId: string;
  reservationId: string;
  changedByUserId: string | null;
};

/** First business-timeline row. This is not the security audit log. */
@Injectable()
export class ReservationHistoryWriter {
  async appendInitial(tx: Prisma.TransactionClient, input: InitialHistory): Promise<void> {
    await tx.reservationStatusHistory.create({
      data: {
        tenantId: input.tenantId,
        reservationId: input.reservationId,
        fromStatus: null,
        toStatus: 'PENDING',
        changedByUserId: input.changedByUserId,
      },
    });
  }
}
