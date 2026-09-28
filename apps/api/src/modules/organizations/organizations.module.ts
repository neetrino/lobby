import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { OutboxModule } from '../../common/outbox';
import { CreateTenantService } from './application/create-tenant.service';

@Module({
  imports: [DatabaseModule, OutboxModule],
  providers: [CreateTenantService],
  exports: [CreateTenantService],
})
export class OrganizationsModule {}
