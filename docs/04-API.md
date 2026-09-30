# API Documentation: Lobby

> This document records the logical REST API contract. It starts intentionally small and should be updated alongside implemented endpoints and generated OpenAPI documentation.

- **Style:** Versioned REST
- **Owner:** NestJS API
- **Version:** 0.3
- **Status:** Auth and the contacts pilot are implemented. Other modules remain planned.

---

## Documentation approach

- OpenAPI generated from NestJS controllers and DTOs is the executable API reference.
- This document explains cross-cutting rules and provides a readable endpoint index.
- Module-specific details stay with their owning module until they become public contracts.
- Every endpoint change updates its DTO/schema, tests, OpenAPI output, and this index when relevant.

---

## Base contract

| Concern        | Proposed rule                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Base path      | `/api/v1`, set once in HTTP bootstrap. Controllers do not repeat `v1`. `GET /health` has no version prefix.          |
| Format         | JSON over HTTPS                                                                                                      |
| Authentication | Opaque server-side session. `POST /api/v1/auth/login` sets the session cookie. `POST /api/v1/auth/logout` clears it. |
| Tenant context | Copied from the validated session. A client tenant id is not a source of scope.                                      |
| Validation     | `z.strictObject` on JSON bodies. An unknown field, including `tenantId`, is `400 VALIDATION_ERROR`.                  |
| Dates          | ISO 8601 UTC in API payloads unless a contract explicitly states otherwise                                           |
| Identifiers    | Opaque stable IDs; exact format TBD                                                                                  |
| Localization   | API returns stable codes; clients translate user-facing messages where practical                                     |

---

## Request processing

```text
Request
→ OriginGuard rejects a mutating method unless Origin, or a Referer origin when Origin is absent, is in ALLOWED_ORIGINS
→ SessionGuard requires a session cookie, unless the route is marked @Public()
→ hash the raw session id and load the Redis record
→ reject a missing, expired, revoked, disabled, or version-mismatched session
→ copy RequestContext from that session plus the server-generated request id
→ PermissionGuard, on a route marked @Authorize(...). The guard rejects the request when that permission is missing
→ validate input
→ execute the owning module operation with { requestId, userId, tenantId, role } plus the validated input
→ return the documented response or error
```

Handlers do not read a tenant id from the body, query, or headers. The client must never rely on hidden UI state as proof of authorization.

Authorization has three checks. The session still carries a role: `OWNER`, `ADMIN`, or `MEMBER`. Allow or deny for an action type reads that role from `ROLE_PERMISSIONS` in `common/authorization/role-permissions.ts`. Call sites do not compare role strings.

1. `@Authorize(permission)` sets the permission and `PermissionGuard` together. The guard rejects a session whose role lacks that permission, and it rejects the request when it runs without a permission. It runs only for HTTP, after the global guards. The global order is `OriginGuard`, then `SessionGuard`. The controller's module imports `AuthorizationModule`.
2. The application service repeats the action check with `requirePermission`, or with a domain helper that calls `hasPermission`. It takes the tenant from `scopedTenantId(context)`. That value is a `TenantId`. The only mint is inside `requestContextFromSession`, which `@CurrentRequest()` uses. There is no public factory. A plain string does not typecheck as a tenant scope. A worker or another service calls the service directly, so the route guard is not the security boundary.
3. Resource scope answers whether this caller may use this row. The actor is `Pick<RequestContext, 'userId' | 'tenantId'>`, so the tenant id is the branded session value. A plain string does not typecheck. `canAccessResource(actor, 'tenant', resource)` allows every caller in the row's tenant. It does not compare the caller with an owner or assignee. A read that must hide another tenant's row returns not-found. Contact create takes the tenant id only from the authenticated context. `requireResourceScope` asserts that invariant. The client does not choose a tenant id. An extra tenant field is `400 VALIDATION_ERROR`, not a 403 from this check.

A query or write that omits `scopedTenantId(context)` is not tenant-safe. Revoking another user stays in the service even when the route already requires `sessions:revoke`. A caller may always revoke their own sessions. That self check is not a permission and is not the contacts tenant scope. Whether a module is enabled for the tenant is a separate check and is not part of this map.

---

## Response and error shape

Successful responses return the resource or operation result under `data`. List responses may include `meta`.

