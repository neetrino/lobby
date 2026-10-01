# Product Brief: Lobby

> This brief defines the product purpose, Version 1 scope, users, and core workflows. Technology approval belongs in `TECH_CARD.md`; system design belongs in `[01-ARCHITECTURE.md](./01-ARCHITECTURE.md)` and `[02-TECH_STACK.md](./02-TECH_STACK.md)`.

- **Project:** Lobby
- **Stage:** Version 1 definition
- **Last updated:** 2026-09-24
- **Status:** ACTIVE — Version 1 direction is established; conditional feature workflows still require approval before implementation

---

## Description

Lobby is a multi-tenant CRM and work-management SaaS for organizations that need one place to manage customers, sales activity, tasks, and operational work. Each organization has an isolated workspace with its own members, permissions, enabled modules, and data.

Version 1 establishes the shared workspace and access model first, then delivers the approved customer-and-work workflows without requiring every planned module in the same release.

## Target audience

- Small and medium organizations that manage customers, deals, tasks, and orders across a team.
- Organization owners who configure the workspace and control access.
- Administrators who manage day-to-day operations and team permissions.
- Members who work with the records and modules available to them.
- Platform operators who support organizations at the SaaS level through separate permissions.

## Product goals

1. Keep each organization's data and access isolated.
2. Give teams a clear view of customers, active work, ownership, and status.
3. Support configurable modules without mixing their internal responsibilities.
4. Make important actions auditable and access revocable.
5. Provide a foundation that can grow without requiring microservices for Version 1.

## Version 1 scope and priorities

| Priority    | Capability                                                      | Version 1 outcome                                                                                                  |
| ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| High        | Organization users and access                                   | Each user belongs to exactly one organization tenant; multi-organization membership and switching are unsupported. |
| High        | Authentication and access control                               | Owners can invite/remove members and assign approved roles or permissions; revoked access stops working promptly.  |
| High        | Configurable tenant roles and permissions                       | Owners, and Admins with delegated access-management permission, can create tenant roles from approved permissions. |
| High        | Contacts                                                        | Authorized members can create, view, update, search, and archive organization contacts.                            |
| High        | Tasks                                                           | Members can create, assign, prioritize, update, and complete tasks linked to relevant records.                     |
| High        | Deals and pipeline                                              | Teams can track deals through organization-defined pipeline stages with ownership and status history.              |
| High        | Restaurant reservations                                         | Staff configure venues and tables, then manage conflict-free reservations and service status.                      |
| Medium      | Orders and delivery                                             | Teams can record an order and track its operational status if confirmed for the first release.                     |
| Medium      | Notifications                                                   | Users receive approved in-app notifications for important assignments and status changes.                          |
| Medium      | Audit history                                                   | Sensitive user-access, permission, and important business changes are traceable.                                   |
| Low / later | Messenger, catalog, inventory, transfers, analytics, dashboards | Enable only after their detailed workflows and Version 1 necessity are approved.                                   |

## Core procedures

### 1. Organization setup

1. A user creates an organization and becomes its Owner.
2. The Owner configures basic organization settings and selects approved modules.
3. The Owner invites team members and assigns roles or permissions.
4. Invited users accept access and enter only the authorized organization workspace.

Tenant roles are organization-specific settings. `OWNER` remains a protected system role. An Owner may create named roles such as Sales Manager or Delivery Operator; an Admin may manage them only with an explicit access-management permission. A manager cannot grant permissions they do not hold, grant platform permissions, cross the tenant boundary, or remove the tenant's final active Owner.

Security-sensitive access changes and important business transitions appear in tenant audit history. Records identify the actor, action, outcome, affected resource, time, and safe request metadata without storing passwords, session identifiers, tokens, or raw client IP addresses.

### 2. Daily CRM workflow

1. A member creates or finds a contact.
2. The member records a deal and assigns an owner.
3. The deal moves through the configured pipeline stages.
4. Tasks, notes, and approved related records remain connected to the customer or deal.
5. Authorized users can see current ownership, status, and relevant history.

### 3. Task workflow

1. A user creates a task and optionally links it to a contact, deal, or order.
2. The task receives an assignee, priority, due date, and status.
3. The assignee updates progress and completes the task.
4. Relevant users receive approved notifications and can review the change history.

