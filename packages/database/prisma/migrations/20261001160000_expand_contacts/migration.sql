-- Contact identity, ownership, and soft archive.
-- Existing rows take the tenant OWNER when one exists, otherwise the earliest user.
-- A contact whose tenant has no user fails this migration instead of inventing an owner.
-- The email unique index includes archived rows, so archive does not free an email.
-- (tenant_id, name, id) replaces (tenant_id): the leading column still serves tenant lookups,
-- and name + id match the list order. Phone and email search indexes stay out until measured.

CREATE TYPE "ContactType" AS ENUM ('PERSON', 'ORGANIZATION');

ALTER TABLE "contacts"
  ADD COLUMN "type" "ContactType" NOT NULL DEFAULT 'PERSON',
  ADD COLUMN "email" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "archived_at" TIMESTAMPTZ(3),
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "created_by_user_id" UUID,
  ADD COLUMN "owner_user_id" UUID;

UPDATE "contacts" AS contact
SET
  "created_by_user_id" = owner."id",
  "owner_user_id" = owner."id",
  "updated_at" = contact."created_at"
FROM (
  SELECT DISTINCT ON ("tenant_id") "id", "tenant_id"
  FROM "users"
  ORDER BY
    "tenant_id",
    CASE WHEN "role" = 'OWNER'::"TenantRole" THEN 0 ELSE 1 END,
    "created_at"
) AS owner
WHERE contact."tenant_id" = owner."tenant_id"
  AND contact."created_by_user_id" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "contacts"
    WHERE "created_by_user_id" IS NULL OR "owner_user_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'contacts owner backfill left a null user id';
  END IF;
END $$;

ALTER TABLE "contacts"
  ALTER COLUMN "created_by_user_id" SET NOT NULL,
  ALTER COLUMN "owner_user_id" SET NOT NULL;

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_name_length_check"
    CHECK (char_length("name") BETWEEN 1 AND 200),
  ADD CONSTRAINT "contacts_email_lower_check"
    CHECK ("email" IS NULL OR "email" = lower("email")),
  ADD CONSTRAINT "contacts_email_length_check"
    CHECK ("email" IS NULL OR char_length("email") BETWEEN 3 AND 254),
  ADD CONSTRAINT "contacts_phone_length_check"
    CHECK ("phone" IS NULL OR char_length("phone") BETWEEN 1 AND 32);

CREATE UNIQUE INDEX "contacts_tenant_id_email_key" ON "contacts"("tenant_id", "email");

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_created_by_user_id_tenant_id_fkey"
    FOREIGN KEY ("created_by_user_id", "tenant_id")
    REFERENCES "users"("id", "tenant_id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "contacts_owner_user_id_tenant_id_fkey"
    FOREIGN KEY ("owner_user_id", "tenant_id")
    REFERENCES "users"("id", "tenant_id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "contacts_tenant_id_idx";

CREATE INDEX "contacts_tenant_id_name_id_idx" ON "contacts"("tenant_id", "name", "id");
