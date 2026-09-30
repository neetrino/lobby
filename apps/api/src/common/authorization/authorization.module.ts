import { Module } from '@nestjs/common';

import { PermissionGuard } from './permission.guard';

/** Shared permission guard. A feature module imports this instead of registering the guard itself. */
@Module({
  providers: [PermissionGuard],
  exports: [PermissionGuard],
})
export class AuthorizationModule {}
