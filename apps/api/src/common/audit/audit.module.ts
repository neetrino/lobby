import { Module } from '@nestjs/common';

import { AuthorizationModule } from '../authorization/authorization.module';
import { DatabaseModule } from '../database/database.module';
import { AuditAccessService } from './audit-access.service';
import { AuditEventStore } from './audit-event.store';
import { AuditEventsController } from './audit-events.controller';

@Module({
  imports: [AuthorizationModule, DatabaseModule],
  controllers: [AuditEventsController],
  providers: [AuditEventStore, AuditAccessService],
  exports: [AuditEventStore, AuditAccessService],
})
export class AuditModule {}
