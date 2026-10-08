import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { DatabaseModule } from '../../common/database/database.module';
import { OutboxModule } from '../../common/outbox';
import { CreateReservationService } from './application/create-reservation.service';
import { ReservationHistoryWriter } from './application/reservation-history';
import { ReservationsDashboardProjection } from './application/reservations-dashboard.projection';
import { ReservationLoadQuery } from './infrastructure/reservation-load.query';
import { ReservationRepository } from './infrastructure/reservation.repository';
import { ReservationsDashboardQuery } from './infrastructure/reservations-dashboard.query';
import { ReservationsController } from './presentation/reservations.controller';

/**
 * Reservation capability boundary.
 * `POST /reservations` creates one tenant-scoped booking.
 * The dashboard reads through `ReservationsDashboardProjection`.
 */
@Module({
  imports: [AuthorizationModule, DatabaseModule, OutboxModule, AuditModule],
  controllers: [ReservationsController],
  providers: [
    ReservationRepository,
    ReservationHistoryWriter,
    CreateReservationService,
    ReservationsDashboardQuery,
    ReservationLoadQuery,
    ReservationsDashboardProjection,
  ],
  exports: [ReservationsDashboardProjection],
})
export class ReservationsModule {}
