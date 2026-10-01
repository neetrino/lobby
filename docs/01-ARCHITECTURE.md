# Project Architecture: Lobby

> Lobby is a multi-tenant CRM and task-management SaaS with independently bounded functional modules, organization-specific access, and configurable business workflows. **The current architecture targets Version 1 at Stage 1**; later scaling options are conditional, not current infrastructure.

**Project size:** C

**Current target:** Version 1 / Stage 1

**Last updated:** 2026-10-01

**Version:** 1.2

**Status:** ACTIVE — implemented Stage 1 foundation with explicitly documented future and production work.

**Document boundary:** This file defines system architecture. Exact technologies and versions belong in [`02-TECH_STACK.md`](./02-TECH_STACK.md); product requirements in `BRIEF.md`; delivery tasks in `PROGRESS.md`; agent policy in `.agents/system/`.

---

## 📋 OVERVIEW

### Purpose

Give organizations isolated workspaces for customer relationships, deals, tasks, delivery operations, communications, and inventory-related workflows. Each user belongs to exactly one organization tenant and cannot join or switch between organizations.

### Main capabilities

- Tenant-owned users, permissions, and revocable sessions.
- Contacts, leads (when enabled), deals, configurable pipelines, tasks, and orders/delivery.
- Tenant-configurable messenger, catalog, inventory, branch transfers, notifications, analytics, and dashboards.
- Reliable event processing without delaying routine API requests.
- **Every functional capability is a module.** There is **no Core-vs-Extension hierarchy**; activation and dependencies are independent concerns.

**Scope control:** Listing a module describes its architectural boundary; only the approved `BRIEF.md` and `PROGRESS.md` establish which features ship in Version 1.

### Users

| Actor             | Responsibility                                                                  |
| ----------------- | ------------------------------------------------------------------------------- |
| Owner             | Controls an organization's members, settings, and permitted modules.            |
| Admin             | Manages delegated organization operations within granted permissions.           |
| Member            | Uses authorized records and enabled modules.                                    |
| Platform operator | Manages SaaS-level organizations and plans under distinct platform permissions. |

---

## 🏗️ ARCHITECTURE

### High-level diagram — current Stage 1 target

```text
             Web browser / future mobile client
                          |
                    HTTPS / edge
                          |
                    Next.js Web
                          | REST
                  +-------v--------+
                  | NestJS API      |
                  | MODULAR         |
                  | MONOLITH        |
                  +---+--------+----+
                      |        |
              +-------v--+  +--v-----------------+
              |PostgreSQL|  | Redis (one instance)|
              | primary  |  | sessions/cache/     |
              | + outbox |  | BullMQ/rate limits  |
              +----+-----+  +----------+---------+
                   |                   |
              Outbox relay ----------> Queue
                                       |
                                Module consumers
                          (notifications, messenger,
                           analytics, approved jobs)

        Scheduler ------------------> scheduled jobs
        Realtime gateway <---------- approved live events
        Object storage <----------- authorized direct upload*
        *Only if files are in the approved Version 1 scope.
```

This diagram is logical, not a physical deployment inventory. One API service, one primary PostgreSQL database, and one Redis deployment form the initial topology. Worker/scheduler processes run independently **when** approved Version 1 use cases require them. Detailed versions and selected providers: [`02-TECH_STACK.md`](./02-TECH_STACK.md).

### Architectural style

**Modular Monolith with independently runnable background processes.** Functional modules share one initial API deployment but own their business logic, writes, public contracts, and events. Database access, caching, queues, storage, and telemetry are shared technical infrastructure—not a privileged business-module tier.

**Why:** Keep Version 1 operations manageable while enforcing boundaries that permit selective module extraction later. User-count bands on the roadmap are illustrations, **not guaranteed capacity or automatic migration triggers**.

### Architectural invariants

