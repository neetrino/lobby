# Technical Decision Card: Lobby

> This card is the approval source for implementation choices derived from [`BRIEF.md`](./BRIEF.md). Detailed reasoning belongs in [`01-ARCHITECTURE.md`](./01-ARCHITECTURE.md), [`02-TECH_STACK.md`](./02-TECH_STACK.md), and ADRs.

- **Project:** Lobby
- **Stage:** Stage 1 / MVP planning
- **Date:** 2026-09-24
- **Version:** 0.1-draft
- **Status:** DRAFT — implementation must not begin until the required decisions are approved

## Decision status

| Mark | Meaning |
|---|---|
| Confirmed | Confirmed requirement or approved direction |
| Proposed | Proposed; approval required |
| Unresolved | Unresolved; decision required |
| Not needed | Not needed for the current scope |

---

## 1. Foundation

| # | Decision area | Selected direction | Status | Approval note |
|---|---|---|---|---|
| 1.1 | Project size | Size C | Proposed | Proposed from multi-tenancy, bounded modules, async work, and long-term scope; timeline/team size are still unknown. |
| 1.2 | Architecture | TypeScript monorepo; modular-monolith API | Proposed | Confirm before scaffolding `apps/*` and `packages/*`. |
| 1.3 | Package manager | pnpm | Confirmed | Use one workspace lockfile; pin the exact compatible pnpm version at initialization. |
| 1.4 | Runtime | Node.js 24 LTS target | Proposed | Verify support across selected Next.js, NestJS, Prisma, and deployment providers. |
| 1.5 | Language | TypeScript 5.9 family with `strict: true` | Proposed | Pin one compatible exact version across workspaces. |
| 1.6 | Monorepo orchestration | Turborepo | Confirmed | Use only deterministic task caching; pin the exact compatible version at initialization. |
| 1.7 | Git strategy | Short-lived feature branches or trunk-based | Unresolved | Repository owner must select one. |
| 1.8 | Commit convention | Conventional Commits + commitlint | Proposed | Existing repository configuration supports this direction. |

---

## 2. Frontend

| # | Decision area | Selected direction | Status | Approval note |
|---|---|---|---|---|
| 2.1 | Framework | Next.js App Router with React | Confirmed framework / Proposed versions | Next.js is confirmed; verify and pin exact compatible Next.js and React versions at initialization. |
| 2.2 | Rendering | React Server Components by default | Proposed | Client components only at the smallest interactive boundary. |
| 2.3 | Styling | Tailwind CSS 4 family | Proposed | Confirm with the design-system choice. |
| 2.4 | UI components | Custom/existing primitives or shadcn/ui | Unresolved | Select before broad UI implementation. |
| 2.5 | Client state | React state/context first; Zustand only when justified | Proposed | Do not duplicate authoritative API state. |
| 2.6 | Data fetching | Server-side access to NestJS API; client query library only when needed | Proposed | TanStack Query remains conditional. |
| 2.7 | Forms | React Hook Form with Zod schemas, or appropriate Server Actions using the same schemas | Confirmed | Reuse Zod schemas where client and server share the same contract; the server always validates again. |
| 2.8 | Internationalization | Multilingual i18n using `next-intl` or approved equivalent | Confirmed | Required from the MVP foundation. |
| 2.9 | Launch locales | Armenian (`hy`), Russian (`ru`), English (`en`) | Confirmed | All three languages are supported from the initial release. |
| 2.10 | Default and fallback locale | English (`en`) | Confirmed | Requests without a supported locale fall back to English. |
| 2.11 | Locale routing and RTL | URL strategy and RTL requirement | Unresolved | Decide before interface-copy implementation. |
| 2.12 | SEO | Metadata API/JSON-LD only for public routes that require discovery | Proposed | Authenticated CRM screens do not require public SEO. |
| 2.13 | Theme | Light only or light/dark using tokens and CSS variables | Unresolved | Decide before finalizing UI tokens. |
| 2.14 | PWA | Not required for initial MVP | Not needed | Revisit only with an offline/installability requirement. |

---

## 3. Backend and API

