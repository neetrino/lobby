# Stage 2 — Early Growth

- **Active users:** 1,000–10,000
- **Theme:** Harden. Improve performance.
- **Status:** Conditional target; not current architecture

## Architecture

```text
Next.js web
    |
Load balancer
    |-------------------|
NestJS API instance  NestJS API instance(s)
    |-------------------|
PostgreSQL + connection pooler
Redis with managed high availability
Separate scalable workers
```

## Core components

- Multiple stateless API instances behind a load balancer.
- PgBouncer or provider-approved pooling with explicit connection budgets.
- Managed Redis with high availability for approved sessions, cache, limits, or queues.
- Independently deployable workers; BullMQ remains optional if the PostgreSQL outbox is sufficient.
- Monitoring, alerting, tracing/APM where measurements justify it.
- Point-in-time recovery and rehearsed restore procedures.

## Focus

- Horizontal-scaling readiness and stateless request handling.
- Better observability and actionable service-level indicators.
- Query/index optimization before adding new data systems.
- Worker throughput and tenant-fair concurrency.
- Reliability improvements and cost control.

## Required practices

- Multi-level rate limiting by tenant, user, endpoint, and IP where appropriate.
- Tenant-aware worker concurrency so one tenant cannot monopolize shared capacity.
- Bounded retries, dead-letter/failure policy, replay controls, and durable idempotency.
- Cache only frequently read data with explicit TTL, invalidation, outage, and tenant-scoping rules.
- Validate indexes and critical query shapes with production-like evidence.
- Keep sessions/revocation correct across all API instances.

## Move toward Stage 3 when

- Usage is approaching or exceeding 10,000 active users and the Stage 2 topology is measurably constrained.
- Read load materially affects the primary database.
- Queue/outbox backlog grows under normal peaks despite tuned workers.
- Product requirements justify specialized search, analytics, or isolated workload components.
- Large tenants create demonstrably different load profiles.

API replication alone is not evidence that the modular monolith must be split.
