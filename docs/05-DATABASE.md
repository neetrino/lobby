# Database Documentation: Lobby

> This document records the logical data model, ownership rules, and migration policy. It starts intentionally small; executable truth will live in committed schema files and migrations after implementation begins.

- **Database:** PostgreSQL (proposed)
- **Toolkit:** Prisma (proposed)
- **Tenancy:** Shared database with organization-aware isolation (proposed)
- **Version:** 0.1-draft
- **Status:** DRAFT — no physical schema is approved or implemented yet

---

## Documentation approach

- This document explains logical ownership, constraints, and important query/migration decisions.
- The ORM schema and committed migrations are the executable schema history.
- Each schema change updates this document when it changes entities, relationships, constraints, indexes, retention, or ownership.
- Detailed columns are documented only when their module design is approved.

---

## Core principles

- PostgreSQL is the source of truth for tenant, business, audit, and outbox data.
- Each functional module owns its business tables and writes.
- Tenant-scoped records use one agreed organization key.
- Composite constraints prevent references across organizations where the database can enforce them.
- Application authorization remains mandatory even if RLS is later added.
- Multi-step writes use transactions; concurrency-sensitive operations define an explicit conflict strategy.
- Runtime applications use least-privilege credentials and never receive schema-owner access.

---

## Logical data groups

| Group | Representative entities | Owning area |
|---|---|---|
| Tenancy and access | users, organizations, memberships, roles, permissions, module entitlements | Organizations / Identity / Access Management |
| CRM | contacts, deals, pipelines, stages | Contacts / Deals / Pipelines |
| Work management | tasks and task links | Tasks |
| Operations | orders, order items, delivery state | Orders and Delivery; conditional |
| Communication | channel accounts, conversations, messages, notifications | Messaging / Notifications; conditional |
| Catalog and inventory | products, variants, locations, stock movements, transfers | Catalog / Inventory; later scope |
| System history | audit records, outbox events, processed-event records | Shared infrastructure with explicit ownership |

These names are conceptual, not final table names.

---

## Conceptual relationships

```text
User ──< Membership >── Organization
Organization ──< Contacts
Organization ──< Pipelines ──< Stages
Contact ──< Deals >── Stage
Organization ──< Tasks
Task ── optional links ──> Contact / Deal / Order
Organization ──< Audit records
Business transaction ──> Outbox event
```

An approved physical ERD will replace or extend this view when models are designed.

---

## Entity documentation template

| Field | Description |
|---|---|
| Entity/table | Logical and physical name |
| Owner | Functional module responsible for writes |
| Tenant scope | Global or organization-scoped |
| Primary key | Type and generation strategy |
| Important fields | Business meaning, nullability, and defaults |
| Relationships | Referenced entities and delete/update behavior |
| Constraints | Unique, check, and cross-tenant protections |
| Indexes | Query supported and evidence for the index |
| Retention | Archive/delete/anonymization policy |
| Audit/events | Relevant audit records and emitted events |

---

## Tenant isolation

- Resolve the organization from the authenticated request context, not from unchecked client input alone.
- Include the organization key in tenant-scoped uniqueness and relationship constraints where necessary.
- Every tenant query is scoped explicitly and tested against cross-tenant access.
- Platform-level operations use separate permissions and auditable paths.
- RLS remains optional defense in depth until transaction/pooling context is safely designed.

---

## Queries and indexes

- Parameterize all values; allowlist dynamic identifiers such as sort fields.
- Paginate potentially unbounded reads.
- Add indexes for actual filters, joins, and ordering patterns, then validate important queries with `EXPLAIN`.
- Prevent N+1 behavior through explicit selection, relation loading, or batching.
- Strong-consistency/read-after-write operations use the primary if replicas are introduced later.

---

## Transactions and concurrency

- Use transactions when several writes must succeed or fail together.
- Inventory, state transitions, uniqueness-sensitive writes, and outbox claiming require an explicit locking, optimistic-concurrency, or idempotency strategy.
- Business data and its critical outbox event are committed in the same transaction.
- Consumers tolerate at-least-once delivery and record idempotent processing where needed.

---

## Migration policy

1. Every schema change is represented by a committed migration.
2. Review generated SQL and existing-data impact before application.
3. Use expand/deploy/backfill/contract for compatibility-sensitive changes.
4. Production runs one migration job per database per release.
5. Migrations never run from developer laptops, app startup, request handlers, or `next build`.
6. Destructive or irreversible operations require explicit approval, backup/recovery preparation, and a documented rollout plan.

The runtime uses least-privilege `DATABASE_URL`; privileged migration access such as `DIRECT_URL` is available only inside the migration job.

---

## Schema inventory

| Module | Tables/models | Status | Notes |
|---|---|---|---|
| Organizations and access | TBD | Planned | Design first because other tenant-scoped models depend on it. |
| Contacts | TBD | Planned | MVP high priority. |
| Tasks | TBD | Planned | MVP high priority; relationship model requires approval. |
| Deals and pipelines | TBD | Planned | MVP high priority. |
| Orders and delivery | TBD | Conditional | Add only if promoted into MVP. |
| Audit and outbox | TBD | Planned | Exact retention and processing model unresolved. |

Replace `TBD` entries with links to approved model/ERD sections when schema design begins.

---

## Operational decisions still required

- PostgreSQL provider and exact supported version.
- Prisma and driver versions.
- Connection pooling and per-runtime limits.
- Statement, lock, and idle-transaction timeouts.
- Backup retention, restore testing, RPO, and RTO.
- Seed/test-data strategy.
- Whether RLS is justified and how tenant context is safely applied.

---

## Related documents

- [`BRIEF.md`](./BRIEF.md) — product and MVP scope.
- [`TECH_CARD.md`](./TECH_CARD.md) — approved database technology and operational decisions.
- [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md) — data ownership and system invariants.
- [`02-TECH_STACK.md`](./02-TECH_STACK.md) — proposed database and Redis stack.
- [`03-STRUCTURE.md`](./03-STRUCTURE.md) — schema and migration package location.
- [`04-API.md`](./04-API.md) — request contracts that drive query and transaction design.

