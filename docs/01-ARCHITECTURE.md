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

Give multiple organizations isolated workspaces for customer relationships, deals, tasks, delivery operations, communications, and inventory-related workflows. A person may belong to several organizations, with separate permissions and module availability in each.

### Main capabilities

- Organization-aware users, memberships, permissions, and revocable sessions.
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
| `ARCH-TEN-001` | Each tenant-scoped operation checks organization, current membership, authorization, module entitlement, and resource scope. |
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
| Realtime gateway | Deliver authorized, non-authoritative UI updates and revalidate access when tenant membership changes. | API-hosted gateway or separate process, to be decided | **Conditional MVP component**; protocol and provider are pending. | Receives approved events and pushes hints to connected clients; durable business delivery uses the outbox/queue path. |
| Object storage | Store approved user files using tenant-scoped object keys and authorized upload/download flows. | Shared storage adapter plus owning-module integration | **Optional**; provider and file requirements are pending BRIEF and TECH_CARD approval. | The API authorizes operations; direct uploads use short-lived scoped credentials when supported. |
| Observability | Collect structured logs, metrics, traces, health signals, and security-relevant audit events without exposing secrets. | Shared instrumentation package/configuration, location TBD | Required capability; products, retention, and alerting are pending. | Every runnable component emits correlated telemetry; business audit records remain distinct from operational logs. |

### Frontend

Presents enabled modules, queries the API, and responds to authorized realtime updates. Browser-side caching improves UX but never determines access rights. Server-rendered and client-rendered boundaries should follow actual interaction and performance needs rather than making the entire application client-side. The browser connects to neither PostgreSQL nor Redis. Technology/version details are maintained in [`02-TECH_STACK.md`](./02-TECH_STACK.md).

### Backend

One initial REST API deployment implements authentication, tenant context, authorization, business operations, transactions, and outbox writes. Module boundaries are enforced in code review and tests, not merely by folder naming.

### Functional modules

| Area | Modules / responsibility |
|---|---|
| Workspace & access | Organizations; Identity & Sessions; Access Management; Module Management |
| Customer work | Contacts; Leads; Deals; Pipelines; Tasks; Orders & Delivery |
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
Client → Web → REST API → validate opaque session → select organization
       → current membership + permission + entitlement + resource checks
       → validate input → owning module → transaction/DB → response
```

If a business-critical event is produced, the business write and event record commit together. The client updates/invalidate its local API cache after confirmed changes.

### Authentication and revocation

```text
Login → validate credentials → create opaque session → store in Redis
      → deliver HttpOnly/Secure cookie to the web client
Request → session valid? → tenant membership active? → authorized? → execute
Owner removes employee from Organization A
      → synchronously disable A membership and invalidate its auth state
      → deny later A requests and terminate/revalidate A realtime access
      → keep Organization B membership intact if separately authorized
```

**Fail closed:** Redis/cache outages cannot silently reactivate stale rights. Define a policy for requests already in flight when a membership is deactivated.

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
| Tenancy/access | `users`, `organizations`, `memberships`, roles, permissions, module entitlements |
| CRM/work | contacts, leads, deals, pipelines/stages, tasks and links, orders/items |
| Communication | channel accounts, conversations, messages, notifications |
| Catalog/inventory | products/variants, locations, stock balances/movements, transfers/items |
| System history | outbox events, processed events, audit logs |

### Conceptual relationships

```text
User ──< Membership >── Organization ──< enabled modules
Organization ──< Contacts ──< Deals >── Pipeline stages
Organization ──< Tasks; Organization ──< Orders
Product ──< Variants ──< Stock levels >── Locations
Transfer ──< Transfer items >── Variants
Channel account ──< Conversations ──< Messages
```

**Rules:** use one agreed tenant key; enforce organization scope and cross-tenant FK integrity; implement RLS only with safe per-transaction context when using transaction pooling; maintain append-only stock movements and safe concurrent inventory updates. Use measured query shapes for indexes and expand/deploy/backfill/contract for schema changes. If replicas are later introduced, strong-consistency/read-after-write reads remain on primary.

Executable schema, constraints, ERD, and indexes belong in [`05-DATABASE.md`](./05-DATABASE.md) and migrations—not here.

---

## 🔌 INTEGRATIONS

Messaging channels, email/SMS, file storage, observability, and billing are integrated **only to the extent approved by BRIEF and TECH_CARD**. Provider-specific choices and versions belong in [`02-TECH_STACK.md`](./02-TECH_STACK.md); endpoint and webhook contracts belong in [`04-API.md`](./04-API.md). Inbound webhooks require supported signature checks and deduplication.

---

## 🔐 SECURITY

- **Authentication:** opaque, high-entropy server-side sessions; secure web cookies and CSRF/Origin protection. Mobile, if approved, may use opaque bearer session credentials in OS secure storage—not self-contained JWTs.
- **Authorization:** organization-aware Owner/Admin/Member templates plus live membership, permissions, resource checks, and module entitlement. Platform-operator permissions are distinct.
- **Revocation:** revoke affected organization access synchronously; do not put the security-critical action solely behind a queue. Define session expiry/rotation and outage policy in the approved security design.
- **Protection:** TLS, constrained CORS, validated input, tiered rate limits, worker-level tenant fairness, idempotency where duplicate effects are dangerous, secret-safe structured logs, auditable sensitive actions.

---

## 🚀 DEPLOYMENT

| Environment | Status |
|---|---|
| Development | Local developer environment; commands/ports specified in README and TECH_CARD. |
| Staging | Endpoint/provider TBD; integration and deployment validation. |
| Production | Endpoint/provider TBD; verified backups, monitoring, and controlled migrations. |

Stage 1 uses one logical web app, one modular API, one primary database, and one Redis deployment, plus only approved worker/scheduler/storage needs. Apply bounded DB pooling; PgBouncer deployment and provider selection require TECH_CARD alignment. Run controlled, compatible migrations once per release, not independently on each API startup. See [`02-TECH_STACK.md`](./02-TECH_STACK.md) for technology/provider decisions.

---

## 📈 SCALING — SIZE C

**Current architecture: Stage 1 only.** The roadmap's active-user bands are illustrations; they are not validated capacity limits or mandatory upgrade dates.

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

| Decision | Architectural position | Approval note |
|---|---|---|
| Project classification | Size C | Established project classification. |
| Initial backend topology | Modular monolith | Stage 1 architecture target. |
| Functional organization | Every capability is a module | No Core/Extension split. |
| Multi-tenancy | Shared primary DB with organization-aware isolation | Detailed constraints in database design. |
| Sessions | Revocable server-side credentials | Organization-scoped denial is mandatory. |
| Asynchronous work | Transactional outbox + queue + idempotent consumers | Enable jobs demanded by approved MVP scope. |
| Versions/providers/hosting | Listed in `02-TECH_STACK.md` | Pending items remain **TBD** until TECH_CARD approval. |
| Future architecture | Metrics-driven conditional options | Later-stage services are **not** current components. |

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
