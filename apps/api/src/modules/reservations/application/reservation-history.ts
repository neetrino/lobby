import { Injectable } from '@nestjs/common';
import type { Prisma } from '@lobby/database' with { 'resolution-mode': 'import' };
import type { ReservationStatus } from '@lobby/contracts';

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

  async appendTransition(
    tx: Prisma.TransactionClient,
    input: InitialHistory & { fromStatus: ReservationStatus; toStatus: ReservationStatus; reason: string | null },
  ): Promise<void> {
    await tx.reservationStatusHistory.create({
      data: {
        tenantId: input.tenantId,
        reservationId: input.reservationId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        changedByUserId: input.changedByUserId,
        reason: input.reason,
      },
    });
  }
}
