import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { AuditAccessService } from './audit-access.service';
import { AuditEventStore } from './audit-event.store';

@Module({
  imports: [DatabaseModule],
  providers: [AuditEventStore, AuditAccessService],
  exports: [AuditEventStore, AuditAccessService],
})
export class AuditModule {}
