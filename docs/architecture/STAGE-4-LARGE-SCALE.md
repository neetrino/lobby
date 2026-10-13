# Stage 4 — Large Scale

- **Active users:** 50,000–200,000
- **Theme:** Distribute. Isolate. Optimize.
- **Status:** Conditional target; not current architecture

## Architecture

```text
Next.js web
    |
Global load balancer / CDN
    |---------------------------------------|
CRM service  Task service  Messenger  Other services
    |---------------------------------------|
PostgreSQL sharding or selected tenant-dedicated databases
Redis cluster       Search cluster
Event streaming when throughput requires it
Autoscaled workers
```

## Core components

- Independently deployed services only for modules with proven boundaries.
- PostgreSQL sharding or dedicated databases for selected large tenants, not automatically for all tenants.
- Redis cluster and independent workload failure domains.
- OpenSearch/Elasticsearch or equivalent only for established search needs.
- Kafka or another event-streaming platform only when outbox/queue throughput and replay requirements justify it.
- CDN/global traffic management, advanced observability, and formal SRE practices.

## Focus

- Scale services independently and protect noisy-neighbor boundaries.
- Support high-throughput tenants and integrations.
- Move toward event-driven interactions where they reduce real coupling.
- Improve regional availability where business requirements demand it.
- Preserve cost efficiency and operational simplicity within each service.

## Required practices

- Formal event schemas, compatibility rules, ownership, catalog, and version lifecycle.
- Documented partition/sharding key, resharding strategy, and tenant-move procedure.
- Multi-region readiness review without claiming active-active support prematurely.
- Chaos testing, disaster-recovery drills, capacity planning, and dependency failure tests.
- Per-service SLOs, tracing, dashboards, runbooks, on-call ownership, and cost attribution.
- Strong data-isolation tests across shared, sharded, and dedicated tenant storage.

## Move toward Stage 5 when

- Usage is approaching or exceeding 200,000 active users and single-region limits are measured.
- Business expansion requires new regions, data residency, or strict enterprise contracts.
- Very high integration/event throughput requires multi-region streaming and recovery.
- Enterprise customers require stronger isolation, compliance evidence, and contractual SLAs.

Do not introduce multi-region writes merely to reduce ordinary latency; document consistency, conflict, failover, and recovery semantics first.
