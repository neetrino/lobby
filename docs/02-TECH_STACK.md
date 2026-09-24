# Technology Stack: Lobby

> Lobby is planned as a TypeScript monorepo with a Next.js web application and a NestJS modular-monolith API. This document records the proposed technology families and their responsibilities; it does not replace approval in `TECH_CARD.md`.

**Project size:** C (proposed)  
**Current target:** Stage 1 / MVP  
**Last updated:** 2026-09-24  
**Version:** 0.1-draft  
**Status:** DRAFT — reconcile with the completed [`BRIEF.md`](./BRIEF.md) and approved [`TECH_CARD.md`](./TECH_CARD.md).  
**Document boundary:** Architecture and invariants belong in [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md); this file owns technology families, version policy, runtime roles, and provider choices.

---

## Status legend

| Status | Meaning |
|---|---|
| Proposed | Recommended for the current architecture but not approved until TECH_CARD sign-off. |
| Conditional | Add only when an approved MVP capability requires it. |
| TBD | A decision or compatibility check is still required. |
| Required practice | Technology-independent constraint that applies to any approved implementation. |

---

## Stack summary

| Layer | Proposed technology | Target family | Status | Responsibility |
|---|---|---|---|---|
| Monorepo | pnpm workspaces + Turborepo | Exact compatible versions TBD | Proposed | Dependency management, workspace boundaries, and cached task orchestration. |
| Language/runtime | TypeScript + Node.js LTS | TypeScript 5.9 family; Node.js 24 LTS target | Proposed | One strict language/runtime baseline across web, API, workers, and shared packages. |
| Web | Next.js App Router + React | Next.js 16 family; React 19 family | Proposed | Server-first web UI, routing, rendering, metadata, and browser interaction boundaries. |
| API | NestJS | NestJS 11 family | Proposed | REST API, authentication boundary, tenant context, authorization, validation, and module orchestration. |
| Database | PostgreSQL | PostgreSQL 17 family | Proposed | Authoritative tenant, business, audit, and transactional-outbox data. |
| Database toolkit | Prisma ORM and migrations | Prisma 7 family | Proposed; compatibility check required | Typed database access and versioned schema migrations. |
| Ephemeral state | Redis | Redis 7 or compatible managed service | Proposed | Revocable sessions, bounded caching, rate limits, and queue state. |
| Background work | BullMQ | Exact compatible version TBD | Conditional | Durable jobs, retries, and idempotent consumers when async MVP use cases are approved. |
| API contract | OpenAPI via NestJS Swagger tooling | Compatible with selected NestJS version | Proposed | Machine-readable REST contract and generated/reference documentation. |
| Validation | NestJS DTO validation; shared runtime schemas where contracts cross apps | Library choice/version TBD | Proposed | Validate every external boundary without treating TypeScript types as runtime validation. |
| Styling | Tailwind CSS | Tailwind CSS 4 family | Proposed | Token-driven application styling. |
| UI components | Existing/custom primitives, optionally shadcn/ui | TBD before UI implementation | Conditional | Accessible reusable components without coupling business modules to a vendor kit. |
| Testing | Vitest, Supertest, React Testing Library, Playwright | Exact compatible versions TBD | Proposed by test layer | Unit, integration, API, component, and browser-level verification selected by risk. |
| Logging | Pino-compatible structured logger | Exact version TBD | Proposed | JSON production logs, correlation IDs, and redaction. |

Exact package versions are pinned in the lockfile when the applications are initialized. Before pinning, verify the supported Node.js, React, TypeScript, Prisma, and NestJS compatibility ranges from primary documentation; do not assume every target-family combination is compatible.

---

## Foundation and repository tooling

| Concern | Decision | Status | Notes |
|---|---|---|---|
| Repository model | Monorepo with `apps/*` and `packages/*` | Proposed | Matches the proposed Size C architecture; do not create empty packages without a real owner. |
| Package manager | pnpm | Proposed | Use one lockfile and frozen/locked installs in CI. |
| Task orchestration | Turborepo | Proposed | Cache deterministic lint, typecheck, test, and build tasks; secrets and environment-specific output are not cached. |
| TypeScript | `strict: true` | Required practice | No unjustified `any`; shared contracts must remain runtime-validatable at external boundaries. |
| Formatting | Prettier | Proposed | Existing repository configuration remains authoritative. |
| Linting | ESLint | Proposed | Use framework-supported flat/config format compatible with the selected versions. |
| Commits | Conventional Commits + commitlint | Proposed | Existing repository configuration remains authoritative. |
| Git workflow | TBD in TECH_CARD | TBD | Choose trunk-based or short-lived feature branches before implementation. |

