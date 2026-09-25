import { Module } from '@nestjs/common';

/**
 * Reservation capability boundary.
 *
 * Controllers and application services are added only when their API contracts
 * and authorization rules are approved. Domain rules and persistence remain
 * owned by this module.
 */
@Module({})
export class ReservationsModule {}
