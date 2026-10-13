# Project Structure: Lobby

> This document defines the current repository layout, ownership boundaries, and the target shape used when a module gains real responsibilities. Folders are created only when their responsibility exists.

- **Project size:** C
- **Architecture:** TypeScript monorepo with a Next.js web application and NestJS modular-monolith API
- **Last updated:** 2026-10-01
- **Version:** 1.0
- **Status:** ACTIVE — current structure plus explicitly marked conditional paths

---

## Structure principles

- Applications are independently runnable entry points under `apps/`.
- Reusable cross-application code belongs under `packages/` only when a real shared boundary exists.
- Functional business modules remain owned by the NestJS API and do not access one another's private internals.
- Applications may depend on packages; packages must not depend on applications.
- Product documentation stays in `docs/`; agent governance stays in `.agents/`.
- Conditional schedulers, integrations, and shared packages are not created until their Version 1 need is approved. The outbox worker already exists.

---

## Current and conditional repository tree

```text
Lobby/
├── apps/
│   ├── web/                         # Next.js application
│   │   └── src/
│   │       ├── app/                 # App Router routes and layouts
│   │       ├── features/            # Feature-owned UI and client behavior
│   │       ├── components/          # Application-level reusable components
│   │       ├── lib/                 # Web adapters and utilities
│   │       └── messages/            # Locale translation resources
│   ├── api/                         # NestJS modular-monolith API
│   │   └── src/
│   │       ├── modules/             # Functional business modules
│   │       ├── common/              # API-wide technical utilities only
│   │       ├── config/              # Validated runtime configuration
│   │       └── main.ts              # API composition root
│   ├── worker/                      # Implemented PostgreSQL outbox runtime
│   └── scheduler/                   # Conditional scheduled-job runtime
├── packages/
│   ├── contracts/                   # Versioned cross-app API/event contracts
│   ├── database/                    # Schema, migrations, and DB tooling
│   ├── ui/                          # Conditional cross-app UI primitives
│   └── config/                      # Conditional shared build/lint/TS config
├── docs/
│   ├── BRIEF.md
│   ├── TECH_CARD.md
│   ├── 01-ARCHITECTURE.md
│   ├── 02-TECH_STACK.md
│   ├── 03-STRUCTURE.md
│   ├── 04-API.md                    # Current API conventions and inventory
│   ├── 05-DATABASE.md               # Current schema, migrations, and DB rules
│   ├── DECISIONS.md                 # ADR index
│   ├── PROGRESS.md                  # Delivery status and next work
│   └── architecture/                # ADRs and supporting diagrams
├── .agents/                       # Agent workflows and governance
├── .cursor/rules/                 # Cursor coding standards
├── .github/                       # CI and collaboration configuration
├── .env.example                   # Variable names without secrets
├── package.json                   # Workspace commands
├── pnpm-workspace.yaml            # Workspace membership
└── turbo.json                     # Task graph and caching policy
```

---

## Top-level responsibilities

| Path                  | Responsibility                                                                                                           | Creation status                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| `apps/web/`           | Next.js routes, layouts, localized content, and future feature UI/API clients.                                           | Implemented foundation                         |
| `apps/api/`           | NestJS HTTP boundary, authentication, tenant context, authorization, validation, audit, and business-module composition. | Implemented                                    |
| `apps/worker/`        | Outbox relay and idempotent queue consumers. It contains runtime composition, not duplicated business rules.             | Implemented for the transactional outbox relay |
| `apps/scheduler/`     | Registers recurring/delayed jobs and submits work to the appropriate queue/module boundary.                              | Conditional                                    |
| `packages/contracts/` | Framework-light Zod contracts shared across independently runnable applications.                                         | Implemented                                    |
| `packages/database/`  | Prisma schema/migrations, generated client, outbox configuration, and test DB tooling.                                   | Implemented                                    |
| `packages/ui/`        | Design-system primitives reused by more than one application.                                                            | Conditional                                    |
| `packages/config/`    | Shared TypeScript, lint, or build configuration when duplication justifies it.                                           | Conditional                                    |
| `docs/`               | Product scope, approved decisions, architecture, contracts, data design, and delivery records.                           | Active                                         |
| `.agents/`            | Portable agent workflows, catalog, references, and governance.                                                           | Active                                         |
| `.cursor/rules/`      | Permanent Cursor-specific engineering standards.                                                                         | Active                                         |
| `.github/`            | Pull-request/issue templates, dependency updates, and approved CI workflows.                                             | Active                                         |

---

## Backend module structure

Each functional module uses only the layers it actually needs:

```text
apps/api/src/modules/<module>/
├── <module>.module.ts
├── application/        # Use cases and public application interface
├── domain/             # Business rules and domain types
├── infrastructure/     # Persistence and external adapters
├── presentation/       # Controllers, DTOs, and transport mapping
└── index.ts            # Explicit public exports
```