| Rule             | Mandatory constraint                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ARCH-MOD-001`   | Every capability is a module; no Core/Extension classification.                                                                                              |
| `ARCH-MOD-002`   | Modules own their business data; cross-module access uses public contracts or domain events, never private-table shortcuts.                                  |
| `ARCH-TEN-001`   | Each user has exactly one tenant ownership relation; each tenant-scoped operation checks that tenant, authorization, module entitlement, and resource scope. |
| `ARCH-TEN-002`   | Composite constraints prevent cross-tenant references; RLS may provide correctly configured defense in depth.                                                |
| `ARCH-SEC-001`   | Web auth uses revocable, opaque server-side sessions; organization removal blocks that organization's subsequent access.                                     |
| `ARCH-EVT-001`   | Business-critical writes and outbox records are atomic; consumers tolerate at-least-once delivery.                                                           |
| `ARCH-DB-001`    | Critical concurrent writes have a conflict strategy; schema changes remain compatible with rolling deploys.                                                  |
| `ARCH-RUN-001`   | Shared correctness-critical state cannot exist only in one API process's memory.                                                                             |
| `ARCH-SCALE-001` | Scaling changes require evidence, approval, testing, and a rollback/recovery plan.                                                                           |

---

## 🧩 SYSTEM COMPONENTS

The entries below distinguish the implemented Stage 1 foundation from conditional components. Deployment providers remain open even where the application component already exists.

| Component                | Responsibility                                                                                                                 | Location                                                   | Technology / decision state                                                                               | Runtime relationship                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Web application          | Render the product UI and initiate authenticated API requests. It does not enforce access by itself.                           | `apps/web/`                                                | Next.js 16 + React 19 foundation is implemented; broad feature UI and hosting remain open.                | Calls the API over HTTPS. Never connects directly to PostgreSQL or Redis.                                                |
| API application          | Own the request boundary, authentication, tenant context, authorization, validation, business transactions, and outbox writes. | `apps/api/`                                                | NestJS 11 REST API on Express is implemented.                                                             | Calls module application interfaces and shared infrastructure through explicit boundaries.                               |
| Functional modules       | Own business rules, writes, public contracts, and emitted events for one capability.                                           | `apps/api/src/modules/<module>/`                           | Modular-monolith organization is implemented; individual modules have different completion levels.        | A module may use another module's public interface or versioned event; it must not mutate another module's private data. |
| Primary database         | Store authoritative tenant, business, audit, and outbox data with transactional consistency.                                   | `packages/database/`                                       | PostgreSQL + Prisma 7 schema and migrations are implemented; production provider/pooling/RLS remain open. | Used by the API and worker through bounded database access.                                                              |
| Redis services           | Hold bounded ephemeral session and rate-limit state.                                                                           | Identity infrastructure adapters                           | Upstash-compatible REST clients with timeouts are implemented. General caching and queue state are not.   | Used by the API; never treated as the business source of truth.                                                          |
| Outbox relay and workers | Claim committed outbox rows and execute retry-classified, versioned handlers outside API latency.                              | `apps/worker/`                                             | Implemented directly on PostgreSQL; BullMQ is not part of the current runtime.                            | Reads/claims outbox work, dispatches handlers, records outcomes, and supports explicit failed-row requeue.               |
| Scheduler                | Register recurring or delayed jobs with explicit ownership and duplicate-execution protection.                                 | `apps/scheduler/` or an approved platform scheduler        | **Conditional Version 1 component**; deployment mechanism is pending.                                     | Enqueues work for workers rather than duplicating business logic.                                                        |
| Realtime gateway         | Deliver authorized, non-authoritative UI updates and revalidate access when a tenant-owned user's status changes.              | API-hosted gateway or separate process, to be decided      | **Conditional Version 1 component**; protocol and provider are pending.                                   | Receives approved events and pushes hints to connected clients; durable business delivery uses the outbox/queue path.    |
| Object storage           | Store approved user files using tenant-scoped object keys and authorized upload/download flows.                                | Shared storage adapter plus owning-module integration      | **Optional**; provider and file requirements are pending BRIEF and TECH_CARD approval.                    | The API authorizes operations; direct uploads use short-lived scoped credentials when supported.                         |
| Observability            | Collect structured logs, metrics, traces, health signals, and security-relevant audit events without exposing secrets.         | Shared instrumentation package/configuration, location TBD | Required capability; products, retention, and alerting are pending.                                       | Every runnable component emits correlated telemetry; business audit records remain distinct from operational logs.       |

### Frontend

Presents enabled modules, queries the API, and responds to authorized realtime updates. Browser-side caching improves UX but never determines access rights. Server-rendered and client-rendered boundaries should follow actual interaction and performance needs rather than making the entire application client-side. The browser connects to neither PostgreSQL nor Redis. Technology/version details are maintained in [`02-TECH_STACK.md`](./02-TECH_STACK.md).

### Backend

One initial REST API deployment implements authentication, tenant context, authorization, business operations, transactions, and outbox writes. Module boundaries are enforced in code review and tests, not merely by folder naming.

### Database

PostgreSQL is the implemented Stage 1 system of record for tenant, business, audit, reservation-foundation, and outbox data. The API and worker access it through bounded persistence code; clients never connect to it directly. Tenant-scoped relations carry the organization key, and implemented composite constraints prevent cross-tenant references. Critical concurrent writes—including future inventory changes, state transitions, reservation overlap, and outbox claims—require an explicit transaction, constraint, locking, optimistic-concurrency, or idempotency strategy appropriate to the operation.

Schema changes are versioned Prisma SQL migrations and follow expand/deploy/backfill/contract when a rolling deployment could observe mixed application versions. Production migrations run once through the approved release process, never independently on every API startup. Provider, connection-pooling design, runtime/migration roles, backup policy, and any RLS implementation remain open production decisions.

### Cache

An Upstash-compatible Redis REST store is implemented for revocable sessions and rate-limit counters. Each purpose has separate key namespacing, TTL behavior, and bounded request timeouts. General caching and queue metadata are not implemented. Authorization or entitlement data is not cached in a way that can silently preserve revoked access.

Sessions, caching, rate limiting, queues, and realtime fan-out remain separate logical concerns even when one provider could serve several workloads. Current session and rate-limit clients use separate key spaces. Provider availability, persistence, eviction, and future workload separation remain production decisions.

### Functional modules

| Area                   | Modules / responsibility                                                          |
| ---------------------- | --------------------------------------------------------------------------------- |
| Workspace & access     | Organizations; Identity & Sessions; Access Management; Module Management          |
| Customer work          | Contacts; Leads; Deals; Pipelines; Tasks; Orders & Delivery                       |
| Hospitality operations | Reservations; Venues; Dining Areas; Tables; Service Periods                       |
| Communication          | Messenger; Notifications                                                          |
| Commerce operations    | Catalog; Inventory; Inventory Transfers (including optional serial/IMEI tracking) |
| Insights               | Analytics; Dashboard                                                              |

Some modules require other modules' **published capabilities**. Enabled/disabled status is an organization entitlement; disabling a module does not automatically erase its data. Module behavior and dependency requirements are specified in `BRIEF.md` and module contracts.

### Module communication

- **Synchronous:** call another module's published application interface when an immediate answer or validation is required.
- **Asynchronous:** publish a versioned domain event through the transactional outbox for independent reactions.
- **Forbidden:** mutate another module's private tables or depend on its internal implementation.
- **Contracts:** make payloads runtime-validatable; version external/async event schemas and maintain compatible consumers during migration.

### Supporting infrastructure

PostgreSQL is the business source of truth. Redis supports server-side sessions and rate limits. The PostgreSQL outbox worker handles current async events; no scheduler or general queue is implemented. Optional object storage remains conditional. Observability applies across every runnable component rather than forming a privileged business module. Technical selection, versions, providers, and configuration belong in [`02-TECH_STACK.md`](./02-TECH_STACK.md).

---

## 📁 PROJECT STRUCTURE

**Current baseline plus conditional paths.** The authoritative full tree and completion states belong in [`03-STRUCTURE.md`](./03-STRUCTURE.md).

```text
Lobby/
├── apps/
│   ├── web/                     # Web client
│   ├── api/src/modules/         # All functional modules
│   ├── worker/                  # Outbox relay and consumers
│   └── scheduler/               # Time-triggered jobs
├── packages/
│   ├── contracts/               # Public, versioned contracts
│   └── database/                # Schema and migrations, if approved
├── docs/
│   ├── BRIEF.md
│   ├── TECH_CARD.md
│   ├── 01-ARCHITECTURE.md
│   ├── 02-TECH_STACK.md
│   ├── 03-STRUCTURE.md
│   ├── 04-API.md
│   ├── 05-DATABASE.md
│   ├── DECISIONS.md
│   ├── PROGRESS.md
│   └── architecture/           # Size-C dependency graph / ADRs as needed
└── .agents/                     # Separate AI governance and skills
```

### Folder descriptions

The application paths below describe the current **Size C layout** and conditional boundaries. They are not permission to create every future package or process before a real need exists.

| Folder                           | Purpose                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/`                      | Web application: routes, layouts, presentation components, browser interactions, and API/realtime clients. It must not contain database access or server secrets.      |
| `apps/api/`                      | Main backend application: HTTP entry points, authentication, tenant context, authorization, validation, and composition of functional modules.                         |
| `apps/api/src/modules/<module>/` | Private implementation of one functional capability. Each module owns its business rules and data writes and exposes only documented public contracts.                 |
| `apps/worker/`                   | Implemented background runtime for PostgreSQL outbox relay, exact-version dispatch, retry classification, durable external-effect reservation, and failed-row requeue. |
| `apps/scheduler/`                | Conditional runtime for registering recurring and delayed jobs. It schedules owned work but does not duplicate module business logic.                                  |
| `packages/contracts/`            | Framework-light, versioned API and event contracts shared only where a real cross-application boundary exists. It must not become a collection of module internals.    |
| `packages/database/`             | Implemented home for the Prisma schema, SQL migrations, generated-client configuration, outbox configuration, and narrowly scoped database/test utilities.             |
| `docs/`                          | Product documentation and delivery records, including the BRIEF, TECH_CARD, architecture, API, database, decisions, and progress documents that are actually needed.   |
| `docs/architecture/`             | Optional Size C supporting material such as module dependency diagrams and ADRs that would make the main architecture document too detailed.                           |
| `.agents/`                       | Agent workflows, catalog, references, and governance. It remains separate from product architecture and product requirements.                                          |
| `.cursor/rules/`                 | Cursor-specific permanent coding standards. Rules define ongoing constraints; repeatable task procedures belong in `.agents/skills/`.                                  |
| `.github/`                       | Repository collaboration and automation configuration, including issue/PR templates, dependency updates, and approved CI workflows.                                    |