| # | Decision area | Selected direction | Status | Approval note |
|---|---|---|---|---|
| 3.1 | Framework | NestJS | Confirmed framework / Proposed version | NestJS is confirmed; verify and pin an exact version compatible with Node.js and supporting packages. |
| 3.2 | Topology | One modular-monolith API deployment | Proposed | Functional modules retain ownership and public boundaries. |
| 3.3 | API style | Versioned REST | Proposed | Contracts documented through OpenAPI and `04-API.md`. |
| 3.4 | HTTP adapter | Express or Fastify | Unresolved | Select after middleware, upload, observability, and hosting review. |
| 3.5 | Runtime validation | Zod schemas at every external boundary | Confirmed | Integrate Zod through an approved NestJS pipe/adapter; do not rely on TypeScript types for runtime validation. |
| 3.6 | API documentation | `@nestjs/swagger` / OpenAPI | Proposed | Required if REST direction is approved. |
| 3.7 | Configuration | `@nestjs/config` with startup validation | Proposed | Invalid or missing required configuration fails startup. |
| 3.8 | Rate limiting | Shared-state, tenant-aware limits | Proposed | Edge vs NestJS ownership depends on hosting. |
| 3.9 | Health checks | Lightweight liveness/readiness endpoints | Proposed | Use Terminus or compatible implementation. |
| 3.10 | File uploads | Direct-to-storage or API-mediated flow | Unresolved | Needed only if attachments enter MVP scope. |

---

## 4. Database, cache, and migrations

| # | Decision area | Selected direction | Status | Approval note |
|---|---|---|---|---|
| 4.1 | Primary database | PostgreSQL | Confirmed technology / Proposed version | Select the managed provider and pin its supported PostgreSQL version. |
| 4.2 | ORM/migrations | Prisma | Confirmed technology / Proposed version | Verify generated migrations and compatibility before pinning an exact version. |
| 4.3 | Tenant model | Shared database with organization-aware isolation | Proposed | Composite constraints and authorization checks are mandatory; threat/data review required. |
| 4.4 | Runtime credentials | Least-privilege `DATABASE_URL` | Proposed | Runtime identities receive no schema-owner privileges. |
| 4.5 | Migration credentials | `DIRECT_URL` available only to migration job | Proposed | Never expose it to web/API/worker runtimes. |
| 4.6 | Connection pooling | Provider-compatible bounded pool | Unresolved | Define after provider and concurrency assumptions are known. |
| 4.7 | Database timeouts | Statement, lock, and idle-transaction limits | Unresolved | Values must be workload/provider specific. |
| 4.8 | RLS | Optional defense in depth | Unresolved | Use only with safe per-transaction tenant context. |
| 4.9 | Redis | Managed Redis-compatible service | Proposed | Intended for sessions and approved bounded ephemeral workloads. |
| 4.10 | Queue | BullMQ | Proposed conditional | Enable only for approved async MVP use cases. |
| 4.11 | Production migrations | One CI/deploy migration job per database per release | Proposed | Never from laptops, request paths, builds, or app startup. |
| 4.12 | Backups and recovery | Managed backups/PITR plus restore tests | Proposed | Provider, retention, RPO, and RTO unresolved. |

---

## 5. Authentication and authorization

| # | Decision area | Selected direction | Status | Approval note |
|---|---|---|---|---|
| 5.1 | Session strategy | Opaque, revocable server-side sessions | Confirmed | Authentication uses server-managed sessions so organization access and individual sessions can be revoked. |
| 5.2 | Session storage | Redis-backed state | Proposed | Define outage, rotation, expiry, and device-management behavior. |
| 5.3 | Browser transport | Secure `HttpOnly` cookie | Proposed | Final SameSite, domain, and expiry settings depend on deployment. |
| 5.4 | CSRF protection | SameSite plus Origin/CSRF validation appropriate to the flow | Proposed | Document trusted origins per environment. |
| 5.5 | Login methods | Email/password, magic link, OAuth/OIDC, or combination | Unresolved | Product owner must choose. |
| 5.6 | Password hashing | Argon2id | Proposed conditional | Required only if password credentials are approved. |
| 5.7 | External providers | None selected | Unresolved | Select required providers and account-linking policy. |
| 5.8 | Authorization | Single tenant ownership + permissions + module entitlement + resource scope | Confirmed | Each user belongs to exactly one organization tenant; multi-organization membership is prohibited. |
| 5.9 | Role model | Owner/Admin/Member templates; custom roles TBD | Proposed | Confirm whether custom roles are required in MVP. |
| 5.10 | Verification/recovery | Email verification and account recovery | Unresolved | Depends on selected login methods and email provider. |

