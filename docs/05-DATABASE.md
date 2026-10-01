# Database Documentation: Lobby

> This document records the logical data model, ownership rules, and migration policy. It starts intentionally small; executable truth will live in committed schema files and migrations after implementation begins.

- **Database:** PostgreSQL (implemented)
- **Toolkit:** Prisma 7 and versioned SQL migrations (implemented)
- **Tenancy:** Shared database with session-derived organization scope and tenant-safe constraints (implemented; no RLS)
- **Version:** 0.1-draft
- **Status:** ACTIVE — current schema inventory and database rules; future module schemas remain explicitly planned

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

| Group                   | Representative entities                                                                                   | Owning area                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Tenancy and access      | tenants, tenant-owned users, roles, permissions, module entitlements                                      | Organizations / Identity / Access Management  |
| CRM                     | contacts, deals, pipelines, stages                                                                        | Contacts / Deals / Pipelines                  |
| Work management         | tasks and task links                                                                                      | Tasks                                         |
| Restaurant reservations | venues, dining areas, restaurant tables, service periods, reservations, table assignments, status history | Reservations                                  |
| Operations              | orders, order items, delivery state                                                                       | Orders and Delivery; conditional              |
| Communication           | channel accounts, conversations, messages, notifications                                                  | Messaging / Notifications; conditional        |
| Catalog and inventory   | products, variants, locations, stock movements, transfers                                                 | Catalog / Inventory; later scope              |
| System history          | audit records, outbox events, processed-event records                                                     | Shared infrastructure with explicit ownership |

These names are conceptual, not final table names.

---

## Conceptual relationships

```text
Tenant/Organization ──< Users
Organization ──< Contacts
Organization ──< Pipelines ──< Stages
Contact ──< Deals >── Stage
Organization ──< Tasks
Task ── optional links ──> Contact / Deal / Order
Organization ──< Audit records
Business transaction ──> Outbox event
Organization ──< Venues ──< Dining areas ──< Restaurant tables
Venue ──< Service periods
Venue ──< Reservations ──< Table assignments >── Restaurant tables
Reservation ──< Reservation status history
```

An approved physical ERD will replace or extend this view when models are designed.

---

## Entity documentation template

| Field            | Description                                    |
| ---------------- | ---------------------------------------------- |
| Entity/table     | Logical and physical name                      |
| Owner            | Functional module responsible for writes       |
| Tenant scope     | Global or organization-scoped                  |
| Primary key      | Type and generation strategy                   |
| Important fields | Business meaning, nullability, and defaults    |
| Relationships    | Referenced entities and delete/update behavior |
| Constraints      | Unique, check, and cross-tenant protections    |
| Indexes          | Query supported and evidence for the index     |
| Retention        | Archive/delete/anonymization policy            |
| Audit/events     | Relevant audit records and emitted events      |

---

## Tenant isolation

- Each User belongs to exactly one Tenant through the required `users.tenant_id` foreign key.
- The same normalized email may identify separate User records in different tenants.
- Authentication therefore requires tenant context plus email.
- The first user created with a tenant is always its Owner (`users.role = OWNER`, `users.status = ACTIVE`).
- Tenant, Owner, the plan's default `tenant_modules` rows, and the `tenant.created` outbox event are committed atomically. A failure in any of those writes rolls the transaction back.
- `tenant_modules` is keyed by `(tenant_id, module_key)` with status `ENABLED` or `DISABLED`. A missing row is disabled. Identity and health are not rows in this table.
- Password hashing belongs to Auth; Organizations receives only an Argon2id `passwordHash`.
- Login finds the user, rejects a non-ACTIVE status, and only then verifies the hash.
- The worker dispatch registry delivers `tenant.created` version 1 (`userId`) and version 2 (`ownerUserId`). Any other version is a permanent outbox failure.
- The owner-authentication migration stops before changing data when two subdomains or two emails in one tenant fold to the same lowercase value, a plan is not `starter`, or a tenant already has more than one user. A single pre-existing user becomes a DISABLED owner with a fixed Argon2id hash whose plaintext is unknown.
- `subdomain` and `email` are stored lowercase, enforced by database check constraints.
- The only approved tenant plan is `starter`. Additional plans need a product decision.
- Multi-organization membership and organization switching are intentionally unsupported; do not add a membership join table.
- Email uniqueness is tenant-scoped through `(tenant_id, email)`.
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
- `ContactCreatedHandler` and `TenantCreatedHandler` have no external side effect. Their in-memory event sets are process-local. A handler that sends email, SMS, a webhook, a push, or another third-party call must register with `defineExternalHandler`, which reserves a `processed_events` row before the call.
- Active table assignments use a PostgreSQL exclusion constraint over tenant, table, and half-open UTC time range (`[start, end)`) so concurrent requests cannot double-book a table.
- Reservation status and each assignment's `blocks_availability` flag change in one transaction; terminal outcomes release availability according to module policy.

