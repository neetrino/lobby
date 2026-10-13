-- One-time password resets. The raw token is not a column.
-- Deleting the user removes unused tokens. The tenant row stays restricted.

CREATE TABLE "password_resets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "used_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets" ("token_hash");

CREATE INDEX "password_resets_tenant_id_user_id_idx" ON "password_resets" ("tenant_id", "user_id");

ALTER TABLE "password_resets"
  ADD CONSTRAINT "password_resets_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "password_resets"
  ADD CONSTRAINT "password_resets_user_id_tenant_id_fkey"
  FOREIGN KEY ("user_id", "tenant_id") REFERENCES "users" ("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Allow the password-reset audit name. Existing action values stay in the check.
-- Dropping and recreating this CHECK does not rewrite the table.

ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check";

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (
    'user.sessions.terminated',
    'user.role.changed',
    'user.disabled',
    'user.password.reset',
    'invitation.created',
    'invitation.resent',
    'invitation.revoked',
    'invitation.accepted',
    'contact.deleted',
    'contact.archived',
    'contact.restored',
    'deal.stage.changed',
    'reservation.status.changed'
));