---

## 🔄 DATA FLOWS

### User request

```text
Client → Web → REST API → validate opaque session → derive the user's tenant
       → permission + entitlement + resource checks
       → validate input → owning module → transaction/DB → response
```

If a business-critical event is produced, the business write and event record commit together. The client updates/invalidate its local API cache after confirmed changes.

### Authentication and revocation

```text
Login → validate credentials → create opaque session → store in Redis
      → deliver HttpOnly/Secure cookie to the web client
Request → session valid? → tenant-owned user active? → authorized? → execute
Owner removes employee from Organization A
      → synchronously disable that tenant-owned user and invalidate its auth state
      → deny later A requests and terminate/revalidate A realtime access
```

**Fail closed:** Redis/cache outages cannot silently reactivate stale rights. Define a policy for requests already in flight when a tenant-owned user is deactivated.

### Reliable domain events

```text
Business transaction → write domain state + outbox event (same commit)
  → relay claims event → durable queue / consumer-specific jobs
  → idempotent workers → bounded retry → failed-job review / explicit DLQ
Scheduler → registered time-based queue jobs
```

One event may trigger multiple consumer-specific jobs. Several workers on **one BullMQ job queue compete** for jobs; they do not automatically each receive a copy. Redis Pub/Sub is suitable for UI hints, not the sole path for business-critical delivery.

