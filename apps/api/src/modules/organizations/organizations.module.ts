import { Module } from '@nestjs/common';

import { OutboxModule } from '../../common/outbox';
import { CreateTenantService } from './application/create-tenant.service';

@Module({
  imports: [OutboxModule],
  providers: [CreateTenantService],
  exports: [CreateTenantService],
})
export class OrganizationsModule {}
