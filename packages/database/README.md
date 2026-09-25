# Database package

This package owns the Prisma schema, generated client, and database migrations.

The foundation schema is two tables:

- `tenants` — `id`, `name`, `subdomain` (unique), `plan`, `created_at`
- `users` — `id`, `tenant_id` (foreign key to `tenants.id`), `email` (unique with `tenant_id`), `name`, `created_at`

`current_tenant_id()` reads the `app.current_tenant_id` session setting for a future Row-Level Security policy. No table has RLS enabled.

Business entities will be added module by module after their data model is approved.