```json
{
  "data": {},
  "meta": {}
}
```

Errors use a stable machine-readable code and do not expose stack traces or internal details.

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found.",
    "requestId": "request-id"
  }
}
```

Validation failures add `fields`. Each entry is a schema path. Submitted values are not copied into the body.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed.",
    "requestId": "request-id",
    "fields": [{ "path": "owner.password" }]
  }
}
```

Successful auth responses stay `{ "data": ... }` and do not add `requestId` to the JSON. Logout stays `204` with no body. Every response, including errors and `204`, sets `X-Request-Id`. The API generates that id and ignores a client-supplied `X-Request-Id`, so callers cannot forge log correlation.

---

## Common rules

- Use resource-oriented paths and correct HTTP methods/status codes.
- Paginate every potentially unbounded collection; cursor vs offset strategy remains TBD.
- Cap page size and validate filtering/sorting fields against an allowlist.
- Support idempotency keys for operations where retries could create duplicate effects.
- Apply explicit CORS, rate limits, timeouts, and request-size limits.
- Webhooks require signature verification, replay protection, deduplication, and durable processing before success is acknowledged.
- Breaking changes require a new API version or a documented compatibility migration.

---

## Endpoint index

| Module                        | Base resource                                                                                                                                                                                                      | Status          | Contract location                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- | ----------------------------------------------------------------------------- |
| Authentication and sessions   | `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session`, `POST /api/v1/auth/sessions/terminate-all`, `POST /api/v1/auth/users/{userId}/sessions/terminate` | Implemented     | [`api/auth.openapi.yaml`](./api/auth.openapi.yaml).                           |
| Tenant organization and users | none                                                                                                                                                                                                               | Foundation only | `Organizations.createWithOwner`. No `POST /organizations` or `POST /tenants`. |
| Contacts                      | TBD                                                                                                                                                                                                                | Planned         | OpenAPI + module documentation                                                |
| Tasks                         | TBD                                                                                                                                                                                                                | Planned         | OpenAPI + module documentation                                                |
| Deals and pipelines           | TBD                                                                                                                                                                                                                | Planned         | OpenAPI + module documentation                                                |
| Restaurant reservations       | `/reservations`                                                                                                                                                                                                    | Foundation only | Runtime schemas in `@lobby/contracts`; endpoints not implemented              |
| Orders and delivery           | TBD                                                                                                                                                                                                                | Conditional     | OpenAPI + module documentation                                                |
| Notifications                 | TBD                                                                                                                                                                                                                | Conditional     | OpenAPI + module documentation                                                |

Add exact methods, paths, permissions, request schemas, response schemas, and error codes only when the corresponding module contract is designed.

Registration, when implemented, belongs to Auth:

```text
POST /api/v1/auth/register
→ validate input
→ normalize subdomain and email
→ hash the password in Auth
→ Organizations.createWithOwner()
→ create the Redis session
→ set a secure HttpOnly cookie
```

- Each User belongs to exactly one Tenant.
- The same normalized email may identify separate User records in different tenants.
- Authentication therefore requires tenant context plus email: subdomain + email + password.
- The first user created with a tenant is always its Owner.
- Tenant, Owner, and `tenant.created` outbox event are committed atomically.
- Password hashing belongs to Auth; Organizations receives only `passwordHash`.
- If session creation fails after that transaction commits, the tenant remains and registration returns a controlled error so the owner can log in later.
- Login is `POST /api/v1/auth/login` with subdomain, email, and password. It finds the user, rejects a non-ACTIVE status, and only then verifies the password hash. A missing tenant, missing user, or disabled user still verifies a fixed unusable Argon2id hash, and every failure returns the same `INVALID_CREDENTIALS` error. Each success creates a new session id.
- Logout is `POST /api/v1/auth/logout`. It deletes `session:<hash>`, removes that hash from `user_sessions:<userId>`, and clears the cookie. A repeated logout, or a logout with a missing or invalid session, still returns `204`. The same cookie on the next protected request is `401`.
- Mutating methods require an allowed `Origin`. A missing `Origin` falls back to the `Referer` origin. Missing both is rejected with `403 ORIGIN_REJECTED`. `SameSite=Lax` and CORS do not replace that check. CORS uses the explicit origin list with credentials and never `*`. If the frontend and API are different sites, a CSRF token is required.
- Login is limited per hashed IP and per hashed subdomain + normalized email. Registration is limited per hashed IP. Repeated invalid session cookies are limited per hashed IP. Counters live in the `rate_limit:` Redis key space. Exceeding a limit returns `429 RATE_LIMITED`. The account limit uses the same response whether or not the account exists. A successful login clears only that account counter.
- Terminating every session for a user increments `users.authentication_version`, then deletes that user's session keys and the `user_sessions:<userId>` index before the call returns. The outbox does not revoke sessions. `POST /api/v1/auth/sessions/terminate-all` does this for the caller and clears that cookie. `POST /api/v1/auth/users/{userId}/sessions/terminate` does it for a user in the same tenant. The application service allows a user to revoke their own sessions, and Owner or Admin to revoke another user in that tenant. A target in another tenant is `403 FORBIDDEN`. `GET /api/v1/auth/session` returns the live user id, role, and tenant id.