---

## 📊 DATABASE

### Main entities

| Group             | Representative entities                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| Tenancy/access    | `tenants`, tenant-owned `users`, roles, permissions, module entitlements                                  |
| CRM/work          | contacts, leads, deals, pipelines/stages, tasks and links, orders/items                                   |
| Communication     | channel accounts, conversations, messages, notifications                                                  |
| Catalog/inventory | products/variants, locations, stock balances/movements, transfers/items                                   |
| Reservations      | venues, dining areas, restaurant tables, service periods, reservations, table assignments, status history |
| System history    | outbox events, processed events, audit logs                                                               |

### ER diagram

```text
Tenant/Organization ──< Users
Tenant/Organization ──< enabled modules
Organization ──< Contacts ──< Deals >── Pipeline stages
Organization ──< Tasks; Organization ──< Orders
Product ──< Variants ──< Stock levels >── Locations
Transfer ──< Transfer items >── Variants
Channel account ──< Conversations ──< Messages
Organization ──< Venues ──< Dining areas ──< Restaurant tables
Venue ──< Reservations ──< Table assignments >── Restaurant tables
```

This is a conceptual ER view: it identifies ownership and cardinality direction but does not define physical table names, nullable fields, join-table columns, or indexes.

### Detailed schema

**Rules:** use one agreed tenant key; enforce organization scope and cross-tenant FK integrity; implement RLS only with safe per-transaction context when using transaction pooling; maintain append-only stock movements and safe concurrent inventory updates. Use measured query shapes for indexes and expand/deploy/backfill/contract for schema changes. If replicas are later introduced, strong-consistency/read-after-write reads remain on primary.