---

## 6. Storage and delivery

| # | Decision area | Selected direction | Status | Approval note |
|---|---|---|---|---|
| 6.1 | Object storage | S3-compatible managed storage; Cloudflare R2 is a candidate | Proposed conditional | Enable only if files/attachments enter MVP scope. |
| 6.2 | Upload policy | Tenant-scoped keys, type/size validation, short-lived access | Proposed conditional | Malware scanning depends on approved file risk. |
| 6.3 | CDN | Storage/provider CDN or Cloudflare | Unresolved | Select with hosting and domain strategy. |
| 6.4 | Image optimization | Next.js image pipeline | Proposed conditional | Configure remote-source allowlists. |
| 6.5 | Retention/deletion | Per file category and tenant policy | Unresolved | Must align with product and compliance requirements. |

---

## 7. External services and optional capabilities

| # | Service | Decision | Status | Approval note |
|---|---|---|---|---|
| 7.1 | Transactional email | Provider TBD | Unresolved | Required if invitations, verification, recovery, or email notifications are approved. |
| 7.2 | SMS | No provider selected | Not needed for initial scope | Revisit only with a confirmed workflow. |
| 7.3 | Messaging channels | Provider adapters TBD | Proposed conditional | Later unless explicitly promoted into MVP. |
| 7.4 | Payments/billing | No provider selected | Not needed until business model is defined | Do not implement before payment flows and region requirements are approved. |
| 7.5 | Product analytics | Provider or no external analytics | Unresolved | Requires privacy and retention review. |
| 7.6 | Error tracking | Managed provider such as Sentry | Proposed | Exact provider and data policy TBD. |
| 7.7 | Search | PostgreSQL capabilities first | Proposed | Specialist search engine only after measured need. |
| 7.8 | Realtime | WebSocket or SSE gateway | Proposed conditional | Use only for approved immediate-update workflows. |
| 7.9 | AI services | None | Not needed | Requires a specific approved user problem and data policy. |

---

## 8. Hosting, environments, and CI/CD

| # | Decision area | Selected direction | Status | Approval note |
|---|---|---|---|---|
| 8.1 | Web hosting | Vercel candidate | Proposed | Confirm domain, region, environment, and cost requirements. |
| 8.2 | API hosting | Managed container/runtime or approved VPS | Unresolved | Select provider before finalizing Docker/network design. |
| 8.3 | Worker/scheduler hosting | Same provider family as API when practical | Proposed conditional | Only for approved background workloads. |
| 8.4 | PostgreSQL hosting | Managed PostgreSQL provider | Unresolved | Region, pooling, backup, cost, and connection limits required. |
| 8.5 | Redis hosting | Managed Redis-compatible provider | Unresolved | Must support selected session and queue behavior. |
| 8.6 | Environments | Development + staging + production | Proposed | Separate resources and credentials; no routine production data in lower environments. |
| 8.7 | CI/CD | GitHub Actions | Proposed | Locked installs; formatting, lint, typecheck, tests, and builds as applicable. |
| 8.8 | Containers | API/worker/scheduler Docker images when host requires them | Proposed conditional | Avoid Kubernetes for MVP without evidence. |
| 8.9 | Production migration owner | One release job | Proposed | Deployment blocked if migration fails. |
| 8.10 | Rollback/recovery | Previous compatible app version plus documented recovery | Unresolved | Define before first production release. |
| 8.11 | Domain/WAF | Provider controls or Cloudflare | Unresolved | Depends on hosting and threat model. |

---

## 9. Testing and quality gates

| # | Decision area | Selected direction | Status | Approval note |
|---|---|---|---|---|
| 9.1 | Unit tests | Vitest or framework-compatible runner | Proposed | Confirm one workspace-compatible setup. |
| 9.2 | API integration tests | Nest testing utilities + Supertest | Proposed | Prioritize validation, auth, tenancy, transactions, and errors. |
| 9.3 | Database integration tests | Dedicated PostgreSQL test database | Proposed | Validate constraints, migrations, and concurrency-sensitive flows. |
| 9.4 | Component tests | React Testing Library | Proposed conditional | Use where interaction behavior merits isolated coverage. |
| 9.5 | End-to-end tests | Playwright | Proposed | Cover critical organization, access, CRM, and task flows. |
| 9.6 | Contract checks | OpenAPI/runtime-schema compatibility | Proposed | Protect web/API/worker boundaries. |
| 9.7 | Coverage target | Risk-based; numeric threshold TBD | Unresolved | Do not use a percentage as the only quality measure. |
| 9.8 | Required CI gates | Format, lint, typecheck, relevant tests, build, dependency/security checks | Proposed | Exact commands available after scaffolding. |

