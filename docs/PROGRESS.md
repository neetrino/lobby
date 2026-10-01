# Development Progress

This is the living procedural backlog. Product scope belongs in `BRIEF.md`, current technical decisions in `TECH_CARD.md`, and architecture-significant decisions in `DECISIONS.md` and `docs/architecture/`.

## Implemented foundation

| Area                                                                                                   | Status |
| ------------------------------------------------------------------------------------------------------ | ------ |
| pnpm/Turborepo monorepo, clean dependency build graph                                                  | Done   |
| Next.js web foundation and `hy`/`ru`/`en` locale resources                                             | Done   |
| NestJS HTTP bootstrap, `/api/v1`, validation, errors, request IDs, CORS/Origin, Helmet, shutdown       | Done   |
| Tenant + first ACTIVE OWNER transaction and one-user/one-tenant invariant                              | Done   |
| Argon2id login/registration and revocable Redis sessions                                               | Done   |
| Global session authentication, permissions, module entitlements, tenant/resource scope                 | Done   |
| Prisma schema/migrations and local/CI PostgreSQL integration infrastructure                            | Done   |
| Transactional outbox, versioned worker registry, retries, durable external-effect reservation, requeue | Done   |
| Contacts reference vertical slice and cross-tenant HTTP/DB tests                                       | Done   |
| Reservation schema/constraints/contracts/status-policy foundation                                      | Done   |
| Append-only audit foundation, HMAC IP metadata, and cursor-paginated tenant read endpoint              | Done   |
| Shared cursor-page, page-limit, and sort-direction contracts                                           | Done   |
| Parallel-safe DB integration tests with a disposable PostgreSQL schema per client                      | Done   |
| CI-enforced production module boundaries and repository formatting                                     | Done   |

## Immediate foundation work

| Priority | Work                                                                                               | Reason                                            |
| -------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| High     | Keep `TECH_CARD`, architecture, API, database, and structure docs synchronized with implementation | Agents and reviewers use them as decision sources |
| High     | Replace repeated feature `process.env` reads with one validated immutable config provider          | Prevent validation/runtime configuration drift    |

## Module development baseline

New business modules should follow the Contacts vertical slice where applicable:

1. approve the module's business rules, resource scope, permissions, and entitlement behavior;
2. add domain/application/infrastructure/presentation layers only when they have real responsibilities;
3. bind all persistence through the authenticated tenant context;
4. define transaction/concurrency and idempotency behavior before writes;
5. add audit records for sensitive actions and outbox events only for real asynchronous consumers;
6. add unit, database, cross-tenant HTTP, contract, and authorization coverage appropriate to the risk;
7. update `04-API.md`, `05-DATABASE.md`, contracts, and an ADR when the decision is architecture-significant.

## Production work still open

- hosting, environment regions, proxy/network topology, domains, and TLS ownership;
- least-privilege database roles, pool/timeouts, production migration job, backups/PITR, restore tests, RPO/RTO;
- dependency scanning, metrics, tracing, alerting, error tracking, audit retention, and incident/recovery runbooks;
- readiness checks for PostgreSQL/session dependencies;
- web API client, auth bootstrap, UI system, component tests, and browser E2E flows;
- provider-specific email, storage, messaging, realtime, notification, and payment decisions only when required.

Update this file when work is completed, blocked, or reprioritized. Do not duplicate detailed implementation documentation here.
