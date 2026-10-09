import { Module } from '@nestjs/common';

import { AuditModule } from '../../common/audit/audit.module';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { DatabaseModule } from '../../common/database/database.module';
import { OutboxModule } from '../../common/outbox/outbox.module';
import { PipelineService } from './application/pipeline.service';
import { PipelinesController } from './presentation/pipelines.controller';

/** Lead and deal boards. Stage names, count, and widths belong to the tenant. */
@Module({
  imports: [AuthorizationModule, AuditModule, DatabaseModule, OutboxModule],
  controllers: [PipelinesController],
  providers: [PipelineService],
})
export class DealsModule {}
