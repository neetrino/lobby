export type CredentialedCorsOptions = {
  origin: readonly string[] | false;
  credentials: true;
  methods: readonly string[];
  allowedHeaders: readonly string[];
  exposedHeaders: readonly string[];
};

type CorsApp = {
  enableCors(options: CredentialedCorsOptions): void;
};

/**
 * Browser read permission for an explicit origin list with credentials.
 * This is not CSRF protection. A cross-site form and a non-browser client ignore CORS.
 * Mutating requests are authorized by the Origin guard.
 * `origin: true` and `*` are intentionally not used: either one with credentials is unsafe.
 */
export function credentialedCorsOptions(origins: readonly string[]): CredentialedCorsOptions {
  return {
    origin: origins.length === 0 ? false : origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  };
}

export function enableCredentialedCors(app: CorsApp, origins: readonly string[]): void {
  app.enableCors(credentialedCorsOptions(origins));
}
