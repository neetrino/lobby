# Technical Decision Card: Lobby

> This file records the technical decisions that are already implemented and the decisions that remain open. Implementation detail belongs in [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md), [`02-TECH_STACK.md`](./02-TECH_STACK.md), and ADRs.

- **Project:** Lobby
- **Stage:** Version 1 / Stage 1 implementation
- **Last updated:** 2026-10-01
- **Version:** 1.0
- **Status:** ACTIVE — the foundation is implemented; unresolved production and product choices remain explicitly open below.

## Status legend

| Status      | Meaning                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| Implemented | Present in the repository and covered by the project checks described below.       |
| Confirmed   | Approved invariant or direction; implementation may be incremental.                |
| Partial     | A usable foundation exists, but listed work remains.                               |
| Unresolved  | A decision is still required before the affected capability or production release. |
| Conditional | Add only when an approved feature requires it.                                     |

## 1. Foundation

| Decision area     | Current decision                                                     | Status                                 |
| ----------------- | -------------------------------------------------------------------- | -------------------------------------- |
| Project size      | Size C                                                               | Confirmed                              |
| Repository        | TypeScript monorepo with pnpm workspaces and Turborepo               | Implemented                            |
| Backend topology  | NestJS modular monolith plus an independently runnable outbox worker | Implemented                            |
| Runtime           | Node.js 24; TypeScript 5.9 with strict checking                      | Implemented                            |
| Package naming    | Internal packages use the `@lobby/*` namespace                       | Implemented                            |
| Git workflow      | Short-lived branches and pull requests are currently used            | Confirmed                              |
| Commit convention | Conventional Commits configuration exists                            | Partial — enforcement is not a CI gate |

## 2. Frontend

| Decision area                        | Current decision                                                                    | Status                                         |
| ------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| Framework                            | Next.js 16 App Router with React 19                                                 | Implemented foundation                         |
| Internationalization                 | `next-intl`; Armenian (`hy`), Russian (`ru`), and English (`en`)                    | Implemented foundation                         |
| Default/fallback locale              | English (`en`)                                                                      | Confirmed                                      |
| Rendering                            | Server Components by default; client boundaries only when interaction requires them | Confirmed                                      |
| Shared validation                    | Zod contracts may be reused by web and API; the API always validates again          | Confirmed                                      |
| Design system and styling            | No final UI kit or token system selected                                            | Unresolved before broad UI development         |
| API client and server-state strategy | Not implemented                                                                     | Unresolved before broad feature UI development |
| Component/E2E tests                  | No web test suite yet                                                               | Partial                                        |

## 3. API and runtime configuration

| Decision area         | Current decision                                                        | Status                                                      |
| --------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| Framework/adapter     | NestJS 11 on Express                                                    | Implemented                                                 |
| API style             | Versioned REST under `/api/v1`; `GET /health` is unversioned            | Implemented                                                 |
| Validation            | Zod at external boundaries with strict object schemas                   | Implemented                                                 |
| Error contract        | Stable `{ error: { code, message, requestId, fields? } }` envelope      | Implemented                                                 |
| Success contract      | `{ data }`; cursor lists additionally return `{ page: { nextCursor } }` | Implemented                                                 |
| Request correlation   | Server-generated `X-Request-Id` and request-aware logging               | Implemented                                                 |
| Startup configuration | Central startup validation exists                                       | Partial — some feature providers still reread `process.env` |
| Health                | Lightweight liveness endpoint                                           | Implemented; dependency readiness is still open             |
| API documentation     | Auth OpenAPI plus module/API documentation                              | Partial — generated full API OpenAPI is not present         |

## 4. Database, cache, and background work

| Decision area                                                      | Current decision                                                                  | Status                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------- |
| Primary database                                                   | PostgreSQL; PostgreSQL 17 is used by local/CI infrastructure                      | Implemented                               |
| ORM/migrations                                                     | Prisma 7 with versioned SQL migrations                                            | Implemented                               |
| Tenant model                                                       | Shared database; one user belongs to exactly one tenant; no membership join table | Implemented invariant                     |
| Tenant isolation                                                   | Session-derived application scope plus composite tenant foreign keys              | Implemented; RLS is not enabled           |
| Runtime URL                                                        | `DATABASE_URL`; pooled connections may be used by the provider                    | Implemented configuration                 |
| Migration URL                                                      | `DIRECT_URL`; reserved for migration operations                                   | Implemented configuration                 |
| Sessions/rate limits                                               | Upstash-compatible Redis REST clients with bounded timeouts                       | Implemented                               |
| Cache                                                              | No general application cache                                                      | Not needed until measured use cases exist |
| Async delivery                                                     | PostgreSQL transactional outbox and separate worker                               | Implemented                               |
| External-effect deduplication                                      | `processed_events` durable reservation                                            | Implemented foundation                    |
| BullMQ                                                             | Not used by the current worker                                                    | Conditional                               |
| Production DB roles, pool limits, timeouts, backups, PITR, RPO/RTO | Provider-specific decisions not completed                                         | Unresolved before production              |

## 5. Authentication, authorization, and tenancy

