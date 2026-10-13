-- Read model for the audit list and detail queries.
-- The unfiltered page still uses (tenant_id, occurred_at, id). PostgreSQL can
-- scan that btree backwards, so the existing ascending index stays.
-- These two indexes match the action filter and the actor filter, both ordered
-- by occurred_at and id. The shorter actor index is covered by the new one.
ALTER TABLE "audit_events" ADD COLUMN "actor_name" TEXT;

CREATE INDEX "audit_events_tenant_id_action_occurred_at_id_idx"
  ON "audit_events"("tenant_id", "action", "occurred_at", "id");

CREATE INDEX "audit_events_tenant_id_actor_user_id_occurred_at_id_idx"
  ON "audit_events"("tenant_id", "actor_user_id", "occurred_at", "id");

DROP INDEX "audit_events_tenant_id_actor_user_id_idx";