For reservations, PostgreSQL is the final guard against overlapping active assignments to the same table. The module owns venue/table configuration, availability checks, reservation lifecycle, and status history. Times cross API boundaries as UTC instants, while each venue's IANA timezone defines local calendar and service-period interpretation. Public booking, deposits, waitlists, external booking portals, and automatic table allocation are outside this foundation.

Executable schema, constraints, ERD, and indexes belong in [`05-DATABASE.md`](./05-DATABASE.md) and migrations—not here.

---

## 🔌 INTEGRATIONS

Messaging channels, email/SMS, file storage, observability, and billing are integrated **only to the extent approved by BRIEF and TECH_CARD**. Provider-specific choices and versions belong in [`02-TECH_STACK.md`](./02-TECH_STACK.md); endpoint and webhook contracts belong in [`04-API.md`](./04-API.md). Inbound webhooks require supported signature checks and deduplication.

| Integration boundary | Purpose                                                             | Current status                          | Architectural requirements                                                                                                                  | Detailed documentation                                        |
| -------------------- | ------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Messaging channels   | Synchronize approved external conversations and messages.           | Conditional; channels and providers TBD | Signed/verified inbound requests where supported, deduplication, idempotent processing, tenant-scoped credentials, bounded retries.         | `04-API.md` and provider-specific integration record, planned |
| Email and SMS        | Deliver transactional notifications approved by product scope.      | Conditional; providers TBD              | Template/version ownership, consent and suppression rules, delivery-status handling, secret isolation, retry limits.                        | `02-TECH_STACK.md` and `04-API.md`, planned                   |
| Object storage       | Store approved attachments, exports, and media.                     | Conditional; provider TBD               | Tenant-scoped keys, content/type/size validation, short-lived access, malware policy where risk requires it, lifecycle/deletion rules.      | `02-TECH_STACK.md`, planned                                   |
| Billing and payments | Manage subscriptions or business payments if included in the BRIEF. | Not approved; provider and flows TBD    | Server-verified amounts, signed webhooks, idempotency, immutable transaction references, reconciliation, no sensitive payment data in logs. | Payment ADR/API contract, planned                             |
| Observability        | Collect operational telemetry and alert on service health.          | Required capability; products TBD       | Correlation IDs, secret/PII filtering, retention policy, actionable alerts, separation of operational logs and audit records.               | `02-TECH_STACK.md`, planned                                   |
| Identity provider    | Support external login only if selected in the TECH_CARD.           | Not approved                            | OAuth/OIDC state and nonce validation, redirect allowlist, account-linking policy, provider-token protection.                               | Authentication ADR/API contract, planned                      |

Integration credentials remain server-side and tenant-scoped when tenants bring their own accounts. An integration must define ownership, timeout, retry, idempotency, rate-limit, failure-recovery, observability, and data-retention behavior before production enablement.

---

## 🔐 SECURITY

### Authentication

The web flow uses opaque, high-entropy server-side sessions delivered through `HttpOnly`, environment-appropriate cookies with Origin protection. Idle and absolute expiry, sliding renewal, revocation, authentication-version checks, Redis timeouts, and fail-closed reads are implemented. Cross-site deployment would require revisiting cookie/CSRF policy. Mobile authentication remains a future design decision.

### Authorization

Every tenant-scoped operation derives the user's single tenant from the authenticated identity and checks permission, module entitlement, and resource scope. Owner/Admin/Member are stored on `users.role` for the current foundation and are not a substitute for those live checks; platform-operator permissions remain separate. Users cannot select, join, or switch to another organization tenant.

The planned access-management version replaces the fixed tenant-role permission mapping with tenant-defined roles backed by a closed application permission catalog. `OWNER` remains a protected system role. Owners, and Admins holding an explicit role-management permission, may create, rename, disable, and assign tenant roles from organization settings. They cannot grant permissions outside their own authority, cross the tenant boundary, grant platform-operator permissions, or remove the final active Owner. Permission and role changes increment the affected user's authentication version so existing sessions cannot retain stale authority.

### Tenant registration boundary

Auth accepts registration input, validates the password, and hashes it. Organizations is the only module that writes `tenants` and the founding user. `createWithOwner` commits the tenant, the active owner, and the `tenant.created` outbox event in one PostgreSQL transaction. The event payload never contains a password or password hash.