| Decision area                                       | Current decision                                                                         | Status                                       |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| Login                                               | Tenant subdomain + normalized email + password                                           | Implemented                                  |
| Password hashing                                    | Argon2id in Identity; Organizations accepts only `passwordHash`                          | Implemented                                  |
| Session strategy                                    | Opaque, revocable Redis-backed session in an `HttpOnly` cookie                           | Implemented                                  |
| Session lifecycle                                   | Idle and absolute expiry, sliding renewal, logout, terminate-all, authentication version | Implemented                                  |
| Global authentication                               | `SessionGuard` is global; explicitly public routes use `@Public()`                       | Implemented                                  |
| Authorization                                       | Permission + tenant module entitlement + tenant/resource scope                           | Implemented foundation                       |
| Roles                                               | `OWNER`, `ADMIN`, `MEMBER`                                                               | Implemented                                  |
| Module activation                                   | `tenant_modules`; a missing row is disabled                                              | Implemented                                  |
| CSRF boundary                                       | Credentialed CORS allowlist plus Origin/Referer validation for mutations                 | Implemented for the current same-site design |
| Password recovery                               | One-time emailed token, 30-minute expiry, authentication version bump                   | Implemented                                  |
| Member invitations                              | Owner/Admin invite, accept, revoke, and resend                                          | Implemented                                  |
| Email verification and OAuth/OIDC               | No provider or flow implemented                                                          | Unresolved by capability                     |

## 6. Implemented modules and shared capabilities

| Area             | Current repository state                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity         | Registration, login, logout, session lookup/revocation, rate limits, cookie/session security                                                                                |
| Organizations    | Transactional tenant + first ACTIVE OWNER + default entitlements + `tenant.created` outbox event                                                                            |
| Contacts         | Create, read, update, soft archive, and restore, plus the web screen at `/{locale}/contacts`. Permissions, entitlement, tenant scope, and `contact.created` stay in the API |
| Dashboard        | Read-only `GET /api/v1/dashboard` and per-user layout. Contacts, reservation, and accepted-invitation projections. Deals, messenger, and inventory stay hidden until those modules expose a projection |
| Audit            | Append-only events, HMAC-hashed client IP metadata, permissioned cursor-paginated read API                                                                                  |
| Tenant RBAC      | Current fixed roles; planned Owner/Admin-managed tenant roles from a closed permission catalog with anti-escalation rules                                                   |
| Reservations     | Contracts, schema, cross-tenant constraints, overlap prevention, status policy, and a read-only dashboard projection. Reservation write endpoints are not implemented |
| Deals            | Module boundary only; no business implementation                                                                                                                            |
| Messenger        | Module boundary only; no business implementation                                                                                                                            |
| Worker           | Versioned dispatch registry, retry classification, durable side-effect reservation, failed-event requeue                                                                    |
| Shared contracts | Runtime Zod schemas for events, locales, reservations, audit, module keys, and cursor pagination primitives                                                                 |

## 7. Security and operations

| Control                                   | Current state                                                                    | Status                       |
| ----------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------- |
| CORS, Origin policy, Helmet, trust proxy  | Configured and tested                                                            | Implemented                  |
| Secret handling                           | Real `.env` is ignored; `.env.example` documents names                           | Implemented local contract   |
| Audit trail                               | First sensitive flow implemented; retention and production DB grants remain open | Partial                      |
| Structured logs                           | Request IDs and safe error mapping exist                                         | Partial                      |
| Metrics, tracing, alerting, error tracker | Not selected or implemented                                                      | Unresolved before production |
| Dependency updates                        | GitHub Actions updates enabled; npm/pnpm Dependabot is not enabled               | Partial                      |
| Recovery                                  | No tested production restore or incident runbook                                 | Unresolved before production |

## 8. Testing and CI

| Area                       | Current state                                                                            | Status                        |
| -------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------- |
| CI                         | GitHub Actions runs frozen install, lint, typecheck, tests, and build with PostgreSQL 17 | Implemented                   |
| Clean task graph           | Lint/typecheck/test build dependency packages before resolving their declarations        | Implemented                   |
| Unit/contract tests        | Vitest                                                                                   | Implemented                   |
| API integration tests      | Nest testing utilities + Supertest                                                       | Implemented                   |
| Database integration tests | Real local/CI PostgreSQL, deployed migrations, and a unique disposable schema per client | Implemented and parallel-safe |
| Web tests                  | No test files                                                                            | Open                          |
| Formatting                 | Script exists but is not a passing CI gate                                               | Open                          |
| Production build           | API, web, worker, contracts, and database build successfully                             | Implemented                   |

## 9. Current quality warning

The shared API integration-test database is not safely isolated between test files. The full suite can fail because one suite truncates rows while another suite uses the same database. A failed full run on 2026-10-01 produced two audit-test constraint failures, while the same audit file passed alone. Fix this before increasing the number of database integration tests.

## 10. Decisions still required before production

1. Hosting, regions, domains, TLS termination, and exact trust-proxy topology.
2. Separate production runtime/migration database roles, pool limits, and database timeouts.
3. Backup retention, restore testing, RPO/RTO, deployment rollback, and migration-job ownership.
4. Metrics, alerting, error tracking, log retention/redaction ownership, and worker-failure operations.
5. Audit retention and database-level append-only grants.
6. Email verification and OAuth/OIDC providers if those flows enter scope. Password recovery and invitations already use the configured mail provider.
7. Object storage, messaging providers, realtime, payments, and webhooks only when approved modules require them.

These items do not block isolated business-module development. Every new module must follow the authorization, tenant-scoped persistence, validation, transaction, audit/event, and testing rules documented in the linked architecture documents.
