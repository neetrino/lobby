# API Documentation: Lobby

> This document records the logical REST API contract. It starts intentionally small and should be updated alongside implemented endpoints and generated OpenAPI documentation.

- **Style:** Versioned REST
- **Owner:** NestJS API
- **Version:** 0.1-draft
- **Status:** DRAFT — no endpoints are approved or implemented yet

---

## Documentation approach

- OpenAPI generated from NestJS controllers and DTOs is the executable API reference.
- This document explains cross-cutting rules and provides a readable endpoint index.
- Module-specific details stay with their owning module until they become public contracts.
- Every endpoint change updates its DTO/schema, tests, OpenAPI output, and this index when relevant.

---

## Base contract

| Concern | Proposed rule |
|---|---|
| Base path | `/api/v1` |
| Format | JSON over HTTPS |
| Authentication | Opaque server-side session; exact login endpoints remain TBD |
| Tenant context | Every tenant-scoped request identifies an authorized organization using the approved routing/header strategy |
| Validation | Validate path, query, headers, and body at runtime |
| Dates | ISO 8601 UTC in API payloads unless a contract explicitly states otherwise |
| Identifiers | Opaque stable IDs; exact format TBD |
| Localization | API returns stable codes; clients translate user-facing messages where practical |

---

## Request processing

```text
Request
→ authenticate session
→ derive the user's single tenant
→ verify user status, permission, entitlement, and resource scope
→ validate input
→ execute owning module operation
→ return documented response or error
```

The client must never rely on hidden UI state as proof of authorization.

---

## Response and error shape

Successful responses return the resource or operation result under `data`. List responses may include `meta`.

```json
{
  "data": {},
  "meta": {}
}
```

Errors use a stable machine-readable code and do not expose stack traces or internal details.

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found",
    "requestId": "request-id"
  }
}
```

Exact envelopes remain proposed until the first API contract is approved.

---

## Common rules

- Use resource-oriented paths and correct HTTP methods/status codes.
- Paginate every potentially unbounded collection; cursor vs offset strategy remains TBD.
- Cap page size and validate filtering/sorting fields against an allowlist.
- Support idempotency keys for operations where retries could create duplicate effects.
- Apply explicit CORS, rate limits, timeouts, and request-size limits.
- Webhooks require signature verification, replay protection, deduplication, and durable processing before success is acknowledged.
- Breaking changes require a new API version or a documented compatibility migration.

---

## Endpoint index

| Module | Base resource | Status | Contract location |
|---|---|---|---|
| Authentication and sessions | `POST /api/v1/auth/register` | Planned | Auth module. Not implemented. Organizations does not expose registration. |
| Tenant organization and users | none | Foundation only | `Organizations.createWithOwner`. No `POST /organizations` or `POST /tenants`. |
| Contacts | TBD | Planned | OpenAPI + module documentation |
| Tasks | TBD | Planned | OpenAPI + module documentation |
| Deals and pipelines | TBD | Planned | OpenAPI + module documentation |
| Restaurant reservations | `/reservations` | Foundation only | Runtime schemas in `@lobby/contracts`; endpoints not implemented |
| Orders and delivery | TBD | Conditional | OpenAPI + module documentation |
| Notifications | TBD | Conditional | OpenAPI + module documentation |

Add exact methods, paths, permissions, request schemas, response schemas, and error codes only when the corresponding module contract is designed.

Registration, when implemented, belongs to Auth:

```text
POST /api/v1/auth/register
→ validate input
→ normalize subdomain and email
→ hash the password in Auth
→ Organizations.createWithOwner()
→ create the Redis session
→ set a secure HttpOnly cookie
```

- Each User belongs to exactly one Tenant.
- The same normalized email may identify separate User records in different tenants.
- Authentication therefore requires tenant context plus email: subdomain + email + password.
- The first user created with a tenant is always its Owner.
- Tenant, Owner, and `tenant.created` outbox event are committed atomically.
- Password hashing belongs to Auth; Organizations receives only `passwordHash`.
- If session creation fails after that transaction commits, the tenant remains and registration returns a controlled error so the owner can log in later.
- Login finds the user, rejects a non-ACTIVE status, and only then verifies the password hash. An unknown email still verifies a fixed unusable Argon2id hash so the two failures take similar time.

Reservation endpoints must derive the tenant from the authenticated session, accept UTC timestamps, and never trust a client-provided tenant identifier. The venue timezone controls staff-facing calendar interpretation. Conflict responses must use a stable error code; the exact HTTP contract is deferred until the application service is implemented.

---

## Endpoint documentation template

```text
METHOD /api/v1/resource
Purpose:
Authentication:
Organization scope:
Required permission:
Request schema:
Success response:
Expected errors:
Idempotency:
Rate limit:
```

---

## Change rules

1. The owning module defines and tests the contract.
2. Public request/response/event changes receive compatibility review.
3. OpenAPI remains synchronized with implemented behavior.
4. Security-sensitive endpoints document authorization and audit behavior explicitly.
5. Deprecated contracts state the replacement and removal plan.

---

## Related documents

- [`BRIEF.md`](./BRIEF.md) — product scope.
- [`TECH_CARD.md`](./TECH_CARD.md) — approved technical decisions.
- [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md) — system and module boundaries.
- [`02-TECH_STACK.md`](./02-TECH_STACK.md) — API technology choices.
- [`05-DATABASE.md`](./05-DATABASE.md) — persistence rules and schema documentation.
