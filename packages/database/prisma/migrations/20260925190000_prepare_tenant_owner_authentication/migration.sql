-- Prepare users for authentication without a membership table.
-- Preflight fails the transaction with a named error before any data change.
-- A tenant with exactly one existing user becomes a disabled owner. More than one
-- user requires a manual owner mapping, and this migration stops.
-- The password hash is a valid Argon2id encoding of discarded random bytes.
-- Its plaintext is unknown. Login must reject DISABLED users before verifying a hash.
-- This migration is not applied to Neon from a developer machine.

DO $$
DECLARE
  duplicate_subdomain_groups integer;
  duplicate_email_groups integer;
  unsupported_plan_count integer;
  multi_user_tenant_count integer;
BEGIN
  SELECT count(*) INTO duplicate_subdomain_groups
  FROM (
    SELECT lower("subdomain")
    FROM "tenants"
    GROUP BY lower("subdomain")
    HAVING count(*) > 1
  ) AS duplicate_subdomains;

  IF duplicate_subdomain_groups > 0 THEN
    RAISE EXCEPTION 'tenant migration preflight failed: two subdomains fold to the same lowercase value';
  END IF;

  SELECT count(*) INTO duplicate_email_groups
  FROM (
    SELECT "tenant_id", lower("email")
    FROM "users"
    GROUP BY "tenant_id", lower("email")
    HAVING count(*) > 1
  ) AS duplicate_emails;

  IF duplicate_email_groups > 0 THEN
    RAISE EXCEPTION 'tenant migration preflight failed: two emails in one tenant fold to the same lowercase value';
  END IF;

  SELECT count(*) INTO unsupported_plan_count
  FROM "tenants"
  WHERE "plan" IS DISTINCT FROM 'starter';

  IF unsupported_plan_count > 0 THEN
    RAISE EXCEPTION 'tenant migration preflight failed: a tenant plan is not starter';
  END IF;

  SELECT count(*) INTO multi_user_tenant_count
  FROM (
    SELECT "tenant_id"
    FROM "users"
    GROUP BY "tenant_id"
    HAVING count(*) > 1
  ) AS multi_user_tenants;

  IF multi_user_tenant_count > 0 THEN
    RAISE EXCEPTION 'tenant migration preflight failed: a tenant has more than one user; map the founding owner manually before migrating';
  END IF;
END $$;

CREATE TYPE "TenantPlan" AS ENUM ('starter');

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

CREATE TYPE "TenantRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

UPDATE "tenants" SET "subdomain" = lower("subdomain");

UPDATE "users" SET "email" = lower("email");

ALTER TABLE "tenants"
ADD CONSTRAINT "tenants_subdomain_lowercase_check"
CHECK ("subdomain" = lower("subdomain"));

ALTER TABLE "tenants"
ALTER COLUMN "plan" TYPE "TenantPlan" USING ("plan"::"TenantPlan");

ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN "role" "TenantRole";
ALTER TABLE "users" ADD COLUMN "authentication_version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMPTZ(3);
ALTER TABLE "users" ADD COLUMN "updated_at" TIMESTAMPTZ(3);

UPDATE "users"
SET
  "password_hash" = '$argon2id$v=19$m=65536,p=4,t=3$PEbBsUzxZ+rLvTW4czR4Ww$GiSsH9i7n0l40OGimI/KV+2Gf6GNJvf5MiPpVuIqXb8',
  "status" = 'DISABLED',
  "role" = 'OWNER',
  "updated_at" = "created_at"
WHERE "password_hash" IS NULL;

ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "users"
ADD CONSTRAINT "users_email_lowercase_check"
CHECK ("email" = lower("email"));
