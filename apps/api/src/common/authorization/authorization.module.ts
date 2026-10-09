import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module';
import { ModuleEntitlementService } from './module-entitlement';
import { PermissionGuard } from './permission.guard';

/** Shared permission guard and tenant module gate. */
@Module({
  imports: [DatabaseModule],
  providers: [PermissionGuard, ModuleEntitlementService],
  exports: [PermissionGuard, ModuleEntitlementService],
})
export class AuthorizationModule {}