### Proposed workspace ownership

```text
apps/web/          Next.js web application
apps/api/          NestJS REST API and functional modules
apps/worker/       Conditional outbox relay and queue consumers
apps/scheduler/    Conditional scheduled-job registration
packages/contracts/  Versioned cross-application API/event contracts
packages/database/   Prisma schema, migrations, and database tooling
```

---

## Frontend — Next.js

| Concern | Proposed choice | Status | Rationale / boundary |
|---|---|---|---|
| Framework | Next.js App Router | Proposed | Fits the separate web application while supporting server-first rendering and route-level loading/error behavior. |
| Rendering | React Server Components by default | Required practice | Add client components only at the smallest interactive boundary. |
| Styling | Tailwind CSS with project tokens | Proposed | Keeps styling consistent; token definitions and component standards require design approval. |
| UI primitives | Custom/existing primitives; shadcn/ui only if selected | TBD | Decide before broad UI implementation; accessibility and reuse matter more than library choice. |
| Server data | Server-side fetches to the NestJS API where appropriate | Proposed | The browser must never connect directly to PostgreSQL or Redis. |
| Client server-state | Add TanStack Query only for interaction-heavy client caching | Conditional | Do not install it when server rendering and route refresh are sufficient. |
| Local/shared UI state | React state/context first; Zustand only for justified cross-tree client state | Conditional | Avoid duplicating authoritative API state in a global client store. |
| Forms | React Hook Form plus approved runtime schema library, or Server Actions where architecture permits | TBD | Choose per form complexity and API boundary; the NestJS API remains authoritative for validation. |
| Images | `next/image` | Proposed | Remote-host allowlists and storage/CDN behavior require provider configuration. |
| Internationalization | `next-intl` or equivalent | Conditional | Languages, locale routing, and RTL needs must come from the BRIEF. |
| SEO/metadata | Next.js Metadata API and JSON-LD where public discovery matters | Conditional | Internal authenticated CRM screens do not need public SEO work. |
| Realtime client | WebSocket/SSE client selected with gateway design | Conditional | Realtime messages are UI hints, not the durable business-event path. |

The Next.js application is a presentation and interaction boundary. It does not own authorization decisions, database access, migration execution, queue consumption, or server secrets.

---

## Backend — NestJS

| Concern | Proposed choice | Status | Rationale / boundary |
|---|---|---|---|
| Framework | NestJS modular application | Proposed | Maps functional modules to explicit backend boundaries while retaining one Stage 1 deployment. |
| API style | Versioned REST | Proposed | Matches the architecture; endpoint and webhook contracts belong in `04-API.md`. |
| HTTP adapter | Express or Fastify | TBD | Select after checking middleware, upload, observability, and deployment compatibility. |
| Validation | DTO pipes with `class-validator`/`class-transformer`, or one approved schema-based alternative | TBD | Adopt one consistent strategy; all external input receives runtime validation. |
| API documentation | `@nestjs/swagger` / OpenAPI | Proposed | Keep the generated contract aligned with controllers and DTOs. |
| Configuration | `@nestjs/config` plus startup validation | Proposed | Fail startup when required configuration is missing or invalid. |
| Authorization | Guards plus module/application policies | Proposed | Every tenant request checks membership, permissions, entitlement, and resource scope. |
| Errors | Typed application errors mapped by exception filters | Proposed | Stable client-safe error shape; no stack traces or internal details in production responses. |
| Rate limiting | NestJS throttling or an approved edge/API policy backed by shared state | Proposed | Limits must work across multiple API instances and support tenant-aware tiers. |
| Health | NestJS Terminus or lightweight equivalent | Proposed | Separate liveness/readiness when deployment topology requires it. |

Controllers remain thin. Business rules live inside their owning functional modules; cross-module calls use published application interfaces or versioned events rather than private-table access.

---

## Data and persistence

