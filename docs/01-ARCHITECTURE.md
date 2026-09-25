# Project Architecture: Lobby

> Lobby is a multi-tenant CRM and task-management SaaS with independently bounded functional modules, organization-specific access, and configurable business workflows. **The current architecture is Stage 1 (MVP)**; later scaling options are conditional, not current infrastructure.

**Project size:** C  
**Current target:** Stage 1 / MVP  
**Last updated:** 2026-09-24  
**Version:** 1.1-draft  
**Status:** DRAFT — reconcile open choices with the approved [`TECH_CARD.md`](./TECH_CARD.md).  
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

**Scope control:** Listing a module describes its architectural boundary; only the approved `BRIEF.md` and `PROGRESS.md` establish which features ship in the MVP.

### Users

| Actor | Responsibility |
|---|---|
| Owner | Controls an organization's members, settings, and permitted modules. |
| Admin | Manages delegated organization operations within granted permissions. |
| Member | Uses authorized records and enabled modules. |
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
        *Only if files are in the approved MVP.
```

This diagram is logical, not a physical deployment inventory. One API service, one primary PostgreSQL database, and one Redis deployment form the initial topology. Worker/scheduler processes run independently **when** approved MVP use cases require them. Detailed versions and selected providers: [`02-TECH_STACK.md`](./02-TECH_STACK.md).

### Architectural style

**Modular Monolith with independently runnable background processes.** Functional modules share one initial API deployment but own their business logic, writes, public contracts, and events. Database access, caching, queues, storage, and telemetry are shared technical infrastructure—not a privileged business-module tier.

**Why:** Keep MVP operations manageable while enforcing boundaries that permit selective module extraction later. User-count bands on the roadmap are illustrations, **not guaranteed capacity or automatic migration triggers**.

### Architectural invariants

| Rule | Mandatory constraint |
|---|---|
| `ARCH-MOD-001` | Every capability is a module; no Core/Extension classification. |
| `ARCH-MOD-002` | Modules own their business data; cross-module access uses public contracts or domain events, never private-table shortcuts. |
| `ARCH-TEN-001` | Each user has exactly one tenant ownership relation; each tenant-scoped operation checks that tenant, authorization, module entitlement, and resource scope. |
| `ARCH-TEN-002` | Composite constraints prevent cross-tenant references; RLS may provide correctly configured defense in depth. |
| `ARCH-SEC-001` | Web auth uses revocable, opaque server-side sessions; organization removal blocks that organization's subsequent access. |
| `ARCH-EVT-001` | Business-critical writes and outbox records are atomic; consumers tolerate at-least-once delivery. |
| `ARCH-DB-001` | Critical concurrent writes have a conflict strategy; schema changes remain compatible with rolling deploys. |
| `ARCH-RUN-001` | Shared correctness-critical state cannot exist only in one API process's memory. |
| `ARCH-SCALE-001` | Scaling changes require evidence, approval, testing, and a rollback/recovery plan. |

---

## 🧩 SYSTEM COMPONENTS

The entries below describe **logical responsibilities and boundaries**, not a final deployment inventory. Locations and technologies marked **Proposed** must be reconciled with the approved `TECH_CARD.md`; optional components are introduced only when an approved MVP use case requires them.

| Component | Responsibility | Proposed location | Technology / decision state | Runtime relationship |
|---|---|---|---|---|
| Web application | Render the product UI, initiate authenticated API requests, and consume authorized realtime updates. It does not enforce access by itself. | `apps/web/` | Next.js is **proposed**; version and hosting are pending TECH_CARD approval. | Calls the API over HTTPS; may subscribe to the realtime gateway. Never connects directly to PostgreSQL or Redis. |
| API application | Own the request boundary, authentication, tenant context, authorization, validation, business transactions, and outbox writes. | `apps/api/` | NestJS REST API is **proposed**; runtime and version are pending TECH_CARD approval. | Calls module application interfaces and shared infrastructure through explicit boundaries. |
| Functional modules | Own business rules, writes, public contracts, and emitted events for one capability. | `apps/api/src/modules/<module>/` | Modular-monolith organization is the **proposed Stage 1** design. Exact module scope comes from the approved BRIEF. | A module may use another module's public interface or versioned event; it must not mutate another module's private data. |
| Primary database | Store authoritative tenant, business, audit, and outbox data with transactional consistency. | `packages/database/` for schema/migrations, if approved | PostgreSQL is **proposed**; provider, version, ORM, pooling, and RLS policy are pending. | Used by the API and approved background processes through bounded database access. |
| Redis services | Hold bounded ephemeral state such as sessions, rate-limit counters, cache entries, and queue state. | Shared infrastructure; client adapters remain near their owning application | Redis is **proposed**. One initial deployment may serve multiple namespaced purposes, subject to security and availability review. | Used by the API, workers, scheduler, and realtime layer as approved; never treated as the business source of truth. |
| Outbox relay and workers | Publish committed outbox records and execute retryable, idempotent background effects without delaying API requests. | `apps/worker/` | **Conditional MVP component**; queue library and process topology are pending. | Reads/claims outbox work, submits consumer-specific jobs, and records processing outcomes. |
| Scheduler | Register recurring or delayed jobs with explicit ownership and duplicate-execution protection. | `apps/scheduler/` or an approved platform scheduler | **Conditional MVP component**; deployment mechanism is pending. | Enqueues work for workers rather than duplicating business logic. |
| Realtime gateway | Deliver authorized, non-authoritative UI updates and revalidate access when a tenant-owned user's status changes. | API-hosted gateway or separate process, to be decided | **Conditional MVP component**; protocol and provider are pending. | Receives approved events and pushes hints to connected clients; durable business delivery uses the outbox/queue path. |
| Object storage | Store approved user files using tenant-scoped object keys and authorized upload/download flows. | Shared storage adapter plus owning-module integration | **Optional**; provider and file requirements are pending BRIEF and TECH_CARD approval. | The API authorizes operations; direct uploads use short-lived scoped credentials when supported. |
| Observability | Collect structured logs, metrics, traces, health signals, and security-relevant audit events without exposing secrets. | Shared instrumentation package/configuration, location TBD | Required capability; products, retention, and alerting are pending. | Every runnable component emits correlated telemetry; business audit records remain distinct from operational logs. |

### Frontend

Presents enabled modules, queries the API, and responds to authorized realtime updates. Browser-side caching improves UX but never determines access rights. Server-rendered and client-rendered boundaries should follow actual interaction and performance needs rather than making the entire application client-side. The browser connects to neither PostgreSQL nor Redis. Technology/version details are maintained in [`02-TECH_STACK.md`](./02-TECH_STACK.md).

### Backend

One initial REST API deployment implements authentication, tenant context, authorization, business operations, transactions, and outbox writes. Module boundaries are enforced in code review and tests, not merely by folder naming.

### Database

PostgreSQL is the **proposed** Stage 1 system of record for tenant, business, audit, and outbox data. The API and approved background processes access it through module-owned persistence boundaries; clients never connect to it directly. Tenant-scoped relations must carry the agreed organization key, and composite constraints must prevent references across organizations. Critical concurrent writes—including inventory changes, state transitions, and outbox claims—require an explicit transaction, locking, optimistic-concurrency, or idempotency strategy appropriate to the operation.

Schema changes are versioned migrations and follow expand/deploy/backfill/contract when a rolling deployment could observe mixed application versions. Production migrations run once through the approved release process, never independently on every API startup. Provider, PostgreSQL version, ORM, connection-pooling design, backup policy, and any RLS implementation remain pending TECH_CARD and database-design approval.

### Cache

Redis is the **proposed** store for bounded, non-authoritative state such as revocable sessions, rate-limit counters, short-lived cache entries, and queue metadata. Each purpose must have explicit key namespacing, tenant scoping where applicable, TTL and size limits, invalidation rules, and outage behavior. Cached authorization or entitlement data must not silently preserve revoked access; security-sensitive checks fail closed or use an approved authoritative fallback.

Sessions, caching, rate limiting, queues, and realtime fan-out are separate logical concerns even if Stage 1 uses one Redis deployment. Their clients and key spaces remain isolated so a later availability, security, or load requirement can move a workload without changing business-module contracts. Redis provider, version, persistence, eviction, high-availability, and workload-separation decisions remain pending TECH_CARD approval.

### Functional modules

| Area | Modules / responsibility |
|---|---|
| Workspace & access | Organizations; Identity & Sessions; Access Management; Module Management |
| Customer work | Contacts; Leads; Deals; Pipelines; Tasks; Orders & Delivery |
| Hospitality operations | Reservations; Venues; Dining Areas; Tables; Service Periods |
| Communication | Messenger; Notifications |
| Commerce operations | Catalog; Inventory; Inventory Transfers (including optional serial/IMEI tracking) |
| Insights | Analytics; Dashboard |

Some modules require other modules' **published capabilities**. Enabled/disabled status is an organization entitlement; disabling a module does not automatically erase its data. Module behavior and dependency requirements are specified in `BRIEF.md` and module contracts.

### Module communication

- **Synchronous:** call another module's published application interface when an immediate answer or validation is required.
- **Asynchronous:** publish a versioned domain event through the transactional outbox for independent reactions.
- **Forbidden:** mutate another module's private tables or depend on its internal implementation.
- **Contracts:** make payloads runtime-validatable; version external/async event schemas and maintain compatible consumers during migration.

### Supporting infrastructure

PostgreSQL is the proposed business source of truth. Redis supports server-side sessions and bounded ephemeral workloads if that session design is approved. Queue workers handle async effects; a scheduler registers time-based jobs. Optional object storage handles authorized files. Observability applies across every runnable component rather than forming a privileged business module. Technical selection, versions, providers, and configuration belong in [`02-TECH_STACK.md`](./02-TECH_STACK.md).

---

## 📁 PROJECT STRUCTURE

**Proposed layout; verify against the approved TECH_CARD and actual repository.** The authoritative full tree belongs in [`03-STRUCTURE.md`](./03-STRUCTURE.md).

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

The application paths below are part of the **proposed Size C layout**. They describe ownership boundaries, not permission to create every package or process before its MVP need and technology choice are approved.

| Folder | Purpose |
|---|---|
| `apps/web/` | Web application: routes, layouts, presentation components, browser interactions, and API/realtime clients. It must not contain database access or server secrets. |
| `apps/api/` | Main backend application: HTTP entry points, authentication, tenant context, authorization, validation, and composition of functional modules. |
| `apps/api/src/modules/<module>/` | Private implementation of one functional capability. Each module owns its business rules and data writes and exposes only documented public contracts. |
| `apps/worker/` | Conditional background runtime for the outbox relay and idempotent queue consumers. Create it only when approved asynchronous work requires an independently runnable process. |
| `apps/scheduler/` | Conditional runtime for registering recurring and delayed jobs. It schedules owned work but does not duplicate module business logic. |
| `packages/contracts/` | Framework-light, versioned API and event contracts shared only where a real cross-application boundary exists. It must not become a collection of module internals. |
| `packages/database/` | Proposed home for database schema, migrations, generated-client configuration, and narrowly scoped database utilities. Final ORM and migration layout require TECH_CARD approval. |
| `docs/` | Product documentation and delivery records, including the BRIEF, TECH_CARD, architecture, API, database, decisions, and progress documents that are actually needed. |
| `docs/architecture/` | Optional Size C supporting material such as module dependency diagrams and ADRs that would make the main architecture document too detailed. |
| `.agents/` | Agent workflows, catalog, references, and governance. It remains separate from product architecture and product requirements. |
| `.cursor/rules/` | Cursor-specific permanent coding standards. Rules define ongoing constraints; repeatable task procedures belong in `.agents/skills/`. |
| `.github/` | Repository collaboration and automation configuration, including issue/PR templates, dependency updates, and approved CI workflows. |

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

| Group | Representative entities |
|---|---|
| Tenancy/access | `tenants`, tenant-owned `users`, roles, permissions, module entitlements |
| CRM/work | contacts, leads, deals, pipelines/stages, tasks and links, orders/items |
| Communication | channel accounts, conversations, messages, notifications |
| Catalog/inventory | products/variants, locations, stock balances/movements, transfers/items |
| Reservations | venues, dining areas, restaurant tables, service periods, reservations, table assignments, status history |
| System history | outbox events, processed events, audit logs |

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

| Integration boundary | Purpose | Current status | Architectural requirements | Detailed documentation |
|---|---|---|---|---|
| Messaging channels | Synchronize approved external conversations and messages. | Conditional; channels and providers TBD | Signed/verified inbound requests where supported, deduplication, idempotent processing, tenant-scoped credentials, bounded retries. | `04-API.md` and provider-specific integration record, planned |
| Email and SMS | Deliver transactional notifications approved by product scope. | Conditional; providers TBD | Template/version ownership, consent and suppression rules, delivery-status handling, secret isolation, retry limits. | `02-TECH_STACK.md` and `04-API.md`, planned |
| Object storage | Store approved attachments, exports, and media. | Conditional; provider TBD | Tenant-scoped keys, content/type/size validation, short-lived access, malware policy where risk requires it, lifecycle/deletion rules. | `02-TECH_STACK.md`, planned |
| Billing and payments | Manage subscriptions or business payments if included in the BRIEF. | Not approved; provider and flows TBD | Server-verified amounts, signed webhooks, idempotency, immutable transaction references, reconciliation, no sensitive payment data in logs. | Payment ADR/API contract, planned |
| Observability | Collect operational telemetry and alert on service health. | Required capability; products TBD | Correlation IDs, secret/PII filtering, retention policy, actionable alerts, separation of operational logs and audit records. | `02-TECH_STACK.md`, planned |
| Identity provider | Support external login only if selected in the TECH_CARD. | Not approved | OAuth/OIDC state and nonce validation, redirect allowlist, account-linking policy, provider-token protection. | Authentication ADR/API contract, planned |

Integration credentials remain server-side and tenant-scoped when tenants bring their own accounts. An integration must define ownership, timeout, retry, idempotency, rate-limit, failure-recovery, observability, and data-retention behavior before production enablement.

---

## 🔐 SECURITY

### Authentication

The proposed web flow uses opaque, high-entropy server-side sessions delivered through `HttpOnly`, `Secure`, appropriately scoped cookies with CSRF/Origin protection. Session creation, rotation, absolute/idle expiry, device/session management, and Redis-outage behavior must be finalized in the security design. Mobile, if approved, may use opaque bearer session credentials in OS secure storage—not self-contained JWTs.

### Authorization

Every tenant-scoped operation derives the user's single tenant from the authenticated identity and checks permission, module entitlement, and resource scope. Owner/Admin/Member are stored on `users.role` for the current foundation and are not a substitute for those live checks; platform-operator permissions remain separate. Users cannot select, join, or switch to another organization tenant.

### Tenant registration boundary

Auth accepts registration input, validates the password, and hashes it. Organizations is the only module that writes `tenants` and the founding user. `createWithOwner` commits the tenant, the active owner, and the `tenant.created` outbox event in one PostgreSQL transaction. The event payload never contains a password or password hash.

- Each User belongs to exactly one Tenant.
- The same normalized email may identify separate User records in different tenants.
- Authentication therefore requires tenant context plus email.
- The first user created with a tenant is always its Owner.
- Tenant, Owner, and `tenant.created` outbox event are committed atomically.
- Password hashing belongs to Auth; Organizations receives only `passwordHash`.

The login identifier is tenant subdomain + email + password. Login finds the user, rejects a non-ACTIVE user, and only then verifies the Argon2id hash. An unknown user still runs verification against a fixed unusable Argon2id hash so the failure timing matches. Public registration will be `POST /api/v1/auth/register` on the Auth module. Organizations does not expose `POST /organizations` or `POST /tenants`. If session creation fails after the tenant transaction commits, the tenant stays created, registration returns a controlled error, and the owner can log in later. The only approved plan value is `starter`. The outbox worker accepts both `tenant.created` version 1 (`userId`) and version 2 (`ownerUserId`).

### Protection

- Require TLS, constrained CORS, trusted-host/origin configuration, validated inputs, and safe output handling.
- Apply tiered rate limits and worker-level tenant fairness so one tenant cannot exhaust shared capacity.
- Use idempotency where retries or duplicate delivery could create duplicate effects.
- Keep secrets out of source, browser bundles, URLs, and logs; rotate them through an approved process.
- Record security-sensitive actions in tamper-resistant audit history distinct from operational logs.
- Define upload validation, webhook verification, dependency scanning, backup restoration, and incident response before enabling the corresponding risk surface.

---

## 🚀 DEPLOYMENT

### Environments

| Environment | Endpoint | Purpose | Promotion/data policy |
|---|---|---|---|
| Development | Local endpoints; ports TBD | Implementation and automated/local verification. | Synthetic or approved development data only; local secrets remain uncommitted. |
| Staging | TBD | Production-like integration, migration, security, and deployment validation. | Promoted from reviewed commits; no unapproved production-data copy. |
| Production | TBD | Customer traffic and authoritative business processing. | Controlled promotion with monitoring, rollback/recovery plan, and one migration owner. |

### Infrastructure

Stage 1 uses one logical web app, one modular API, one primary database, and one Redis deployment, plus only approved worker/scheduler/storage needs. Apply bounded DB pooling; PgBouncer deployment and provider selection require TECH_CARD alignment. Run controlled, compatible migrations once per release, not independently on each API startup. See [`02-TECH_STACK.md`](./02-TECH_STACK.md) for technology/provider decisions.

Each runnable component must expose an appropriate health signal, emit correlated telemetry, receive secrets through the approved environment mechanism, and have documented ownership. Hosting regions, network boundaries, backup/restore targets, deployment ordering, rollback behavior, and disaster-recovery objectives remain pending TECH_CARD approval.

---

## 📈 SCALING — SIZE C

**Current architecture: Stage 1 only.** The roadmap's active-user bands are illustrations; they are not validated capacity limits or mandatory upgrade dates.

### Current baseline

No deployed application or production workload exists yet, so there is no measured baseline for active users, request rate, latency, database size, connection utilization, cache hit rate, queue throughput/age, error rate, or tenant fairness. Stage 1 capacity targets and service-level objectives must be defined in the approved TECH_CARD; measurements begin in staging and are revalidated with production telemetry. Until evidence exists, this document makes no capacity guarantee.

### Scaling plan

| Stage | Conditional evolution (requires demonstrated need and approval) |
|---|---|
| 1 — MVP | Modular monolith, primary PostgreSQL, single Redis, relevant workers, basic monitoring/security. |
| 2 — Early growth | Additional stateless API/worker instances, load balancing, stronger Redis availability, DB connection management/tuning. |
| 3 — Scale | Selective read replicas, workload-specific Redis split, specialized search or module extraction only if justified. |
| 4 — Large scale | Tenant-specific DB isolation, independently deployed services, advanced events/DR if bottlenecks require them. |
| 5 — Enterprise | Multi-region and stronger compliance/data-residency architecture only for real business requirements. |

**Change gate:** measure (latency, errors, DB saturation, queue age, tenant fairness) → diagnose → record alternatives and approval → load/recovery test → deploy → update actual-state architecture. Kafka is not a direct BullMQ replacement, and user count alone never triggers sharding or microservices.

---

## 📋 KEY DECISIONS

The identifiers below reserve traceable decision records; they are not accepted ADRs until the corresponding files are created and approved under `docs/architecture/` or recorded in `DECISIONS.md`.

| Decision | Architectural position | Rationale | Status | ADR reference |
|---|---|---|---|---|
| Project classification | Size C | The proposed domain has multiple bounded capabilities, tenant isolation, background processing, and expected long-term evolution; the completed BRIEF must validate that complexity. | Proposed | `ADR-001-project-size`, planned |
| Initial backend topology | Modular monolith | Provides one manageable MVP deployment while enforcing module ownership and leaving evidence-based extraction possible later. | Proposed | `ADR-002-modular-monolith`, planned |
| Functional organization | Every capability is a module | Keeps activation, dependency, and ownership concerns explicit without creating an artificial Core/Extension hierarchy. | Proposed | `ADR-003-module-model`, planned |
| Multi-tenancy | Shared primary database with organization-aware isolation | Minimizes initial operational complexity while composite constraints and authorization checks protect tenant boundaries. | Proposed; threat/data review required | `ADR-004-multi-tenancy`, planned |
| Sessions | Revocable server-side credentials | Supports immediate tenant-user/session revocation without relying on long-lived self-contained authorization claims. | Proposed; security approval required | `ADR-005-session-strategy`, planned |
| Asynchronous work | Transactional outbox, durable queue, idempotent consumers | Couples business state and event intent atomically while allowing retryable effects outside request latency. | Conditional on approved async use cases | `ADR-006-async-delivery`, planned |
| Versions, providers, and hosting | Defined in TECH_CARD and `02-TECH_STACK.md` | Keeps replaceable technology selections out of architectural invariants and makes approval ownership explicit. | Pending | No ADR until a choice has architectural consequences |
| Future architecture | Metrics-driven conditional evolution | Avoids premature services, replicas, sharding, or multi-region complexity without measured bottlenecks or business requirements. | Accepted as a decision principle; formal approval pending | `ADR-007-scaling-gates`, planned |

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
