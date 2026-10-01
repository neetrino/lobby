# Architecture Records

This folder contains detailed architecture material that would make `docs/01-ARCHITECTURE.md` too large.

Content may include:

- Architecture Decision Records (ADRs);
- system and deployment diagrams;
- module dependency diagrams;
- detailed module-boundary notes.

## Scaling stages

- [`STAGE-1.md`](./STAGE-1.md) — Version 1, 0–1,000 active users.
- [`STAGE-2-EARLY-GROWTH.md`](./STAGE-2-EARLY-GROWTH.md) — 1,000–10,000 active users.
- [`STAGE-3-SCALE.md`](./STAGE-3-SCALE.md) — 10,000–50,000 active users.
- [`STAGE-4-LARGE-SCALE.md`](./STAGE-4-LARGE-SCALE.md) — 50,000–200,000 active users.
- [`STAGE-5-ENTERPRISE-SCALE.md`](./STAGE-5-ENTERPRISE-SCALE.md) — 200,000+ active users.

The user bands classify the roadmap stage. A band crossing alone does not authorize a migration: telemetry must show the relevant bottleneck, alternatives must be recorded, and the change must pass load, recovery, security, and cost review.

Create a file only when there is a real approved decision or design to document. Product scope, API contracts, database details, and active tasks remain in their dedicated documents under `docs/`.
