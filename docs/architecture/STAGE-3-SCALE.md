# Stage 3 — Scale

- **Active users:** 10,000–50,000
- **Theme:** Add specialized components.
- **Status:** Conditional target; not current architecture

## Architecture

```text
Next.js web
    |
Optional API gateway
    |-------------------------------|
CRM capability  Task capability  Other modules
    |-------------------------------|
PostgreSQL primary + read replicas
Redis cluster or workload-specific Redis deployments
Autoscaled workers + scheduler
Optional search engine
```

Logical capability separation does not automatically mean separate services. Keep a modular monolith unless independent deployment or scaling evidence justifies extraction.

## Core components

- Optional API gateway for a demonstrated routing, policy, or client-management need.
- PostgreSQL primary with selective read replicas for explicitly stale-tolerant reads.
- Separate or clustered Redis workloads when session/cache/queue isolation is necessary.
- Autoscaled API/worker workloads and an approved scheduler.
- Search engine only when measured PostgreSQL search cannot meet approved requirements.
- Advanced APM, alerting, capacity dashboards, and regular load testing.

## Focus

- Handle higher traffic without weakening tenant isolation or correctness.
- Offload proven read-heavy workloads.
- Add specialized services only for a specific problem.
- Improve reliability, recovery, and workload isolation.
- Prepare for high-usage tenants without forcing every tenant onto a costly topology.

## Required practices

- Explicit primary/read-replica routing; read-after-write and authorization-sensitive reads stay on primary.
- Separate Redis namespaces/deployments for sessions, queues, and caches as failure domains require.
- Feature flags and safe rollout/rollback controls.
- Service-level objectives, paging alerts, and error-budget review.
- Event schema/version governance and producer-after-consumer rollout.
- Regular load, failover, restore, and backlog-recovery tests.

## Move toward Stage 4 when

- Usage is approaching or exceeding 50,000 active users and independent workload scaling is required.
- Primary read pressure remains material after query/index/cache/read-replica work.
- Search requirements have become independent and complex.
- One or more large tenants require dedicated capacity or isolation.
- A module has a distinct availability, throughput, deployment, ownership, or security boundary.

Extraction candidates require an ADR covering ownership, data movement, consistency, failure modes, observability, and rollback.
