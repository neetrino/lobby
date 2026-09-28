import { NestFactory } from '@nestjs/core';

import { readAllowedOrigins } from './common/security/allowed-origins';
import { enableCredentialedCors } from './common/security/cors';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // CORS allows credentialed browser reads. It is not the CSRF control; OriginGuard is.
  enableCredentialedCors(app, readAllowedOrigins());
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
