import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { PlanEntitlementGrant } from '../../common/modules/plan-entitlement-grant';
import { OutboxModule } from '../../common/outbox';
import { CreateTenantService } from './application/create-tenant.service';

@Module({
  imports: [DatabaseModule, OutboxModule],
  providers: [CreateTenantService, PlanEntitlementGrant],
  exports: [CreateTenantService],
})
export class OrganizationsModule {}
