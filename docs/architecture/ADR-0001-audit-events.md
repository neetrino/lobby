# ADR 0001: Append-only audit events

- **Status:** Approved
- **Date:** 2026-09-30

## Context

Security-sensitive actions need a tenant-scoped history that is distinct from operational logs. The history must answer who acted, in which organization, what they did, to which resource, when, from which request, and with what outcome.

## Decision

`audit_events` is append-only. Application code inserts and reads. It does not update or delete rows. A mistaken row is corrected by a later row.

The action catalog is closed: `user.sessions.terminated`, `user.role.changed`, `user.disabled`, `contact.deleted`, `deal.stage.changed`, `reservation.status.changed`.

`user.sessions.terminated`, `user.role.changed`, and `user.disabled` commit in the same database transaction as the access change. If the audit insert fails, the access change rolls back. The other three actions will be written from the outbox when those use cases exist. The first writer is session termination.

`audit:read` is granted to `OWNER` and `ADMIN`. A query always includes the caller's tenant. No retention period is approved, so nothing deletes audit rows.

`GET /api/v1/audit-events` is the read endpoint. It requires authentication and `audit:read`. It does not check a module entitlement, because audit is not an optional product module. The page uses a stable cursor of `occurredAt` plus `id`. The cursor also stores `sort` and an opaque fingerprint of the allowlisted filters: `action`, `outcome`, `actorUserId`, `resourceType`, `resourceId`, `from`, and `to`. A later page must send the same fingerprint and sort. `limit` is not part of it, so the page size can change. The response envelope is `{ data, page: { nextCursor } }`. The supporting index is `(tenant_id, occurred_at, id)`. The default limit is 50 and the maximum is 100. The default order is `occurredAt DESC, id DESC`. `sort` accepts only `asc` or `desc`, which selects that `occurredAt` direction. Filters are an allowlist: `action`, `outcome`, `actorUserId`, `resourceType`, `resourceId`, `from`, and `to`. The response is `{ data, page: { nextCursor } }`. There is no total count and no client-supplied Prisma query.

The row stores `schema_version` 1, UTC `timestamptz`, and an HMAC-SHA256 hex of the client address keyed with `AUDIT_IP_HASH_KEY`. Operators generate that key with 32 random bytes encoded as lowercase hex and store it only in the environment. It is required in production and it is not the session or cookie secret. Startup accepts 64 lowercase hex characters and rejects one repeated character. That check does not prove the key is random. A plain SHA-256 of the address is not stored. It does not store passwords, hashes, session ids, cookies, tokens, raw IP addresses, or email and phone values.

## Consequences

The local database role can still update the table because it owns the schema. A separate runtime role limited to `INSERT` and `SELECT` is a later production grant, not part of this migration. Redis session deletion stays after the audit transaction, matching the existing revocation order.
