# Stage 1 — Version 1

- **Active users:** 0–1,000
- **Theme:** Simple. Solid. Validate.
- **Lobby status:** Current architectural baseline

## Architecture

```text
Next.js web
    |
NestJS API — modular monolith
    |------------------|
PostgreSQL          Redis
primary source      sessions/cache/rate limits when enabled
    |
Outbox worker (approved asynchronous effects)
```

## Core components

- One Next.js frontend deployment.
- One NestJS modular-monolith API deployment.
- One primary PostgreSQL database with tenant-safe constraints and bounded connections.
- One Redis deployment for approved ephemeral workloads; PostgreSQL remains the business source of truth.
- Transactional outbox and independently runnable worker where durable asynchronous work is required.
- Basic health checks, structured logs, request correlation, metrics, backups, and CI/CD.

BullMQ is conditional, not a Stage 1 requirement. Lobby currently has a PostgreSQL transactional outbox; add a Redis-backed queue only when a real delayed/high-throughput workload justifies it.

## Focus

- Validate product-market fit and core CRM, task, reservation, and operational workflows.
- Complete authentication, tenant context, authorization, and module isolation.
- Build secure multi-tenancy and reliable database invariants.
- Keep deployments and operational ownership simple.
- Establish useful automated tests and CI/CD.

## Required practices

- Preserve all approved architectural invariants and the one-user/one-tenant rule.
- Derive `tenantId` from the authenticated session; never trust client-supplied tenant context.
- Apply basic endpoint/account/IP rate limits.
- Use idempotency where retries can duplicate a critical operation.
- Write business data and required outbox intent in one transaction.
- Use structured logs, request IDs, error metrics, database metrics, and queue/outbox age metrics.
- Test migrations and backup restoration before production use.

## Move toward Stage 2 when

- The product has validated usage and is approaching or exceeding 1,000 active users.
- API CPU, latency, connection pressure, queue age, or tenant fairness shows a repeatable bottleneck.
- A single API/worker instance no longer meets the approved service objective.
- Monitoring and a reproducible load test confirm the diagnosis.

Do not move only because a forecast predicts growth. Record the bottleneck, alternatives, cost, rollback, and approval in an ADR.

## Not justified at this stage

- Microservices, Kafka, sharding, multi-region databases, global search clusters, or tenant-specific databases.
- Infrastructure introduced without an observed product, reliability, security, or compliance requirement.