---

## 10. Security and operations

| # | Control | Decision | Status | Approval note |
|---|---|---|---|---|
| 10.1 | Input validation | Zod runtime validation at every external boundary | Confirmed | Validate body, path, query, headers, configuration, and external payloads with the appropriate schema. |
| 10.2 | Tenant isolation | Authorization checks plus database constraints | Confirmed | Cross-tenant access is a release blocker. |
| 10.3 | CORS/trusted origins | Explicit environment allowlist | Proposed | No permissive production wildcard with credentials. |
| 10.4 | Security headers | NestJS/edge headers and CSP appropriate to deployment | Proposed | Exact policy defined before production. |
| 10.5 | Secrets | Deployment secret manager; none in source/client/logs | Confirmed | `.env.example` contains names only. |
| 10.6 | Audit history | Persistent records for sensitive access/business actions | Confirmed | Retention and viewer permissions TBD. |
| 10.7 | Logging | Pino-compatible structured JSON with redaction | Proposed | Correlation IDs across API/workers/external calls. |
| 10.8 | Metrics/alerts | HTTP, DB pool, Redis, queue, failures, and user-impact symptoms | Proposed | Provider and alert ownership TBD. |
| 10.9 | Dependency scanning | Automated update and vulnerability workflow | Proposed | Existing Dependabot configuration may be extended after scaffolding. |
| 10.10 | Webhook security | Signature verification, replay protection, and deduplication | Proposed conditional | Required for every enabled webhook integration. |
| 10.11 | Recovery | Tested database restore and documented incident process | Proposed | RPO/RTO remain unresolved. |

---

## 11. Documentation and delivery records

| # | Document | Status | Required action |
|---|---|---|---|
| 11.1 | `BRIEF.md` | Draft | Approve MVP scope and open product decisions. |
| 11.2 | `TECH_CARD.md` | Draft | Resolve required Unresolved items and approve key Proposed items. |
| 11.3 | `01-ARCHITECTURE.md` | Draft | Reconcile against this card after approval. |
| 11.4 | `02-TECH_STACK.md` | Draft | Pin exact versions/providers after compatibility review. |
| 11.5 | `03-STRUCTURE.md` | Missing | Create after size/topology approval. |
| 11.6 | `04-API.md` | Missing | Create before public or cross-application API implementation. |
| 11.7 | `05-DATABASE.md` | Missing | Create before schema implementation. |
| 11.8 | `DECISIONS.md` / ADRs | Missing | Record architecture-significant approved decisions. |
| 11.9 | `PROGRESS.md` | Missing | Create when implementation planning begins. |
| 11.10 | Root project README | Template only | Replace with run/test/environment instructions after scaffolding. |
| 11.11 | `.env.example` | Present, not project-final | Update after environment contract is approved. |

---

## 12. Required approvals before scaffolding

The following decisions materially change the implementation and must be resolved before application generation:

1. Confirm Size C and the monorepo/modular-monolith topology.
2. Confirm exact compatible runtime/framework/tool versions.
3. Select locale routing and the RTL requirement for the confirmed `hy`, `ru`, and `en` launch languages; default and fallback are `en`.
4. Select the NestJS HTTP adapter and the Zod integration approach.
5. Approve login methods, session lifecycle, and role/custom-permission scope.
6. Select database/Redis/API hosting and environment regions.
7. Confirm which conditional MVP capabilities require email, files, realtime, queues, workers, or scheduling.
8. Approve database pooling, timeout, backup, restore, RPO, RTO, and migration-job ownership.
9. Define staging/production promotion, rollback, monitoring, and incident ownership.

**Approval rule:** change this card to `APPROVED` only after the required decisions are resolved. After approval, update architecture and stack documents to match this card before scaffolding code.
