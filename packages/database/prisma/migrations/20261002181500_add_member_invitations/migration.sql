-- One-time member invitations. The raw token is not a column.
-- One open invitation per tenant email. Accepted and revoked rows do not occupy that slot.
-- OWNER cannot be granted through an invitation.

CREATE TABLE "member_invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "role" "TenantRole" NOT NULL DEFAULT 'MEMBER',
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "accepted_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "invited_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "member_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "member_invitations_token_hash_key" ON "member_invitations" ("token_hash");

CREATE INDEX "member_invitations_tenant_id_email_idx" ON "member_invitations" ("tenant_id", "email");

CREATE UNIQUE INDEX "member_invitations_open_email_key"
  ON "member_invitations" ("tenant_id", "email")
  WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL;

ALTER TABLE "member_invitations"
  ADD CONSTRAINT "member_invitations_role_not_owner" CHECK ("role" <> 'OWNER');

ALTER TABLE "member_invitations"
  ADD CONSTRAINT "member_invitations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "member_invitations"
  ADD CONSTRAINT "member_invitations_invited_by_id_tenant_id_fkey"
  FOREIGN KEY ("invited_by_id", "tenant_id") REFERENCES "users" ("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
