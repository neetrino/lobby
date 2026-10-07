import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { PlatformAdminService } from './modules/platform';

async function bootstrapPlatformAdmin(): Promise<void> {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim() ?? '';
  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? '';
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || 'Platform admin';
  if (email === '' || password === '') {
    throw new Error('PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD are required.');
  }
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const result = await app.get(PlatformAdminService).ensure({ name, email, password });
    console.log(result === 'created' ? 'Platform admin created.' : 'Platform admin already exists.');
  } finally {
    await app.close();
  }
}

void bootstrapPlatformAdmin();