### 4. Access removal

1. An Owner or authorized Admin removes or disables a tenant-owned user.
2. The user's later requests and realtime access to that tenant are denied.
3. The user cannot switch to or retain access in another organization.
4. The change is recorded in the audit history.

### 5. Optional module activation

1. An Owner enables an approved module for the organization.
2. The system verifies required module dependencies and permissions.
3. Authorized members gain access to that module without receiving unrelated privileges.
4. Disabling a module hides access but does not automatically delete its data.

### 6. Restaurant reservation workflow

1. Authorized staff selects a venue, date, time, party size, and one or more tables.
2. The system validates tenant ownership, table capacity, service periods, and time conflicts.
3. The reservation moves through pending, confirmed, arrived, seated, and completed, with cancellation and no-show exits.
4. Status changes retain history; notifications and external booking channels remain separate integrations.

## Outside Version 1

- Microservices, multi-region deployment, sharding, or tenant-specific databases.
- Advanced analytics, forecasting, and custom report builders.
- Full inventory/serial-number management unless explicitly included in Version 1 scope.
- Native mobile applications.
- Marketplace or third-party extension platform.
- Complex billing, payment processing, or usage-based subscriptions until business rules are approved.
- AI features unless a specific user problem and data policy are approved.
- Public self-service booking, deposits, waitlists, floor-plan editing, and automatic table optimization until separately designed.

## Stack direction

- **Frontend:** Next.js web application.
- **Backend:** NestJS REST API organized as a modular monolith.
- **Data:** PostgreSQL is the source of truth; Redis holds approved ephemeral session/rate-limit workloads.
- **Repository:** Implemented TypeScript monorepo for web, API, worker, shared contracts, and database tooling.

Exact versions, providers, hosting, authentication implementation, and conditional infrastructure require approval in `TECH_CARD.md`. See `[02-TECH_STACK.md](./02-TECH_STACK.md)` for the current technical proposal.

## Design

- Figma: not provided.
- Design system/UI kit: TBD before broad UI implementation.
- Required qualities: responsive, accessible, consistent, and efficient for repeated daily operations.
- Primary layouts should prioritize data clarity, keyboard-friendly workflows, clear loading/error states, and safe destructive-action confirmation.

## Integrations

| Integration                                       | Version 1 status                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Authentication/session service                    | Implemented foundation: tenant-aware login, Redis sessions, revocation, and authorization |
| Email invitations and transactional notifications | Conditional for Version 1; provider TBD                                                   |
| Object storage for attachments                    | Conditional; enable only if files enter the approved Version 1 scope                      |
| Realtime updates                                  | Conditional; use only for workflows that benefit from immediate updates                   |
| Messaging channels                                | Later unless explicitly approved for Version 1                                            |
| Payments/billing                                  | Not approved for Version 1                                                                |
| External APIs                                     | None confirmed                                                                            |

## Content and localization

- Interface: multilingual with i18n required from the Version 1 foundation.
- Launch languages: Armenian (`hy`), Russian (`ru`), and English (`en`).
- All user-facing text must use translation resources rather than hard-coded strings.
- Dates, times, numbers, currencies, pluralization, validation messages, and sorting must be locale-aware.
- Locale routes and translation resources use `next-intl`; English (`en`) is the default/fallback locale. RTL is not required for the three launch languages.

## Constraints

- Timeline: not defined.
- Budget and paid-service limits: not defined.
- Hosting and data-region requirements: not defined.
- Secrets must remain outside source control.
- Production deployment and database migrations require controlled automation and explicit authorization.
- Tenant isolation, authorization, auditability, and recoverability cannot be weakened to accelerate delivery.

## Version 1 success criteria

- An Owner can create and administer an isolated organization workspace.
- Invited members can access only authorized organizations and records.
- A team can manage contacts, deals, pipeline stages, and tasks through their core lifecycle.
- Disabling or removing a tenant-owned user prevents subsequent access to that tenant.
- Important access and business changes are auditable.
- Critical workflows pass approved functional, tenant-isolation, and authorization tests.
- The system can be deployed and migrated through the approved release process with documented environment variables and recovery procedures.
