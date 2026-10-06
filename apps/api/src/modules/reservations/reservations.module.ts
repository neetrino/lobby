import { Module } from '@nestjs/common';

import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { DatabaseModule } from '../../common/database/database.module';
import { ReservationsDashboardProjection } from './application/reservations-dashboard.projection';
import { ReservationLoadQuery } from './infrastructure/reservation-load.query';
import { ReservationsDashboardQuery } from './infrastructure/reservations-dashboard.query';

/**
 * Reservation capability boundary.
 * The dashboard reads through `ReservationsDashboardProjection`.
 * Reservation write endpoints stay out until their API contract is approved.
 */
@Module({
  imports: [AuthorizationModule, DatabaseModule],
  providers: [ReservationsDashboardQuery, ReservationLoadQuery, ReservationsDashboardProjection],
  exports: [ReservationsDashboardProjection],
})
export class ReservationsModule {}