### Authentication examples

The executable contract is [`api/auth.openapi.yaml`](./api/auth.openapi.yaml). Registration stays closed unless `REGISTRATION_ENABLED` is exactly `true`.

```http
POST /api/v1/auth/register
Origin: http://localhost:3000
Content-Type: application/json

{
  "tenant": { "name": "Acme", "subdomain": "acme", "plan": "starter" },
  "owner": { "name": "Ada", "email": "ada@example.com", "password": "correct-horse-battery" }
}
```

`201` returns `{ "data": { "tenant": { "id", "name", "subdomain", "plan": "starter" }, "user": { "id", "name", "email", "role": "OWNER" } } }` and `Set-Cookie`. The body does not include the password, `passwordHash`, or the raw session id.

```http
POST /api/v1/auth/login
Origin: http://localhost:3000
Content-Type: application/json

{ "subdomain": "acme", "email": "ada@example.com", "password": "correct-horse-battery" }
```

`200` has the same `data` shape and sets a new session cookie. A missing tenant, missing user, disabled user, or wrong password is `401 INVALID_CREDENTIALS`.

`POST /api/v1/auth/logout` with the session cookie returns `204` and clears it. Repeating logout is still `204`. The same cookie on the next protected request is `401`.

| Code                               | Status | When                                                                                                                      |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `INVALID_CREDENTIALS`              | 401    | Login could not authenticate the account                                                                                  |
| `UNAUTHENTICATED`                  | 401    | No usable session cookie, or the session store timed out while checking it                                                |
| `SESSION_EXPIRED`                  | 401    | Idle or absolute expiry                                                                                                   |
| `SESSION_REVOKED`                  | 401    | Session deleted, version changed, or user disabled                                                                        |
| `ORIGIN_REJECTED`                  | 403    | Mutating request without an allowed Origin or Referer                                                                     |
| `FORBIDDEN`                        | 403    | Caller may not revoke that user's sessions                                                                                |
| `REGISTRATION_DISABLED`            | 403    | `REGISTRATION_ENABLED` is not `true`                                                                                      |
| `VALIDATION_ERROR`                 | 400    | Schema validation failed. `fields` lists paths only                                                                       |
| `REQUEST_REJECTED`                 | 4xx    | Another client error, such as malformed JSON. The body does not echo input                                                |
| `NOT_FOUND`                        | 404    | The resource is missing from the caller's scope                                                                           |
| `TENANT_SUBDOMAIN_TAKEN`           | 409    | Subdomain already exists                                                                                                  |
| `RATE_LIMITED`                     | 429    | Login, register, or invalid-session limit exceeded                                                                        |
| `ACCOUNT_CREATED_SIGN_IN_REQUIRED` | 503    | Tenant committed, but the session was not stored                                                                          |
| `SERVICE_UNAVAILABLE`              | 503    | Session store timed out or could not be reached. Login, logout, and registration before the tenant is saved use this code |
| `INTERNAL_ERROR`                   | 500    | Unexpected failure. The body has no internal text                                                                         |

### Session cookie

