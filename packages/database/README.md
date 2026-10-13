# Database package

This package owns the Prisma schema, the generated client, and the SQL migrations. Callers open a client with `createPrismaClient(readDatabaseUrl())`. The connection string is `DATABASE_URL`. Prisma 7 reads it from `prisma.config.ts`, not from `schema.prisma`.

One user row belongs to exactly one tenant through `users.tenant_id`. There is no membership join.

Current tables:

- Identity: `tenants`, `users`
- Contacts: `contacts`
- Outbox: `outbox_events`
- Reservations: `venues`, `dining_areas`, `restaurant_tables`, `service_periods`, `reservations`, `reservation_tables`, `reservation_status_history`

`current_tenant_id()` reads the `app.current_tenant_id` session setting for a future Row-Level Security policy. No table has RLS enabled.

Tenant plans are limited to `starter` until a product decision adds more.
