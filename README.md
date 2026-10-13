# Lobby

Lobby is a multi-tenant CRM and operations platform being developed as a TypeScript monorepo. The current Stage 1 architecture is a Next.js web application, a NestJS modular-monolith API, PostgreSQL through Prisma, Redis-backed sessions/rate limits, and a separate PostgreSQL-outbox worker.

Each user belongs to exactly one organization tenant. Tenant selection never comes from a client-controlled request field.

## Workspace

```text
apps/web          Next.js frontend and localization foundation
apps/api          NestJS API, authentication, authorization, audit, and business modules
apps/worker       Transactional-outbox relay and event handlers
packages/contracts  Shared Zod contracts and versioned events
packages/database   Prisma schema, migrations, generated client, and DB tooling
docs              Product, architecture, API, database, and decision documentation
```

## Requirements

- Node.js 24 or newer in the Node 24 line
- pnpm 10.18.0
- PostgreSQL for database integration tests and local persistence
- Redis/Upstash-compatible credentials for real session and rate-limit storage

Local PostgreSQL is described by `docker-compose.yml` and listens on `127.0.0.1:54329` when the compose service is running.

## Setup

```bash
pnpm install --frozen-lockfile
```

Copy the variable names from `.env.example` into an ignored root `.env` and provide local values. Never commit `.env` or real credentials.

Generate the Prisma client when needed:

```bash
pnpm db:generate
```

Development processes:

```bash
pnpm dev
pnpm --filter @lobby/api dev
pnpm --filter @lobby/web dev
pnpm --filter @lobby/worker start
```

The API uses `/api/v1`. Its public liveness endpoint is `GET /health`.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Database integration tests require the local PostgreSQL service. Every test client receives a unique PostgreSQL schema, and explicit disposal drops only that schema, so parallel suites cannot erase each other's rows.

CI runs `pnpm format:check` before lint, typecheck, tests, and build. Generated output, migrations, archived/reference documentation, and local agent/tool folders are excluded by `.prettierignore`.

## Current implementation

- tenant registration with the first ACTIVE OWNER;
- Argon2id authentication and opaque Redis-backed sessions;
- global session authentication, permissions, module entitlements, and tenant/resource scope;
- Contacts reference module with tenant-scoped persistence;
- append-only audit records and a paginated audit-list endpoint;
- reservation database/contracts/domain-policy foundation;
- transactional outbox, exact-version worker registry, retry classification, and failed-event requeue;
- Armenian, Russian, and English localization resources with English fallback.

Deals and Messenger currently contain module boundaries only. Tasks, notifications, inventory/transfers, analytics, and most feature UI remain to be implemented.

## Documentation

- [`docs/BRIEF.md`](docs/BRIEF.md) — product scope and procedures
- [`docs/TECH_CARD.md`](docs/TECH_CARD.md) — implemented and open technical decisions
- [`docs/01-ARCHITECTURE.md`](docs/01-ARCHITECTURE.md) — architecture, boundaries, security, deployment, and scaling
- [`docs/02-TECH_STACK.md`](docs/02-TECH_STACK.md) — actual stack and open provider decisions
- [`docs/03-STRUCTURE.md`](docs/03-STRUCTURE.md) — repository and module ownership
- [`docs/04-API.md`](docs/04-API.md) — HTTP contracts and endpoint inventory
- [`docs/05-DATABASE.md`](docs/05-DATABASE.md) — schema, migrations, tenancy, outbox, and database rules
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — accepted ADR index
- [`docs/PROGRESS.md`](docs/PROGRESS.md) — procedural backlog and current gaps

Repository rules are in [`AGENTS.md`](AGENTS.md). Product documentation and agent-system documentation remain separate.

## Safety boundaries

- Do not run production migrations from application startup, request handlers, builds, or routine developer machines.
- Do not weaken tenant scope, authorization, audit, validation, or tests to make a feature pass.
- Add infrastructure only for an approved capability or a measured bottleneck.

[MIT](LICENSE)