- Each User belongs to exactly one Tenant.
- The same normalized email may identify separate User records in different tenants.
- Authentication therefore requires tenant context plus email.
- The first user created with a tenant is always its Owner.
- Tenant, Owner, and `tenant.created` outbox event are committed atomically.
- Password hashing belongs to Auth; Organizations receives only `passwordHash`.

The login identifier is tenant subdomain + email + password on `POST /api/v1/auth/login`. Login finds the user, rejects a non-ACTIVE user, and only then verifies the Argon2id hash. A missing tenant, missing user, or disabled user still runs verification against a fixed unusable Argon2id hash, and those failures return the same error. Each success creates a new session id. Later requests pass through SessionGuard: the cookie is hashed, loaded from Redis, checked for idle and absolute expiry, then accepted only when the user is still ACTIVE and the session authenticationVersion matches the user row. `POST /api/v1/auth/logout` deletes that session and clears the cookie; repeating it, or calling it without a live session, still succeeds. Terminating every session for a user increments `authenticationVersion` and deletes that user's Redis session keys and reverse index in the same request. The outbox does not perform revocation. A session written with the previous version, including one created while termination is in progress, is discarded and cannot authenticate. Owner and Admin may terminate another user in the same tenant; the application service checks that permission. AuthenticatedTenantContext is copied from that session alone. Public registration is `POST /api/v1/auth/register` on the Auth module. Organizations does not expose `POST /organizations` or `POST /tenants`. If session creation fails after the tenant transaction commits, the tenant stays created, registration returns a controlled error, and the owner can log in later. The only approved plan value is `starter`. The outbox worker accepts both `tenant.created` version 1 (`userId`) and version 2 (`ownerUserId`).

### Protection

- Require TLS, constrained CORS, trusted-host/origin configuration, validated inputs, and safe output handling. CORS allows credentialed reads from `ALLOWED_ORIGINS` and is not CSRF protection. Mutating methods fail closed unless `Origin` or, when `Origin` is absent, the `Referer` origin is on that list. `SameSite=Lax` does not replace the check. A cross-site frontend needs a CSRF token.
- Apply tiered rate limits and worker-level tenant fairness so one tenant cannot exhaust shared capacity. Login, registration, and invalid-session counters use the `rate_limit:` key space, separate from session keys, and store only hashes of the IP or normalized account.
- Use idempotency where retries or duplicate delivery could create duplicate effects.
- Keep secrets out of source, browser bundles, URLs, and logs; rotate them through an approved process.
- Record security-sensitive actions in tamper-resistant audit history distinct from operational logs.
- Audit successful and denied access-management operations, including role creation/update, permission changes, user-role assignment, user disablement, and session termination. Access changes and their success audit record commit atomically.
- Define upload validation, webhook verification, dependency scanning, backup restoration, and incident response before enabling the corresponding risk surface.

---

## 🚀 DEPLOYMENT

### Environments

| Environment | Endpoint                   | Purpose                                                                      | Promotion/data policy                                                                  |
| ----------- | -------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Development | Local endpoints; ports TBD | Implementation and automated/local verification.                             | Synthetic or approved development data only; local secrets remain uncommitted.         |
| Staging     | TBD                        | Production-like integration, migration, security, and deployment validation. | Promoted from reviewed commits; no unapproved production-data copy.                    |
| Production  | TBD                        | Customer traffic and authoritative business processing.                      | Controlled promotion with monitoring, rollback/recovery plan, and one migration owner. |

### Infrastructure

Stage 1 uses one logical web app, one modular API, one primary database, and one Redis deployment, plus only approved worker/scheduler/storage needs. Apply bounded DB pooling; PgBouncer deployment and provider selection require TECH_CARD alignment. Run controlled, compatible migrations once per release, not independently on each API startup. See [`02-TECH_STACK.md`](./02-TECH_STACK.md) for technology/provider decisions.

Each runnable component must expose an appropriate health signal, emit correlated telemetry, receive secrets through the approved environment mechanism, and have documented ownership. Hosting regions, network boundaries, backup/restore targets, deployment ordering, rollback behavior, and disaster-recovery objectives remain pending TECH_CARD approval.

---

## 📈 SCALING — SIZE C

**Current architecture: Stage 1 only.** The roadmap's active-user bands are illustrations; they are not validated capacity limits or mandatory upgrade dates.

