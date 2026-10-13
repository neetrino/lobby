-- The list query orders by occurred_at and id. The three-column index covers that
-- order and the previous (tenant_id, occurred_at) prefix, so the shorter index is removed.
-- Filter-specific indexes stay out until query measurements justify them.
DROP INDEX "audit_events_tenant_id_occurred_at_idx";

CREATE INDEX "audit_events_tenant_id_occurred_at_id_idx" ON "audit_events"("tenant_id", "occurred_at", "id");
