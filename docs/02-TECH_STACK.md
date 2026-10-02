# Technology Stack: Lobby

> This document describes the technology that is actually present in the repository. Architecture and invariants belong in [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md); open approvals belong in [`TECH_CARD.md`](./TECH_CARD.md).

- **Project size:** C
- **Current target:** Version 1 / Stage 1
- **Last updated:** 2026-10-01
- **Version:** 1.0
- **Status:** ACTIVE — implemented stack with explicitly listed open production choices.

## Implemented stack

| Layer                    | Technology                                   | Repository baseline                                                                | Responsibility                                               |
| ------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Workspace                | pnpm workspaces + Turborepo                  | pnpm 10; Turbo resolved by the lockfile                                            | Workspace dependency graph, caching, build ordering          |
| Runtime/language         | Node.js + TypeScript                         | Node.js 24; TypeScript 5.9                                                         | Strict shared runtime baseline                               |
| Web                      | Next.js App Router + React                   | Next.js 16; React 19                                                               | Locale-aware web application                                 |
| Localization             | `next-intl`                                  | `hy`, `ru`, `en`; fallback `en`                                                    | Routing and translated UI content                            |
| API                      | NestJS on Express                            | NestJS 11                                                                          | Versioned REST, auth, tenant context, authorization, modules |
| Validation/contracts     | Zod                                          | Zod 4                                                                              | Runtime validation at external and cross-process boundaries  |
| Database                 | PostgreSQL                                   | PostgreSQL 17 for local/CI; managed provider configuration is environment-specific | Authoritative business, audit, and outbox data               |
| ORM/migrations           | Prisma                                       | Prisma 7                                                                           | Typed access, generated client, versioned SQL migrations     |
| Session/rate-limit store | Upstash-compatible Redis REST                | HTTP client with bounded timeout                                                   | Revocable sessions and shared rate-limit counters            |
| Background processing    | Custom TypeScript worker + PostgreSQL outbox | Independently runnable `apps/worker`                                               | Event relay, retries, dispatch, requeue                      |
| Password hashing         | Argon2id                                     | `argon2`                                                                           | Password verification and hash creation in Identity          |
| Security headers         | Helmet                                       | Helmet 8                                                                           | HTTP response hardening                                      |
| Tests                    | Vitest, Nest testing utilities, Supertest    | Real PostgreSQL integration tests where persistence matters                        | Unit, contract, HTTP, DB, and worker verification            |
| Build/package output     | Nest build, Next build, `tsc`, tsup          | CJS/ESM contracts; ESM database package                                            | Runnable apps and typed cross-app packages                   |

Exact installed versions are authoritative in `pnpm-lock.yaml`. Package manifests use compatible version ranges; dependency changes must update and review the lockfile.

## Workspace roles

| Path                 | Runtime role                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/web`           | Next.js frontend. It may import public contracts, never database/runtime internals.                     |
| `apps/api`           | NestJS modular-monolith HTTP process and business-module composition root.                              |
| `apps/worker`        | Transactional-outbox relay and event-dispatch process.                                                  |
| `packages/contracts` | Framework-light Zod schemas, inferred types, event versions, locales, and common pagination primitives. |
| `packages/database`  | Prisma schema, migrations, generated client, database configuration, and test DB helper.                |

## API foundation

The API currently provides:

- global `/api/v1` routing with unversioned `GET /health`;
- global session authentication with explicit `@Public()` exceptions;
- Zod request validation and a stable error envelope;
- server-generated request IDs and request-aware logging;
- credentialed CORS allowlisting and mutation Origin/Referer checks;
- Helmet headers and validated trust-proxy configuration;
- startup environment validation and Prisma shutdown hooks.

Startup validation is implemented, but some feature providers still reread `process.env`. Consolidating them behind one immutable DI configuration object is a planned foundation improvement.

## Authentication and authorization

| Concern          | Implemented choice                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Login identifier | Tenant subdomain + email + password                                                           |
| Password storage | Argon2id hash; plaintext never enters Organizations                                           |
| Session          | Opaque Redis-backed session, `HttpOnly` cookie, idle and absolute expiry                      |
| Revocation       | Logout, terminate-all, targeted admin revocation, authentication-version invalidation         |
| Roles            | `OWNER`, `ADMIN`, `MEMBER`                                                                    |
| Authorization    | Route and service permissions, tenant module entitlement, tenant/resource scope               |
| Tenant RBAC      | Protected Owner role plus planned tenant-defined roles built from a closed permission catalog |
| Audit            | Append-only PostgreSQL history for access changes and important business transitions          |
| Tenant model     | One user row belongs to exactly one tenant; no membership table                               |

Email verification, password recovery, invitations, OAuth/OIDC, and device management are not implemented and require product/provider decisions.

## Database and asynchronous delivery

- PostgreSQL is the source of truth. Redis is not authoritative business storage.
- Prisma schema and migrations live in `packages/database/prisma`.
- API business writes that require asynchronous publication write the outbox row in the same transaction.
- The worker dispatches by exact `eventType@eventVersion`; unknown and invalid events fail closed.
- External side-effect handlers must use the durable `processed_events` reservation.
- BullMQ is not part of the current implementation. Add a queue only when delayed/scheduled/high-volume work requires it.
- RLS is not enabled. Tenant isolation currently uses session-derived application scope and tenant-safe database relationships.

Production still needs provider-specific pool limits, database timeouts, least-privilege runtime/migration roles, backups/PITR, restore testing, and release migration ownership.

## Frontend baseline

The web application builds and has locale routes/messages for Armenian, Russian, and English. The contacts screen at `/{locale}/contacts` lists, creates, updates, archives, and restores contacts through `/api/v1/contacts`. It keeps filters in the URL and does not invent totals, merge, tags, or cross-module counts. Broad feature UI work still needs explicit choices for:

- design tokens and component primitives;
- API client and server-state/cache strategy;
- form composition around shared Zod contracts;
- session bootstrap and normalized API errors;
- component and browser E2E testing.

Do not create `packages/ui` until a stable reusable UI boundary actually exists.

## Testing and CI

GitHub Actions currently runs:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm build`

