import { Controller, Get } from '@nestjs/common';

import { Public } from '../../common/auth/public';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  getHealth() {
    return { status: 'ok' } as const;
  }
}