| Concern | Proposed choice | Status | Required constraints |
|---|---|---|---|
| Primary database | PostgreSQL | Proposed | One agreed tenant key, cross-tenant FK protection, transactional writes, measured indexes. |
| ORM/migrations | Prisma | Proposed | Inspect generated SQL; all schema changes use committed migrations. |
| Runtime credential | Least-privilege `DATABASE_URL` | Required practice | No schema-owner or production migration privilege in app runtimes. |
| Migration credential | Privileged `DIRECT_URL` in migration job only | Proposed naming | Never expose it to web/API/worker runtime configuration. |
| Connection pooling | Provider-compatible bounded pool | TBD | Size from provider limits and measured concurrency; avoid one pool per request. |
| Database timeouts | Statement, lock, and idle-transaction limits | TBD | Select values from workload and provider behavior, not universal defaults. |
| RLS | Defense in depth only after safe context design | Conditional | Application authorization and composite constraints remain mandatory. |
| Backups/PITR | Managed backup plus tested restore process | Required capability | Provider, retention, RPO, and RTO remain TBD. |
| Search | PostgreSQL search first; specialist engine only with evidence | Conditional | Do not add Meilisearch/Elasticsearch without approved requirements and measured need. |

Production migrations run once per release through a designated job after build and before application promotion. They never run from developer laptops, `next build`, request handlers, or application startup.

---

## Authentication and authorization

| Concern | Proposed choice | Status |
|---|---|---|
| Web sessions | Opaque, high-entropy server-side sessions | Proposed; security approval required |
| Session storage | Redis-backed revocable state | Proposed |
| Browser transport | `HttpOnly`, `Secure`, appropriately scoped cookie | Proposed |
| CSRF protection | SameSite policy plus Origin/CSRF validation appropriate to the flow | Required practice |
| Password hashing | Argon2id when password credentials are approved | Conditional |
| External login | OAuth/OIDC provider integration | Conditional; providers TBD |
| Authorization | Organization membership + permissions + module entitlement + resource scope | Required architecture constraint |
| Audit | Persistent records for security-sensitive actions | Required capability |

The exact login methods, expiry/rotation policy, account linking, recovery, verification, and mobile authentication flow remain pending BRIEF and TECH_CARD approval.

---

## Redis, queues, scheduling, and realtime

| Capability | Proposed technology | Status | Boundary |
|---|---|---|---|
| Sessions | Redis | Proposed | Security-sensitive outage and revocation behavior must be defined before implementation. |
| Cache | Redis | Conditional per use case | Non-authoritative, bounded by TTL/size, and invalidated explicitly. |
| Rate limits | Redis-backed shared counters | Proposed | Must remain correct across multiple API instances. |
| Queue | BullMQ on Redis | Conditional | Use only for approved async effects; consumers are idempotent with bounded retries. |
| Outbox relay | PostgreSQL outbox + worker | Conditional but required for critical async events | Business write and event intent commit atomically. |
| Scheduler | Platform scheduler or Nest schedule owner | TBD | One registration owner; scheduled work enters the queue rather than duplicating business logic. |
| Realtime | WebSocket or SSE gateway | Conditional | Authenticate connections, revalidate revoked memberships, and treat messages as non-authoritative hints. |

Stage 1 may use one Redis deployment with isolated clients, key prefixes, quotas, and policies. Sessions, cache, queues, limits, and realtime fan-out remain separate logical workloads so they can be split later without changing module contracts.

---

## Storage and external services

| Service area | Proposed direction | Status |
|---|---|---|
| Object storage | S3-compatible managed storage, with Cloudflare R2 as a candidate | Conditional |
| CDN/image delivery | Next.js image optimization plus approved storage/CDN path | Conditional |
| Email | Provider adapter selected from approved transactional requirements | Conditional; provider TBD |
| SMS | Provider adapter only when explicitly required | Conditional; provider TBD |
| Messaging channels | Per-provider adapters behind module-owned contracts | Conditional; providers TBD |
| Billing/payments | Provider selected after business-flow and regional requirements are approved | Not approved |
| Product analytics | Privacy-reviewed provider or no external analytics | TBD |
| Error tracking | Managed tracker such as Sentry, subject to data/retention review | Proposed capability; provider TBD |

Every external integration requires timeouts, bounded retries, idempotency where effects can duplicate, signature verification for supported webhooks, tenant-scoped credentials, safe logging, and documented data retention.

---

## Testing and quality

