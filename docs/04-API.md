# API Documentation: Lobby

> This document records the logical REST API contract. It starts intentionally small and should be updated alongside implemented endpoints and generated OpenAPI documentation.

- **Style:** Versioned REST
- **Owner:** NestJS API
- **Version:** 0.3
- **Status:** ACTIVE — HTTP foundation, auth/session, contacts pilot, and audit listing are implemented; other business endpoints remain planned.

---

## Documentation approach

- OpenAPI generated from NestJS controllers and DTOs is the executable API reference.
- This document explains cross-cutting rules and provides a readable endpoint index.
- Module-specific details stay with their owning module until they become public contracts.
- Every endpoint change updates its DTO/schema, tests, OpenAPI output, and this index when relevant.

---

## Base contract

| Concern        | Current rule                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Base path      | `/api/v1`, set once in HTTP bootstrap. Controllers do not repeat `v1`. `GET /health` has no version prefix.          |
| Format         | JSON over HTTPS                                                                                                      |
| Authentication | Opaque server-side session. `POST /api/v1/auth/login` sets the session cookie. `POST /api/v1/auth/logout` clears it. |
| Tenant context | Copied from the validated session. A client tenant id is not a source of scope.                                      |
| Validation     | `z.strictObject` on JSON bodies. An unknown field, including `tenantId`, is `400 VALIDATION_ERROR`.                  |
| Dates          | ISO 8601 UTC in API payloads unless a contract explicitly states otherwise                                           |
| Identifiers    | UUIDs in the current persistence/API contracts; clients treat them as opaque stable strings                          |
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
→ the service runs the authorization chain, then the operation
→ return the documented response or error
```

Handlers do not read a tenant id from the body, query, or headers. The client must never rely on hidden UI state as proof of authorization.

A protected business operation runs this chain. A later step does not replace an earlier one.

1. Authenticated. `SessionGuard` accepts an active session, unless the route is `@Public()`.
2. Module enabled. Take the tenant with `scopedTenantId(context)`, then `moduleEntitlements.requireEnabled(tenantId, module)`, then `requirePermission`. A missing `tenant_modules` row and a `DISABLED` row are both `403 MODULE_DISABLED`. That code is not `FORBIDDEN`. A role that has the permission still cannot use a disabled module. Identity and health are not optional modules. User preference is not part of this decision.
3. Action permission. The session role is `OWNER`, `ADMIN`, or `MEMBER`. Allow or deny reads `ROLE_PERMISSIONS`. `@Authorize(permission)` sets that permission and `PermissionGuard` together. The guard is not global. `route-authorization.test.ts` fails when a non-public business handler has no `@Authorize`. `GET /auth/session` and `POST /auth/sessions/terminate-all` are the caller's own session and are the only authenticated exceptions. The service repeats the check with `requirePermission`, because a worker can call the service without the guard. New modules use one key per action, such as `deals:create` and `deals:delete`. Do not collapse different risks into one `deals:manage` key.
4. Tenant scope. The service takes the tenant from `scopedTenantId(context)`. That value is a `TenantId`. The only mint is inside `requestContextFromSession`. A plain string does not typecheck. Contact persistence uses `ContactRepository.forTenant(context)`. That object is bound to the same tenant, and its methods do not accept a tenant id. Every contact query includes that tenant.
5. Resource scope. `canAccessResource(actor, 'tenant', resource)` allows every caller in the row's tenant. The actor is `Pick<RequestContext, 'userId' | 'tenantId'>`. Further scopes, such as assigned user or creator, are added only when that module has a real rule. Contact create copies the tenant id from the authenticated context, then `requireResourceScope` asserts that invariant. The client does not choose a tenant id. An extra tenant field is `400 VALIDATION_ERROR`.

A query or write that omits `scopedTenantId(context)` is not tenant-safe. Revoking another user stays in the service even when the route already requires `sessions:revoke`. A caller may always revoke their own sessions. That self check is not a permission and is not the contacts tenant scope.

Audit is separate from access enforcement. Session-termination success/denial records and the permissioned audit-list endpoint are implemented. Role changes, assignments, business status transitions, and general permission denials must add audit records when those operations are implemented. PostgreSQL row-level security is not part of this foundation; tenant isolation currently uses application query scope plus tenant-safe constraints.

### Planned role and permission settings

Tenant access-management endpoints will let an Owner, or an Admin with the explicit access-management permission, list/create/update/disable tenant roles, choose permissions from the server-owned permission catalog, and assign one approved role to a tenant user. The API will never accept arbitrary permission strings, tenant ids, platform permissions, or an `OWNER` role definition from the client. It must reject privilege escalation, cross-tenant targets, disabling an assigned role without an approved replacement, and removal of the final active Owner.

Role definition changes, permission-set changes, assignments, and denied attempts are auditable. A successful assignment updates authorization state, increments the affected user's `authenticationVersion`, and inserts its audit event in one database transaction. Redis session removal follows the committed version change, so an old session cannot retain permissions if cache cleanup is interrupted.

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
- Paginate unbounded collections with `{ data, page: { nextCursor } }`. `limit` defaults to 50 and cannot exceed 100. `sort` is only `asc` or `desc`. Each resource defines its own filters and cursor payload. Audit history binds its cursor to that resource's filters. Offset pagination stays for small, stable lists. A client cannot send a column name or a Prisma `orderBy`.
- Cap page size and validate filtering/sorting fields against that resource's allowlist.
- Support idempotency keys for operations where retries could create duplicate effects.
- Apply explicit CORS, rate limits, timeouts, and request-size limits.
- Webhooks require signature verification, replay protection, deduplication, and durable processing before success is acknowledged.
- Breaking changes require a new API version or a documented compatibility migration.

---

## Endpoint index

| Module                        | Base resource                                                                                                                                                                                                      | Status            | Contract location                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------ |
| Authentication and sessions   | `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/session`, `POST /api/v1/auth/sessions/terminate-all`, `POST /api/v1/auth/users/{userId}/sessions/terminate` | Implemented       | [`api/auth.openapi.yaml`](./api/auth.openapi.yaml).                            |
| Audit history                 | `GET /api/v1/audit-events`                                                                                                                                                                                         | Implemented       | `audit:read`. Cursor page. No module entitlement.                              |
| Tenant organization and users | none                                                                                                                                                                                                               | Foundation only   | `Organizations.createWithOwner`. No `POST /organizations` or `POST /tenants`.  |
| Contacts                      | `POST /api/v1/contacts`, `GET /api/v1/contacts/{contactId}`, `PATCH /api/v1/contacts/{contactId}`                                                                                                                  | Implemented pilot | Runtime Zod schemas, controller/service/repository tests; full OpenAPI pending |
| Tasks                         | TBD                                                                                                                                                                                                                | Planned           | OpenAPI + module documentation                                                 |
| Deals and pipelines           | TBD                                                                                                                                                                                                                | Planned           | OpenAPI + module documentation                                                 |
| Restaurant reservations       | `/reservations`                                                                                                                                                                                                    | Foundation only   | Runtime schemas in `@lobby/contracts`; endpoints not implemented               |
| Orders and delivery           | TBD                                                                                                                                                                                                                | Conditional       | OpenAPI + module documentation                                                 |
| Notifications                 | TBD                                                                                                                                                                                                                | Conditional       | OpenAPI + module documentation                                                 |

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
- Terminating every session for a user increments `users.authentication_version` and inserts one `audit_events` row for `user.sessions.terminated` in the same transaction, then deletes that user's session keys and the `user_sessions:<userId>` index. If the audit insert fails, the version increment rolls back. A denial writes `DENIED` with no version change. The row stores an HMAC-SHA256 hex of the client address keyed with `AUDIT_IP_HASH_KEY`, never the raw IP, and never a password, hash, session id, or token. `audit:read` lets Owner and Admin list their own tenant's rows with `GET /api/v1/audit-events`. The outbox does not revoke sessions. `POST /api/v1/auth/sessions/terminate-all` does this for the caller and clears that cookie. `POST /api/v1/auth/users/{userId}/sessions/terminate` does it for a user in the same tenant. The application service allows a user to revoke their own sessions, and Owner or Admin to revoke another user in that tenant. A target in another tenant is `403 FORBIDDEN`. `GET /api/v1/auth/session` returns the live user id, role, and tenant id.

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
| `MODULE_DISABLED`                  | 403    | The tenant does not have this module enabled. This is not a role denial                                                   |
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

Pilot tenant-scoped resource. `ContactsController` is covered by the global `SessionGuard` and reads `@CurrentRequest()`. It does not install `IdentityExceptionFilter`. Every role may create, read, and update contacts in its own tenant through `contacts:create`, `contacts:read`, and `contacts:update`. The route declares that with `@Authorize`. The service calls `requireEnabled` for `contacts` and then repeats `requirePermission`. Resource scope is `tenant`: every caller in the tenant may use every contact in that tenant. A contact has no per-user owner. Create copies the tenant id from the authenticated context, then `requireResourceScope` asserts that the new row stays in that tenant. A missing contact and a contact in another tenant are both `404 NOT_FOUND`. Rename and read go through the tenant-bound contact repository, then the service re-reads through that same binding.

| Method  | Path                   | Body                 | Success                            |
| ------- | ---------------------- | -------------------- | ---------------------------------- |
| `POST`  | `/api/v1/contacts`     | `{ "name": string }` | `201 { "data": { "id", "name" } }` |
| `GET`   | `/api/v1/contacts/:id` |                      | `200 { "data": { "id", "name" } }` |
| `PATCH` | `/api/v1/contacts/:id` | `{ "name": string }` | `200 { "data": { "id", "name" } }` |

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
- Startup calls `loadApiConfig()` before creating the Nest app. Invalid or missing required variables stop the process with a variable-name list and no secret values. Bootstrap uses the returned HTTP config. Some feature providers still reread the validated environment; consolidating all lookups behind one immutable DI config object is open foundation work.

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