---

## Worker dispatch registry

The worker resolves each outbox row by the composite key `eventType@eventVersion` in `apps/worker/src/dispatch/event-registry.ts`. One key has one entry. A duplicate key fails process startup. An unknown key does not fall back to another version or handler: the row becomes `FAILED` immediately, and the log records event type, version, and event id without the payload.

Retry classification is set on each handler, not on the entry. One event can register several handlers with different classifications.

Dispatch runs handlers in order and stops at the first throw. That handler's classification decides the single outbox row. A later handler does not run, so its classification is not consulted on that attempt. Put a handler that must reject the event before one whose work should not start after that rejection.

| Classification           | When that handler throws                                           | Examples                                    |
| ------------------------ | ------------------------------------------------------------------ | ------------------------------------------- |
| `transient`              | Retry with the existing exponential backoff, then `FAILED`         | Temporary downstream outage                 |
| `permanent`              | `FAILED` on the first failure                                      | Business rule that will not change on retry |
| `idempotent-side-effect` | The outbox row may retry. The external call itself is at-most-once | Email, SMS, webhook, push, third-party API  |

A `PermanentDispatchError` is permanent even when that handler's classification is retryable. Invalid payloads are permanent. `idempotent-side-effect` is unused until a handler performs a real external call. No email, SMS, or webhook provider is wired yet, so none of those providers' idempotency keys are available. The worker therefore reserves first instead of asking a provider to dedupe.

### External side effects

`defineExternalHandler` binds the handler to `processed_events`. Dispatch inserts `(handler_name, event_type, event_version, event_id)` in its own transaction before `handle`. The unique key `processed_events_handler_event_key` makes a second start a no-op.

This is at-most-once. If the process dies after the provider accepted the call, the reservation remains and a retry does not send again. The same is true if `handle` throws after the reservation and the provider never accepted the call: the worker cannot tell those two cases apart, so it does not retry the call. A later poll can still mark the outbox row `PUBLISHED`, because the effect will not be started again. Deleting the `processed_events` row is a separate manual step and is required before a forced resend. Requeue does not delete it.

A failed insert does not call `handle`. There is no production handler of this kind yet. The mechanism is covered by tests that use a mock handler. The first real handler must be registered with `defineExternalHandler` and a `PrismaProcessedEventStore`. Do not implement `wasAlreadyApplied` on the handler.

Current entries:

| Key                 | Handler                 | Retry       | External side effect |
| ------------------- | ----------------------- | ----------- | -------------------- |
| `contact.created@1` | `ContactCreatedHandler` | `transient` | no                   |
| `tenant.created@1`  | `TenantCreatedHandler`  | `transient` | no                   |
| `tenant.created@2`  | `TenantCreatedHandler`  | `transient` | no                   |

### Adding a handler

Deploy the worker that understands the new key before the API starts writing it. An old worker marks an unknown `eventType@eventVersion` as `FAILED` immediately, with no automatic retry. There is no automatic replay of those rows.

