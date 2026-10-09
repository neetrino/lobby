import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { configureHttpApp } from './common/http/configure-http-app';
import { AppModule } from './app.module';
import { ApiConfigError, loadApiConfig } from './load-api-config';

async function bootstrap(): Promise<void> {
  const config = await readConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureHttpApp(app, config);
  await app.listen(config.port);
}

async function readConfig() {
  try {
    return await loadApiConfig();
  } catch (error) {
    if (error instanceof ApiConfigError) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
    throw error;
  }
}

void bootstrap();
