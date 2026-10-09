import { RequestMethod, type INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import type { TrustProxySetting } from '../security/trust-proxy';
import { applyTrustProxy } from '../security/trust-proxy';
import { credentialedCorsOptions, enableCredentialedCors } from '../security/cors';
import { RequestContextLogger } from './request-context.logger';
import { requestIdMiddleware } from './request-id.middleware';

/** Versioned API prefix. Health stays outside it at `GET /health`. */
export const API_GLOBAL_PREFIX = 'api/v1';

export type HttpAppConfig = {
  allowedOrigins: readonly string[];
  trustProxy: TrustProxySetting;
};

/**
 * Shared HTTP bootstrap: security headers, request ids, version prefix, CORS, and shutdown hooks.
 * `GET /health` is excluded from the version prefix.
 */
export function configureHttpApp(
  app: NestExpressApplication,
  config: HttpAppConfig,
  options?: { logger?: boolean },
): void {
  if (options?.logger !== false) {
    app.useLogger(new RequestContextLogger());
  }
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(requestIdMiddleware);
  applyTrustProxy(app, config.trustProxy);
  app.setGlobalPrefix(API_GLOBAL_PREFIX, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
  enableCredentialedCors(corsAdapter(app), config.allowedOrigins);
  app.enableShutdownHooks();
}

function corsAdapter(app: INestApplication) {
  return {
    enableCors(options: ReturnType<typeof credentialedCorsOptions>): void {
      app.enableCors({
        origin: options.origin === false ? false : [...options.origin],
        credentials: options.credentials,
        methods: [...options.methods],
        allowedHeaders: [...options.allowedHeaders],
        exposedHeaders: [...options.exposedHeaders],
      });
    },
  };
}