1. Add a versioned contract in `@lobby/contracts` and register `eventType@eventVersion` in `createWorkerEventRegistry`. Do not reuse an existing literal for a new payload.
2. Deploy that contract and the worker. Confirm the worker is up (health check or logs) before the next step.
3. Only then deploy the API that enqueues the new event.
4. Set each handler's `retryClassification` to `transient`, `permanent`, or `idempotent-side-effect`. Do not infer it from whichever error the handler happens to throw. Do not put one classification on the whole entry.
5. Register email, SMS, webhook, push, or another third-party call with `defineExternalHandler` and a `PrismaProcessedEventStore`. Do not set `hasExternalSideEffect` by hand and do not add a handler-local dedupe check.
6. Leave database-only and pure handlers on `bindSideEffectFree` (`hasExternalSideEffect: false`).
7. Add a delivery test for the new key. When the handler has an external side effect, dispatch the same event twice, including a retry after a simulated crash, and assert the effect runs once.

### Requeue a FAILED outbox row

Requeue is a manual operator command. The worker poll loop never calls it, so a bad deploy cannot replay every `FAILED` row by itself.

`attempts` is reset to 0. A deployment mismatch fails the row on the first claim, and an exhausted retry already sits at the attempt budget. Leaving that counter in place makes the next claim fail again before the handler runs. The operator has decided this row deserves a full budget. `lastError` and the claim lock are cleared, and `availableAt` is set so the next poll can claim the row. Payload and identity stay as they were. Only `FAILED` rows change; `PUBLISHED`, `PENDING`, and `PROCESSING` rows are left alone.

Build the worker, then from `apps/worker` with `DATABASE_URL` pointing at the target database:

```text
pnpm requeue -- --id <outbox-event-uuid>
pnpm requeue -- --event contact.created@1
```

`--id` returns one row to `PENDING`. `--event` returns every `FAILED` row for that `eventType@eventVersion`. The command prints how many rows changed and exits 1 when none matched.

After a rolling deploy that enqueued events before the worker knew the key:

1. Deploy the worker that registers the key, and confirm it is healthy.
2. Run `pnpm requeue -- --event <eventType>@<eventVersion>` once.
3. Watch the next poll publish those rows, or fail them again for a real handler error. Do not run the command on a loop.

Rows that failed as unknown events have no `processed_events` reservation, so this requeue still delivers them. Requeue does not delete a reservation. It will not force a second send of an effect that already started.

---

## Migration policy

1. Every schema change is represented by a committed migration.
2. Review generated SQL and existing-data impact before application.
3. Use expand/deploy/backfill/contract for compatibility-sensitive changes.
4. Production runs one migration job per database per release.
5. Migrations never run from developer laptops, app startup, request handlers, or `next build`.
6. Destructive or irreversible operations require explicit approval, backup/recovery preparation, and a documented rollout plan.

The runtime uses least-privilege `DATABASE_URL`; privileged migration access such as `DIRECT_URL` is available only inside the migration job.

The repository currently contains ten ordered migrations covering tenant/users, outbox, reservation foundation, authentication fields, processed events, tenant modules, audit events, the audit pagination index, the contact archive columns, and the contact archive audit actions. Local and CI integration tests deploy these migrations into dedicated PostgreSQL test databases.

---

## Schema inventory

