import { Controller, Get, Post, UseGuards } from '@nestjs/common';

import { Authorize } from '../../../common/authorization/permission.guard';
import { ZodBody } from '../../../common/pipes/zod-input';
import {
  ProvisionOrganizationService,
  type ListedOrganization,
  type ProvisionedOrganization,
} from '../application/provision-organization.service';
import {
  provisionOrganizationSchema,
  type ProvisionOrganizationInput,
} from '../application/provision-organization.schema';
import { PlatformOperatorGuard } from './platform-operator.guard';

@Controller('platform/organizations')
export class PlatformOrganizationsController {
  constructor(private readonly organizations: ProvisionOrganizationService) {}

  @Get()
  @Authorize('platform:provision')
  @UseGuards(PlatformOperatorGuard)
  async list(): Promise<{ data: ListedOrganization[] }> {
    return { data: await this.organizations.list() };
  }

  @Post()
  @Authorize('platform:provision')
  @UseGuards(PlatformOperatorGuard)
  async create(
    @ZodBody(provisionOrganizationSchema) body: ProvisionOrganizationInput,
  ): Promise<{ data: ProvisionedOrganization }> {
    return { data: await this.organizations.create(body) };
  }
}
