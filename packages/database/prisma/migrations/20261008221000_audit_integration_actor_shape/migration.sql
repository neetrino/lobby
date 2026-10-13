-- A user audit names that user. An integration audit names no user and no role.

ALTER TABLE "audit_events" ALTER COLUMN "actor_user_id" DROP NOT NULL;
ALTER TABLE "audit_events" ALTER COLUMN "actor_role" DROP NOT NULL;

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actor_shape_check"
  CHECK (
    (
      "actor_type" = 'USER'
      AND "actor_user_id" IS NOT NULL
      AND "actor_role" IS NOT NULL
    )
    OR (
      "actor_type" = 'INTEGRATION'
      AND "actor_user_id" IS NULL
      AND "actor_role" IS NULL
    )
  );