The CI PostgreSQL service runs PostgreSQL 17. Turbo builds dependency packages before lint/typecheck/test consumers resolve their `dist` declarations.

Known gaps:

- Database integration tests use isolated schemas, but still require the local/CI PostgreSQL service to be available.
- The CI formatting gate intentionally excludes generated output, migrations, archived/reference docs, and local agent/tool folders.
- The web and database packages currently use `--passWithNoTests` and contain no direct test files.
- No Playwright flow or generated OpenAPI compatibility check is configured.
- Dependabot updates GitHub Actions only; npm/pnpm dependency updates are not enabled.

## Observability and operations

Implemented foundations are request IDs, safe API errors, Nest logging, audit history, and structured worker dispatch errors. Production operations still require metrics, alerting, error tracking, telemetry retention/redaction ownership, worker backlog/failure alerts, and recovery runbooks. Web and CDN access logs for `/:locale/invitations/accept` must omit or redact the query string, because the invitation email puts the raw token there for the first request.

`GET /health` is currently liveness only. Add dependency readiness checks before deployment orchestration relies on it.

## Deployment status

No production platform is approved in this document. Vercel remains a candidate for the web application; the API and worker require an approved Node/container runtime. The web origin and the API origin must be the same site so `SameSite=Lax` session and invitation cookies are sent. `app.example.com` with `api.example.com` fits. A web host and an API host on different sites do not. Development, staging, and production must use separate credentials and resources.

Production migrations must run once through a designated release job. They must not run from application startup, request paths, builds, or routine developer laptops.

## Environment contract

| Variable/category      | Consumer             | Rule                                                                       |
| ---------------------- | -------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`         | API/worker           | Runtime connection; use least privilege in deployed environments           |
| `DIRECT_URL`           | Prisma migration job | Direct migration connection; do not expose to ordinary runtimes            |
| Upstash URL/token      | API                  | Session and rate-limit Redis REST access                                   |
| `AUDIT_IP_HASH_KEY`    | API                  | Independent 32-byte key represented as 64 lowercase hexadecimal characters |
| `ALLOWED_ORIGINS`      | API                  | Explicit origins; no credentialed wildcard                                 |
| `TRUST_PROXY`          | API                  | Exact trusted proxy IP/CIDR or a safe fixed hop count                      |
| `REGISTRATION_ENABLED` | API                  | Explicit registration switch                                               |
| `NEXT_PUBLIC_*`        | Web                  | Only intentionally public, non-secret values                               |

Real values remain in ignored local environment files or the deployment secret manager. `.env.example` contains names and safe examples only.

## Related documents

- [`TECH_CARD.md`](./TECH_CARD.md) — implemented and open decisions.
- [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md) — boundaries, flows, security, and scaling.
- [`03-STRUCTURE.md`](./03-STRUCTURE.md) — current repository ownership and target module shape.
- [`04-API.md`](./04-API.md) — HTTP/auth/error contracts and endpoint inventory.
- [`05-DATABASE.md`](./05-DATABASE.md) — schema, tenancy, migrations, outbox, and constraints.
- [`DECISIONS.md`](./DECISIONS.md) — accepted ADR index.
