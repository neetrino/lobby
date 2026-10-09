# Stage 5 — Enterprise Scale

- **Active users:** 200,000+
- **Theme:** Global. Resilient. Enterprise-ready.
- **Status:** Conditional target; not current architecture

## Architecture

```text
Next.js web
    |
Global CDN / multi-region load balancing
    |----------------|----------------|
Region 1          Region 2         Region 3
services + DB     services + DB    services + DB
    |----------------|----------------|
Multi-region event streaming
Global Redis  Global search  Analytics/OLAP
```

## Core components

- Multi-region deployment with explicit traffic, failover, and data-residency rules.
- Global load balancing and CDN strategy.
- Multi-region or sharded PostgreSQL architecture selected from proven consistency requirements.
- Multi-region event streaming and regional recovery/replay controls.
- Global or region-scoped Redis and search deployments with documented consistency limits.
- Analytics/OLAP platform such as ClickHouse only for established analytical workloads.
- Advanced security, audit, compliance, and enterprise isolation controls.

## Focus

- Global availability and acceptable regional latency.
- Enterprise features, contractual service levels, and controlled tenant isolation.
- Maximum practical resilience with understood consistency tradeoffs.
- Compliance, data residency, security evidence, and auditability.
- Operational excellence and mature SRE ownership.

## Required practices

- Approved multi-region data ownership, replication, conflict, and residency strategy.
- Automated regional failover and regularly rehearsed recovery.
- Strict SLAs/SLOs, error budgets, incident command, and customer communication procedures.
- Continuous performance, capacity, security, and dependency testing.
- Formal security audits and required compliance programs such as SOC 2 only when business scope requires them.
- Cost optimization and per-tenant/per-region capacity attribution.

## Entry gate

Stage 5 is entered only when both conditions are true:

1. The product operates at 200,000+ active users or equivalent sustained workload.
2. Business expansion, enterprise contracts, compliance, latency, residency, or resilience requirements justify the operational complexity.

There is no automatic Stage 6. Reassess this roadmap using real traffic, failure history, customer commitments, technology maturity, and cost before defining further evolution.
