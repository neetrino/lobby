# Development Progress

This document is the living procedural backlog for the project.

Use it during development to track work that appears over time, including:

- planned and active tasks;
- completed work;
- new requirements or follow-up changes;
- blockers and dependencies;
- bugs and technical debt;
- validation and release tasks;
- immediate next steps.

Update it as development progresses. Product scope belongs in `BRIEF.md`, approved technical choices in `TECH_CARD.md`, and important long-term decisions in `DECISIONS.md`.

## Authentication implementation order

| Phase | Work | Status |
| --- | --- | --- |
| 1 | Redis session store, hashed session id, cookie adapter | Done |
| 2 | Argon2id password hasher and password policy | Done |
| 3 | Identity module, session domain, Redis store, cookie adapter | Done |
| 4 | `POST /api/v1/auth/register` | Done |
| 5 | `POST /api/v1/auth/login` | Done |
| 6 | SessionGuard, authenticationVersion, tenant context | Done |
| 7 | Logout and synchronous terminate-all-sessions | Done |
| 8 | Origin guard, CORS allowlist, auth rate limits | Done |
| 9 | HTTP integration and security tests, API docs | Done |

Phase 9 checks live in `apps/api/src/modules/identity/presentation/auth-flow.integration.test.ts`. They use the local Postgres test database and the in-memory Redis client. The auth contract is `docs/04-API.md` and `docs/api/auth.openapi.yaml`.

### Next

Contacts, Deals, Tasks, and Reservations controllers can take tenant scope from `@CurrentTenant()`. Add `@UseGuards(SessionGuard)` and `IdentityExceptionFilter` on those controllers. `SessionGuard` is not global, and the identity error filter is currently only on `AuthController`. `OriginGuard` is already global for mutating methods.

`terminateAllSessions` is an application service. It does not have a public HTTP route.
