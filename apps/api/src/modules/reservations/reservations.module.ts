import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { DatabaseModule } from '../../common/database/database.module';
import { OutboxModule } from '../../common/outbox';
import { CreateReservationService } from './application/create-reservation.service';
import { ReservationAccessService } from './application/reservation-access.service';
import { ReservationLifecycleService } from './application/reservation-lifecycle.service';
import { ReservationHistoryWriter } from './application/reservation-history';
import { ReservationsDashboardProjection } from './application/reservations-dashboard.projection';
import { ReservationLoadQuery } from './infrastructure/reservation-load.query';
import { ReservationRepository } from './infrastructure/reservation.repository';
import { ReservationsDashboardQuery } from './infrastructure/reservations-dashboard.query';
import { ReservationsController } from './presentation/reservations.controller';
import {
  ReservationAvailabilityController,
  ReservationLocationsController,
} from './presentation/reservation-catalog.controller';

/**
 * Reservation capability boundary.
 * `POST /reservations` creates one tenant-scoped booking.
 * `GET /reservations` and `GET /reservations/:id` expose tenant-scoped reads.
 * `PATCH /reservations/:id` and `POST /reservations/:id/cancel` own booking changes.
 * The dashboard reads through `ReservationsDashboardProjection`.
 */
@Module({
  imports: [AuthorizationModule, DatabaseModule, OutboxModule, AuditModule],
  controllers: [
    ReservationsController,
    ReservationLocationsController,
    ReservationAvailabilityController,
  ],
  providers: [
    ReservationRepository,
    ReservationHistoryWriter,
    CreateReservationService,
    ReservationAccessService,
    ReservationLifecycleService,
    ReservationsDashboardQuery,
    ReservationLoadQuery,
    ReservationsDashboardProjection,
  ],
  exports: [ReservationsDashboardProjection],
})
export class ReservationsModule {}