### Current baseline

No production workload or measured capacity baseline exists yet. Local and CI builds/tests prove behavior, not active-user capacity, request latency, database saturation, worker throughput, or tenant fairness. Measurements begin in staging and are revalidated with production telemetry. Until evidence exists, this document makes no capacity guarantee.

### Scaling plan

| Stage            | Conditional evolution (requires demonstrated need and approval)                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 1 — Version 1    | Modular monolith, primary PostgreSQL, single Redis, relevant workers, basic monitoring/security.                         |
| 2 — Early growth | Additional stateless API/worker instances, load balancing, stronger Redis availability, DB connection management/tuning. |
| 3 — Scale        | Selective read replicas, workload-specific Redis split, specialized search or module extraction only if justified.       |
| 4 — Large scale  | Tenant-specific DB isolation, independently deployed services, advanced events/DR if bottlenecks require them.           |
| 5 — Enterprise   | Multi-region and stronger compliance/data-residency architecture only for real business requirements.                    |

**Change gate:** measure (latency, errors, DB saturation, queue age, tenant fairness) → diagnose → record alternatives and approval → load/recovery test → deploy → update actual-state architecture. Kafka is not a direct BullMQ replacement, and user count alone never triggers sharding or microservices.

---

## 📋 KEY DECISIONS

The identifiers below reserve traceable decision records; they are not accepted ADRs until the corresponding files are created and approved under `docs/architecture/` or recorded in `DECISIONS.md`.

| Decision                         | Architectural position                                    | Rationale                                                                                                                           | Status                                                    | ADR reference                                        |
| -------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Project classification           | Size C                                                    | The domain has multiple bounded capabilities, tenant isolation, background processing, and long-term evolution.                     | Implemented baseline                                      | ADR still recommended                                |
| Initial backend topology         | Modular monolith                                          | Provides one manageable Version 1 deployment while enforcing module ownership and leaving evidence-based extraction possible later. | Implemented                                               | ADR still recommended                                |
| Functional organization          | Every capability is a module                              | Keeps activation, dependency, and ownership concerns explicit without creating an artificial Core/Extension hierarchy.              | Implemented convention                                    | ADR still recommended                                |
| Multi-tenancy                    | Shared primary database with organization-aware isolation | Minimizes initial operational complexity while composite constraints and authorization checks protect tenant boundaries.            | Implemented without RLS                                   | ADR still recommended                                |
| Sessions                         | Revocable server-side credentials                         | Supports immediate tenant-user/session revocation without relying on long-lived self-contained authorization claims.                | Implemented                                               | ADR still recommended                                |
| Asynchronous work                | Transactional PostgreSQL outbox and idempotent worker     | Couples business state and event intent atomically while allowing retryable work outside request latency.                           | Implemented foundation; no general queue                  | ADR still recommended                                |
| Versions, providers, and hosting | Defined in TECH_CARD and `02-TECH_STACK.md`               | Keeps replaceable technology selections out of architectural invariants and makes approval ownership explicit.                      | Pending                                                   | No ADR until a choice has architectural consequences |
| Future architecture              | Metrics-driven conditional evolution                      | Avoids premature services, replicas, sharding, or multi-region complexity without measured bottlenecks or business requirements.    | Accepted as a decision principle; formal approval pending | `ADR-007-scaling-gates`, planned                     |

---

## 🔗 RELATED DOCUMENTS

- [BRIEF.md](./BRIEF.md) — product/functional scope.
- [TECH_CARD.md](./TECH_CARD.md) — authoritative approved technical decisions.
- [02-TECH_STACK.md](./02-TECH_STACK.md) — **detailed technologies, versions, runtime topology, and integration choices**.
- [03-STRUCTURE.md](./03-STRUCTURE.md) — complete repository layout.
- [04-API.md](./04-API.md) — REST and webhook contracts.
- [05-DATABASE.md](./05-DATABASE.md) — detailed schema, indexes, RLS, migrations.
- [DECISIONS.md](./DECISIONS.md) — decisions/ADRs and approval history.
- [PROGRESS.md](./PROGRESS.md) — delivery phases and task backlog.
- [`architecture/`](./architecture/) — Size-C dependency graph and supporting records where needed.

Agent governance stays in `.agents/system/`; procedures in `.agents/skills/`; templates in `docs/reference/`. **Before changing this draft to APPROVED, resolve mismatches with the actual repository and approved TECH_CARD.**