| Module                  | Tables/models                                                                                                                        | Status                 | Notes                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organizations           | `tenants`, `users`                                                                                                                   | Implemented            | `createWithOwner` writes the tenant, the ACTIVE OWNER (`password_hash` only), and `tenant.created` version 2 in one transaction. Sessions and module entitlements are separate. Auth hashes the password and calls this operation.                                                                                                                                                                        |
| Contacts                | `contacts`                                                                                                                           | Implemented            | Tenant-owned contacts. Soft archive uses `archived_at`. Email is unique per tenant, including archived rows. `(tenant_id, name, id)` serves the list order. Create writes outbox `contact.created` in the same transaction. Update and archive do not write outbox events until a consumer exists. Archive appends audit `contact.archived`, and restore appends audit `contact.restored`, with no email or phone. |
| Tasks                   | TBD                                                                                                                                  | Planned                | Version 1 high priority; relationship model requires approval.                                                                                                                                                                                                                                                                                                                                            |
| Deals and pipelines     | TBD                                                                                                                                  | Planned                | Version 1 high priority.                                                                                                                                                                                                                                                                                                                                                                                  |
| Restaurant reservations | `venues`, `dining_areas`, `restaurant_tables`, `service_periods`, `reservations`, `reservation_tables`, `reservation_status_history` | Foundation implemented | Tenant-safe relations and database-enforced overlap prevention; API operations are not implemented.                                                                                                                                                                                                                                                                                                       |
| Orders and delivery     | TBD                                                                                                                                  | Conditional            | Add only if included in Version 1.                                                                                                                                                                                                                                                                                                                                                                        |
| Audit and outbox        | `audit_events`, `outbox_events`, `processed_events`                                                                                  | Implemented            | `audit_events` is append-only application history, separate from operational logs. List pages use the `(tenant_id, occurred_at, id)` index. No retention job is defined, so rows are not deleted. Pending outbox rows are claimed with `FOR UPDATE SKIP LOCKED`. `processed_events` reserves an external side effect before it starts. Unique key: `(handler_name, event_type, event_version, event_id)`. |

### Planned tenant-defined RBAC storage

The current `users.role` enum remains authoritative until a reviewed migration introduces tenant role definitions, role-permission rows, and user-role assignment. Future role rows carry `tenant_id`; role names are unique within a tenant; permission keys come from the application-owned catalog; and composite foreign keys prevent cross-tenant assignments. `OWNER` is a protected system role, and the database/application transaction must preserve at least one active Owner per tenant. Access changes and their successful audit record are written atomically, and affected users receive an `authentication_version` increment.

Audit history remains append-only. Role creation/update/disable, permission changes, role assignment, user disablement, session termination, and approved sensitive business transitions record actor, tenant, action, outcome, resource, timestamp, request id, and privacy-safe metadata. Secrets, password hashes, session ids, tokens, message bodies, and raw IP addresses are forbidden in audit metadata.

### Reservation data rules

- Store instants in UTC; each venue stores an IANA timezone for calendar display and local opening-hour interpretation.
- A reservation belongs to one tenant and one venue. Optional contact and creator references belong to that same tenant.
- Every assigned table belongs to the reservation's venue and tenant; one party may use several tables.
- Capacity and service-period checks belong to the reservation application transaction; the overlap exclusion constraint is the final concurrency guard.
- Same-day service windows are supported initially. Represent overnight service as split periods until a dedicated rule is approved.
- The reservation migration requires PostgreSQL `btree_gist`; production deployment follows the controlled migration process.

Replace `TBD` entries with links to approved model/ERD sections when schema design begins.

---

## Operational decisions still required

- Production PostgreSQL provider, region, and supported version. Local/CI currently use PostgreSQL 17.
- Connection pooling and per-runtime limits.
- Statement, lock, and idle-transaction timeouts.
- Backup retention, restore testing, RPO, and RTO.
- Production runtime and migration database roles/grants.
- Integration-test clients deploy migrations into unique PostgreSQL schemas and explicitly drop only their own schema during teardown. Keep using `createTestPrismaClient()` and `disposeTestPrismaClient()` so parallel suites remain isolated.
- PostgreSQL RLS is not part of this foundation. Tenant isolation is the application query scope. Revisit RLS only with a reviewed pooling and threat plan.

---

## Related documents

- [`BRIEF.md`](./BRIEF.md) — product and Version 1 scope.
- [`TECH_CARD.md`](./TECH_CARD.md) — approved database technology and operational decisions.
- [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md) — data ownership and system invariants.
- [`02-TECH_STACK.md`](./02-TECH_STACK.md) — implemented database/Redis stack and open provider decisions.
- [`03-STRUCTURE.md`](./03-STRUCTURE.md) — schema and migration package location.
- [`04-API.md`](./04-API.md) — request contracts that drive query and transaction design.
