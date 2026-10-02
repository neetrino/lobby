import { Inject, Logger, Module, type OnModuleDestroy } from '@nestjs/common';
import type { PrismaClient } from '@lobby/database' with { 'resolution-mode': 'import' };

import { PRISMA_CLIENT } from './database.tokens';
import { prismaClientProvider } from './prisma.provider';

@Module({
  providers: [prismaClientProvider],
  exports: [PRISMA_CLIENT],
})
export class DatabaseModule implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);
  private closed = false;

  constructor(@Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient) {}

  async onModuleDestroy(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;
    try {
      await this.prisma.$disconnect();
    } catch {
      this.logger.error('Prisma client disconnect failed');
    }
  }
}
