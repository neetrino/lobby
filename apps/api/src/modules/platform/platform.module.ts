import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../common/database/database.module';
import { IdentityModule } from '../identity';
import { OrganizationsModule } from '../organizations';
import { PlatformAdminService } from './application/platform-admin.service';
import { ProvisionOrganizationService } from './application/provision-organization.service';
import { PlatformOrganizationsController } from './presentation/platform-organizations.controller';
import { PlatformOperatorGuard } from './presentation/platform-operator.guard';

@Module({
  imports: [DatabaseModule, IdentityModule, OrganizationsModule],
  controllers: [PlatformOrganizationsController],
  providers: [PlatformAdminService, ProvisionOrganizationService, PlatformOperatorGuard],
  exports: [PlatformAdminService],
})
export class PlatformModule {}
