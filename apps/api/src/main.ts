import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { readAllowedOrigins } from './common/security/allowed-origins';
import { enableCredentialedCors } from './common/security/cors';
import { applyTrustProxy } from './common/security/trust-proxy';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  applyTrustProxy(app);
  app.setGlobalPrefix('api');
  // CORS allows credentialed browser reads. It is not the CSRF control; OriginGuard is.
  enableCredentialedCors(
    {
      enableCors(options) {
        app.enableCors({
          origin: options.origin === false ? false : [...options.origin],
          credentials: options.credentials,
          methods: [...options.methods],
          allowedHeaders: [...options.allowedHeaders],
        });
      },
    },
    readAllowedOrigins(),
  );
  await app.listen(process.env.PORT ?? 3001);
}

void bootstrap();
