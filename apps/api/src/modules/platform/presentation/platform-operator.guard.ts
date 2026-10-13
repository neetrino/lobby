import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { readAuthenticatedSession } from '../../../common/auth/current-request';
import { AuthorizationError } from '../../../common/auth/authorization';
import { PRISMA_CLIENT } from '../../../common/database/database.tokens';
import { PLATFORM_SUBDOMAIN } from '../../../common/platform/platform-subdomain';

/**
 * Allows only the owner of the reserved platform workspace.
 * Customer owners have the same role, so the role check alone is not enough.
 */
@Injectable()
export class PlatformOperatorGuard implements CanActivate {
  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const session = readAuthenticatedSession(context.switchToHttp().getRequest());
    if (session.role !== 'OWNER') {
      throw new AuthorizationError();
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { subdomain: true },
    });
    if (tenant?.subdomain !== PLATFORM_SUBDOMAIN) {
      throw new AuthorizationError();
    }
    return true;
  }
}
