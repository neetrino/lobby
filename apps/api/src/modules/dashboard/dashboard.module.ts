import { Module } from '@nestjs/common';

import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { DatabaseModule } from '../../common/database/database.module';
import { ContactsModule } from '../contacts';
import { MembersModule } from '../members';
import { ReservationsModule } from '../reservations';
import { DashboardService } from './application/dashboard.service';
import { DashboardLayoutStore } from './infrastructure/dashboard-layout.store';
import { DashboardController } from './presentation/dashboard.controller';

/**
 * Read-only aggregation. Widget data comes from each module's exported projection.
 */
@Module({
  imports: [AuthorizationModule, DatabaseModule, ContactsModule, MembersModule, ReservationsModule],
  controllers: [DashboardController],
  providers: [DashboardLayoutStore, DashboardService],
})
export class DashboardModule {}