| Attribute  | Value                                                  |
| ---------- | ------------------------------------------------------ |
| Name       | `session`                                              |
| Value      | Opaque random id. Redis stores only `session:<sha256>` |
| `HttpOnly` | always                                                 |
| `SameSite` | `Lax`. This does not replace the Origin check          |
| `Secure`   | set when `NODE_ENV=production`                         |
| `Path`     | `/`                                                    |
| `Max-Age`  | idle lifetime, 7 days                                  |

Logout sends a clearing `Set-Cookie` (`Expires` at the epoch, no `Max-Age`).

### Auth environment

| Variable                                                                          | Role                                                                                                                                                                     |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `REGISTRATION_ENABLED`                                                            | Public registration runs only when the value is `true`                                                                                                                   |
| `ALLOWED_ORIGINS`                                                                 | Comma-separated browser origins. No `*`                                                                                                                                  |
| `APP_URL`                                                                         | Origin used when `ALLOWED_ORIGINS` is unset                                                                                                                              |
| `NODE_ENV`                                                                        | `production` marks the session cookie `Secure`                                                                                                                           |
| `RATE_LIMIT_LOGIN_IP_LIMIT` / `RATE_LIMIT_LOGIN_IP_WINDOW_MS`                     | Default 20 attempts / 15 minutes                                                                                                                                         |
| `RATE_LIMIT_LOGIN_ACCOUNT_LIMIT` / `RATE_LIMIT_LOGIN_ACCOUNT_WINDOW_MS`           | Default 10 attempts / 15 minutes                                                                                                                                         |
| `RATE_LIMIT_REGISTER_IP_LIMIT` / `RATE_LIMIT_REGISTER_IP_WINDOW_MS`               | Default 5 attempts / 1 hour                                                                                                                                              |
| `RATE_LIMIT_INVALID_SESSION_IP_LIMIT` / `RATE_LIMIT_INVALID_SESSION_IP_WINDOW_MS` | Default 30 attempts / 5 minutes                                                                                                                                          |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`                             | Session and rate-limit store                                                                                                                                             |
| `SESSION_REDIS_TIMEOUT_MS`                                                        | Upstash session and rate-limit command timeout. Default 3000, maximum 30000                                                                                              |
| `DATABASE_URL`                                                                    | Tenant and user rows. Required at startup                                                                                                                                |
| `PORT`                                                                            | API listen port. Default `3001`. An invalid value fails startup                                                                                                          |
| `TRUST_PROXY`                                                                     | Off by default. Production should list proxy IPs or CIDRs. A hop count is only for a topology where every request crosses the same number of proxies. `true` is rejected |

Reservation endpoints must derive the tenant from the authenticated session, accept UTC timestamps, and never trust a client-provided tenant identifier. The venue timezone controls staff-facing calendar interpretation. Conflict responses must use a stable error code; the exact HTTP contract is deferred until the application service is implemented.

### Contacts

Pilot tenant-scoped resource. `ContactsController` is covered by the global `SessionGuard` and reads `@CurrentRequest()`. It does not install `IdentityExceptionFilter`. Every role may create, read, and update contacts in its own tenant through `contacts:create`, `contacts:read`, and `contacts:update`. The route declares that with `@Authorize`, and the service repeats `requirePermission`. Resource scope is `tenant`: every caller in the tenant may use every contact in that tenant. A contact has no per-user owner. Create copies the tenant id from the authenticated context, then `requireResourceScope` asserts that the new row stays in that tenant. A missing contact and a contact in another tenant are both `404 NOT_FOUND`. Rename updates with `where: { id, tenantId }` and then re-reads through the same tenant scope.

| Method  | Path                    | Body                 | Success                                      |
| ------- | ----------------------- | -------------------- | -------------------------------------------- |
| `POST`  | `/api/v1/contacts`      | `{ "name": string }` | `201 { "data": { "id", "name" } }`           |
| `GET`   | `/api/v1/contacts/:id`  |                      | `200 { "data": { "id", "name" } }`           |
| `PATCH` | `/api/v1/contacts/:id`  | `{ "name": string }` | `200 { "data": { "id", "name" } }`           |

`id` is a UUID. Authentication is the session cookie. Mutations also require an allowed Origin. The response does not include `tenantId`.

---

## Bootstrap conventions

HTTP bootstrap lives in `configureHttpApp`. New controllers inherit it.

- Mount the controller at the resource name, for example `@Controller('contacts')`. The public path is `/api/v1/contacts`. Do not write `v1` in the controller.
- Bind input with `ZodBody`, `ZodQuery`, or `ZodParam`. Those decorators use one Zod pipe. A failure is `VALIDATION_ERROR`.
- JSON object schemas use `z.strictObject`. An unknown field is `400 VALIDATION_ERROR`. Auth login/register and the contacts commands follow this rule. The HTTP foundation probe rejects an extra `leak` field the same way.
- Return `{ data }` for a successful JSON body. Do not add `requestId` to that JSON.
- Throw a module error with a stable `UPPER_SNAKE_CASE` code, or `NotFoundException` for a missing resource. The global filter writes `{ error: { code, message, requestId } }`. `AuthenticationError` and `IdentityError` accept only a catalog code. The client message and status come from that catalog, not from a caller-supplied message or status.
- `SessionGuard` is a global `APP_GUARD`. `AppModule` registers `useExisting: SessionGuard`, so the instance and its required constructor dependencies come from `IdentityModule`. A missing dependency fails at startup. A new controller requires a session. Mark a handler with `@Public()` from `common/auth/public` only when it must run without one: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, and `GET /health`. `@Public()` skips authentication. It does not skip `OriginGuard` or CORS. Declare a route permission with `@Authorize(...)` from `common/authorization/permission.guard`, and import `AuthorizationModule` in that controller's module. Do not register `PermissionGuard` in the feature module. Do not add `@UseGuards(SessionGuard)` or `IdentityExceptionFilter`. Read the caller with `@CurrentRequest()` from `common/auth/current-request`. The global filter maps `IdentityError`, including `401 UNAUTHENTICATED` and `403 FORBIDDEN`.
- Global codes live in `apps/api/src/common/http/http-error-codes.ts` (`VALIDATION_ERROR`, `INTERNAL_ERROR`, `NOT_FOUND`, `REQUEST_REJECTED`). Thrown platform codes live in `api-error.ts` (`ORIGIN_REJECTED`, `RATE_LIMITED`). Module codes stay in that module, as Identity does in `identity.errors.ts`.
- Unexpected failures become `INTERNAL_ERROR`. The server log records the time, request id, method, path, and exception name. It does not record the exception message or stack. The client does not receive the driver message or stack.
- `GET /health` stays outside `/api/v1` for process probes. It is `@Public()`.
- CORS uses the explicit `ALLOWED_ORIGINS` list with credentials. `OriginGuard` is global for mutating methods.
- `helmet` sets the baseline security headers. `Cross-Origin-Resource-Policy` is `cross-origin` because the browser app and the API are different origins. The allowlist still decides who may read the response.
- Startup calls `loadApiConfig()` before creating the Nest app. Invalid or missing required variables stop the process with a name list. Bootstrap then reads the returned config. Feature modules keep their existing readers for the same variables.

### Shutdown

`enableShutdownHooks()` is on. `DatabaseModule.onModuleDestroy` calls Prisma `$disconnect()`. The session and rate-limit store is Upstash over HTTP, so there is no socket to close. A future TCP Redis client or queue worker must close itself from `onModuleDestroy`. The signal handler is not fired inside tests: after destroy, Nest re-sends the signal to the process.

## Endpoint documentation template

```text
METHOD /api/v1/resource
Purpose:
Authentication:
Organization scope:
Required permission:
Request schema:
Success response:
Expected errors:
Idempotency:
Rate limit:
```

---

## Change rules

1. The owning module defines and tests the contract.
2. Public request/response/event changes receive compatibility review.
3. OpenAPI remains synchronized with implemented behavior.
4. Security-sensitive endpoints document authorization and audit behavior explicitly.
5. Deprecated contracts state the replacement and removal plan.

---

## Related documents

- [`BRIEF.md`](./BRIEF.md) — product scope.
- [`TECH_CARD.md`](./TECH_CARD.md) — approved technical decisions.
- [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md) — system and module boundaries.
- [`02-TECH_STACK.md`](./02-TECH_STACK.md) — API technology choices.
- [`05-DATABASE.md`](./05-DATABASE.md) — persistence rules and schema documentation.
- [`api/auth.openapi.yaml`](./api/auth.openapi.yaml) — auth request, response, and error contract.
