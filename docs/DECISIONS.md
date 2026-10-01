# Project Decisions

This document is the index for approved architecture decision records. Implemented technical choices that do not yet have a dedicated ADR remain visible in [`TECH_CARD.md`](./TECH_CARD.md) and must not be mistaken for missing implementation.

Use it to record decisions that affect architecture, security, data, integrations, deployment, or long-term maintenance. Each significant decision should link to a separate Architecture Decision Record (ADR) under `docs/architecture/`.

An ADR should briefly describe:

- the problem or context;
- the selected decision;
- alternatives considered;
- the reason for the choice;
- important consequences.

Only approved decisions should be treated as authoritative. Proposed or replaced decisions must be clearly marked with their current status.

The modular monolith, one-user/one-tenant model, revocable Redis sessions, application-enforced tenant scope, and transactional PostgreSQL outbox are implemented decisions documented in the TECH_CARD and architecture document. Create dedicated ADRs when their alternatives and long-term consequences need a durable record.

| Decision                         | Status   | Record                                              |
| -------------------------------- | -------- | --------------------------------------------------- |
| Append-only tenant audit history | Approved | [ADR 0001](./architecture/ADR-0001-audit-events.md) |