Simple modules may use a flatter structure. Do not add repositories, factories, interfaces, or layers that provide no real boundary or testability benefit.

### Module dependency rules

- A module owns its business rules and data writes.
- Cross-module synchronous work uses the target module's published application interface.
- Cross-module asynchronous work uses versioned events through the approved outbox/queue path.
- A module must not import another module's private files or mutate its private tables.
- Circular module dependencies are prohibited; extract a clear shared contract or revise ownership instead.
- Technical helpers in `common/` must not become a hidden business-module layer.

---

## Frontend structure

```text
apps/web/src/
├── app/[locale]/         # Locale-aware routes, layouts, loading, and errors
├── features/<feature>/  # Feature components, hooks, schemas, and API adapters
├── components/          # Application-level reusable UI
├── lib/                 # Framework and service adapters
└── messages/<locale>/   # Translation resources
```

### Frontend dependency rules

- Server Components are the default; client boundaries remain as small as practical.
- Features may use application components and approved packages but do not deep-import another feature's internals.
- Browser code never imports database code, server secrets, or privileged API implementation.
- User-facing text comes from translation resources; locale-aware formatting is centralized.
- Shared UI moves to `packages/ui/` only when more than one application actually consumes it.

---

## Package boundaries

| Package     | May contain                                                                | Must not contain                                                      |
| ----------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `contracts` | Versioned request/response schemas, event schemas, and public types        | Database clients, framework controllers, secrets, or module internals |
| `database`  | Schema, migrations, generated-client configuration, migration/seed tooling | HTTP handlers, UI code, or business authorization decisions           |
| `ui`        | Accessible visual primitives and design tokens                             | Product workflows, API clients, or server-only code                   |
| `config`    | Shared static tool configuration                                           | Runtime secrets or environment-specific credentials                   |

No generic `shared/` package is created as a dumping ground. Code remains with its owner until genuine reuse and stable responsibility justify extraction.

## Current API module inventory

| Module          | Current state                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `identity`      | Full authentication/session foundation and global `SessionGuard` provider                           |
| `organizations` | Transactional tenant and first-owner creation                                                       |
| `contacts`      | Reference vertical slice with application services, tenant-scoped repository, controller, and tests |
| `reservations`  | Domain/status policy and persistence constraint tests; no application service or controller yet     |
| `deals`         | Boundary only                                                                                       |
| `messenger`     | Boundary only                                                                                       |
| `health`        | Public liveness endpoint                                                                            |

API-wide technical capabilities live under `apps/api/src/common`: audit, authentication contracts/decorators, authorization, database DI, HTTP foundation, module entitlements, outbox writing, pagination utilities, validation pipes, security, and tenant context.

---

## Naming conventions

- Directories and non-component files: `kebab-case` unless a framework convention requires otherwise.
- React components and exported classes/types: `PascalCase`.
- Functions, variables, and object properties: `camelCase`.
- Environment variables: `UPPER_SNAKE_CASE`.
- Database tables/columns and API field naming follow the conventions approved in the database/API documents.
- Tests stay close to the code they verify unless a dedicated integration or E2E project owns them.
- Public module/package APIs use explicit exports; consumers must not rely on deep internal imports.

The boundary rule is enforced by `scripts/validate-module-boundaries.mjs` as part of `pnpm lint`. Production files may import another module only through that module's root `index.ts`; deep imports into another module fail CI. Test files are excluded so focused integration fixtures may inspect internals without expanding the production API.

---

## Configuration and environment boundaries

- Root configuration defines workspace-wide commands only.
- Each application owns runtime configuration validation for the values it consumes.
- `.env.example` documents variable names and safe descriptions without real credentials.
- Browser-visible values are explicitly public; all other values remain server-side.
- `DATABASE_URL` is the least-privilege runtime connection; privileged migration access is restricted to the migration job.
- Development, staging, and production use separate resources and credentials.

---

## Structure change rules

1. Confirm the owning application, module, or package before adding a folder.
2. Prefer local code until a cross-application dependency is real and stable.
3. Record architecture-significant boundary changes in an ADR.
4. Update this document whenever the authoritative repository layout changes.
5. Do not create conditional apps/packages merely to match a future tree.
6. Validate imports, affected tests, builds, and workspace task configuration after structural changes.

---

## Related documents

- [`BRIEF.md`](./BRIEF.md) — product requirements and Version 1 scope.
- [`TECH_CARD.md`](./TECH_CARD.md) — approved technical decisions.
- [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md) — system boundaries and runtime topology.
- [`02-TECH_STACK.md`](./02-TECH_STACK.md) — technology families and provider choices.
- [`04-API.md`](./04-API.md) — current API and event contracts.
- [`05-DATABASE.md`](./05-DATABASE.md) — current data model and migration design.
- [`DECISIONS.md`](./DECISIONS.md) — accepted ADR index.

Update this file when an authoritative application/package/module boundary changes. Do not create future folders merely to make the tree look complete.