| Layer | Proposed tools | Required coverage focus |
|---|---|---|
| Unit | Vitest or framework-compatible runner | Domain rules, permission policies, transformations, and failure paths. |
| API integration | Nest testing utilities + Supertest | Validation, authentication, tenant isolation, transactions, and error contracts. |
| Database integration | PostgreSQL test database | Constraints, concurrent writes, migrations, and important query behavior. |
| React components | React Testing Library | Accessible interactions and state transitions where component tests add value. |
| End-to-end | Playwright | Critical user journeys and cross-application behavior. |
| Contract | OpenAPI/schema validation | Compatibility between web, API, workers, and external consumers. |

CI must run the relevant formatting, lint, typecheck, test, and build commands using locked dependencies. Coverage targets are risk-based and remain pending TECH_CARD approval; a percentage alone does not demonstrate behavioral coverage.

---

## Observability and operations

| Concern | Proposed choice | Status |
|---|---|---|
| Structured logging | Pino-compatible JSON logger | Proposed |
| Correlation | Request/correlation ID propagated across web, API, workers, and external calls | Required practice |
| Metrics | HTTP rate/errors/duration, DB pool, Redis, queue age/depth, worker failures | Required capability |
| Tracing | OpenTelemetry-compatible instrumentation | Conditional; adopt when cross-process diagnosis justifies it |
| Error tracking | Managed provider | Proposed capability; provider TBD |
| Health | Lightweight liveness/readiness endpoints | Required for deployed runtimes |
| Alerting | Symptoms tied to user impact and recovery ownership | Required before production |

Logs and traces redact credentials, authorization headers, cookies, payment data, and unnecessary personal information. Audit records are durable business/security history and remain separate from operational telemetry.

---

## Deployment and CI/CD

| Component | Proposed deployment direction | Status |
|---|---|---|
| Next.js web | Vercel is the leading candidate | Proposed; provider approval required |
| NestJS API | Managed container/runtime or approved VPS platform | TBD |
| Worker/scheduler | Same provider family as API where practical, independently runnable | Conditional |
| PostgreSQL | Managed PostgreSQL | Proposed; provider TBD |
| Redis | Managed Redis compatible with sessions and BullMQ requirements | Proposed; provider TBD |
| Object storage | Managed S3-compatible provider | Conditional |
| CI/CD | GitHub Actions | Proposed |
| Packaging | Docker for API/worker/scheduler when required by selected host | Conditional |
| Edge/WAF | Platform controls or Cloudflare | TBD from threat model and hosting |

Release order is: reviewed commit → locked install → checks/build → one production migration job → application promotion → post-deploy verification. Production deployment, migration execution, rollback authority, regions, domains, backup objectives, and disaster recovery remain outside this draft until approved.

---

## Environment configuration

| Variable/category | Owner | Notes |
|---|---|---|
| `DATABASE_URL` | API/worker runtime | Least-privilege runtime connection only. |
| `DIRECT_URL` | Migration job | Privileged migration connection; never provided to normal runtimes. |
| Redis connection | API/worker/scheduler as approved | Use separate credentials/policies when provider capabilities and risk justify them. |
| Session secrets/keys | API | High entropy, rotatable, stored only in the deployment secret manager. |
| External-service credentials | Owning server-side module | Tenant-scoped where applicable; never exposed through `NEXT_PUBLIC_*`. |
| Public web configuration | Next.js web | Only intentionally public, non-secret values use `NEXT_PUBLIC_*`. |

Each environment has separate credentials and resources. `.env.example` documents names and safe descriptions without real secrets; local development and preview environments never point to production databases by default.

---

## Related documents

- [`BRIEF.md`](./BRIEF.md) — product requirements and MVP scope.
- [`TECH_CARD.md`](./TECH_CARD.md) — approval source for project technology decisions (planned).
- [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md) — system boundaries, invariants, and topology.
- [`03-STRUCTURE.md`](./03-STRUCTURE.md) — authoritative repository layout (planned).
- [`04-API.md`](./04-API.md) — REST, webhook, and error contracts (planned).
- [`05-DATABASE.md`](./05-DATABASE.md) — schema, constraints, indexes, and migration design (planned).
- [`DECISIONS.md`](./DECISIONS.md) — decision and ADR index (planned).

**Approval rule:** this document may guide discussion, but code generation and infrastructure provisioning must follow the approved TECH_CARD and recorded decisions when they differ from this draft.
