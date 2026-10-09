-- Replaces the venue/assignment foundation with the booking tables.
-- Existing reservation rows are removed. There is no row-level backfill.

DROP TABLE IF EXISTS "reservation_status_history";
DROP TABLE IF EXISTS "reservation_tables";
DROP TABLE IF EXISTS "reservations";
DROP TABLE IF EXISTS "service_periods";
DROP TABLE IF EXISTS "restaurant_tables";
DROP TABLE IF EXISTS "dining_areas";
DROP TABLE IF EXISTS "venues";

DROP TYPE "ReservationStatus";

CREATE TYPE "ReservationLocationStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ReservationTableStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "ReservationStatus" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW'
);
CREATE TYPE "ReservationSource" AS ENUM (
  'STAFF',
  'WEBSITE',
  'INSTAGRAM',
  'WHATSAPP',
  'TELEGRAM',
  'PHONE',
  'WALK_IN'
);

CREATE TABLE "reservation_locations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "address" TEXT,
  "status" "ReservationLocationStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_locations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_locations_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 200),
  CONSTRAINT "reservation_locations_timezone_check" CHECK (
    char_length(btrim("timezone")) BETWEEN 1 AND 64
    AND "timezone" !~ '^[+-]'
  ),
  CONSTRAINT "reservation_locations_address_check" CHECK (
    "address" IS NULL OR char_length(btrim("address")) BETWEEN 1 AND 300
  )
);

CREATE TABLE "reservation_tables" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "min_capacity" INTEGER NOT NULL DEFAULT 1,
  "capacity" INTEGER NOT NULL,
  "status" "ReservationTableStatus" NOT NULL DEFAULT 'ACTIVE',
  "archived_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_tables_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_tables_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 80),
  CONSTRAINT "reservation_tables_capacity_check" CHECK (
    "min_capacity" > 0
    AND "capacity" >= "min_capacity"
    AND "capacity" <= 100
  )
);

CREATE TABLE "reservation_working_hours" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "weekday" INTEGER NOT NULL,
  "opens_at" TIME(0) NOT NULL,
  "closes_at" TIME(0) NOT NULL,
  "is_closed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "reservation_working_hours_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_working_hours_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6),
  CONSTRAINT "reservation_working_hours_span_check" CHECK ("is_closed" OR "opens_at" <> "closes_at")
);

CREATE TABLE "reservation_schedule_exceptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "local_date" DATE NOT NULL,
  "opens_at" TIME(0),
  "closes_at" TIME(0),
  "is_closed" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  CONSTRAINT "reservation_schedule_exceptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_schedule_exceptions_hours_check" CHECK (
    ("is_closed" AND "opens_at" IS NULL AND "closes_at" IS NULL)
    OR (
      NOT "is_closed"
      AND "opens_at" IS NOT NULL
      AND "closes_at" IS NOT NULL
      AND "opens_at" <> "closes_at"
    )
  ),
  CONSTRAINT "reservation_schedule_exceptions_note_check" CHECK (
    "note" IS NULL OR char_length(btrim("note")) BETWEEN 1 AND 500
  )
);

CREATE TABLE "reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "table_id" UUID,
  "contact_id" UUID,
  "assigned_user_id" UUID,
  "created_by_user_id" UUID,
  "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
  "source" "ReservationSource" NOT NULL,
  "guest_count" INTEGER NOT NULL,
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "ends_at" TIMESTAMPTZ(3) NOT NULL,
  "customer_name" TEXT NOT NULL,
  "customer_phone" TEXT,
  "customer_email" TEXT,
  "customer_note" TEXT,
  "internal_note" TEXT,
  "source_account_id" UUID,
  "source_request_id" TEXT,
  "source_conversation_id" TEXT,
  "source_message_id" TEXT,
  "confirmed_at" TIMESTAMPTZ(3),
  "arrived_at" TIMESTAMPTZ(3),
  "seated_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "cancelled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservations_guest_count_check" CHECK ("guest_count" BETWEEN 1 AND 100),
  CONSTRAINT "reservations_period_check" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "reservations_customer_name_check" CHECK (char_length(btrim("customer_name")) BETWEEN 1 AND 200),
  CONSTRAINT "reservations_contact_channel_check" CHECK (
    "source" = 'WALK_IN'
    OR "customer_phone" IS NOT NULL
    OR "customer_email" IS NOT NULL
  )
);

CREATE TABLE "reservation_source_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "source" "ReservationSource" NOT NULL,
  "source_account_id" TEXT NOT NULL,
  "external_request_id" TEXT NOT NULL,
  "reservation_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_source_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_source_requests_account_check" CHECK (char_length(btrim("source_account_id")) BETWEEN 1 AND 200),
  CONSTRAINT "reservation_source_requests_external_id_check" CHECK (char_length(btrim("external_request_id")) BETWEEN 1 AND 200)
);

CREATE TABLE "reservation_status_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "from_status" "ReservationStatus",
  "to_status" "ReservationStatus" NOT NULL,
  "changed_by_user_id" UUID,
  "reason" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_status_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reservation_locations_id_tenant_id_key" ON "reservation_locations"("id", "tenant_id");
CREATE UNIQUE INDEX "reservation_locations_tenant_id_name_key" ON "reservation_locations"("tenant_id", "name");
CREATE UNIQUE INDEX "reservation_tables_id_tenant_id_key" ON "reservation_tables"("id", "tenant_id");
CREATE UNIQUE INDEX "reservation_tables_id_tenant_id_location_id_key" ON "reservation_tables"("id", "tenant_id", "location_id");
CREATE UNIQUE INDEX "reservation_tables_tenant_id_location_id_name_key" ON "reservation_tables"("tenant_id", "location_id", "name");
CREATE INDEX "reservation_tables_tenant_id_location_id_status_idx" ON "reservation_tables"("tenant_id", "location_id", "status");
CREATE UNIQUE INDEX "reservation_working_hours_tenant_id_location_id_weekday_key" ON "reservation_working_hours"("tenant_id", "location_id", "weekday");
CREATE UNIQUE INDEX "reservation_schedule_exceptions_tenant_id_location_id_local_date_key" ON "reservation_schedule_exceptions"("tenant_id", "location_id", "local_date");
CREATE UNIQUE INDEX "reservations_id_tenant_id_key" ON "reservations"("id", "tenant_id");
CREATE INDEX "reservations_tenant_id_location_id_starts_at_idx" ON "reservations"("tenant_id", "location_id", "starts_at");
CREATE INDEX "reservations_tenant_id_contact_id_starts_at_idx" ON "reservations"("tenant_id", "contact_id", "starts_at");
CREATE INDEX "reservations_tenant_id_assigned_user_id_starts_at_idx" ON "reservations"("tenant_id", "assigned_user_id", "starts_at");
CREATE UNIQUE INDEX "reservation_source_requests_tenant_id_source_source_account_id_external_request_id_key" ON "reservation_source_requests"("tenant_id", "source", "source_account_id", "external_request_id");
CREATE INDEX "reservation_source_requests_tenant_id_reservation_id_idx" ON "reservation_source_requests"("tenant_id", "reservation_id");
CREATE INDEX "reservation_status_history_tenant_id_reservation_id_created_at_idx" ON "reservation_status_history"("tenant_id", "reservation_id", "created_at");

ALTER TABLE "reservation_locations"
  ADD CONSTRAINT "reservation_locations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservation_tables"
  ADD CONSTRAINT "reservation_tables_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_tables"
  ADD CONSTRAINT "reservation_tables_location_id_tenant_id_fkey"
  FOREIGN KEY ("location_id", "tenant_id") REFERENCES "reservation_locations"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservation_working_hours"
  ADD CONSTRAINT "reservation_working_hours_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_working_hours"
  ADD CONSTRAINT "reservation_working_hours_location_id_tenant_id_fkey"
  FOREIGN KEY ("location_id", "tenant_id") REFERENCES "reservation_locations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservation_schedule_exceptions"
  ADD CONSTRAINT "reservation_schedule_exceptions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_schedule_exceptions"
  ADD CONSTRAINT "reservation_schedule_exceptions_location_id_tenant_id_fkey"
  FOREIGN KEY ("location_id", "tenant_id") REFERENCES "reservation_locations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_location_id_tenant_id_fkey"
  FOREIGN KEY ("location_id", "tenant_id") REFERENCES "reservation_locations"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_table_id_tenant_id_location_id_fkey"
  FOREIGN KEY ("table_id", "tenant_id", "location_id") REFERENCES "reservation_tables"("id", "tenant_id", "location_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_contact_id_tenant_id_fkey"
  FOREIGN KEY ("contact_id", "tenant_id") REFERENCES "contacts"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_assigned_user_id_tenant_id_fkey"
  FOREIGN KEY ("assigned_user_id", "tenant_id") REFERENCES "users"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_created_by_user_id_tenant_id_fkey"
  FOREIGN KEY ("created_by_user_id", "tenant_id") REFERENCES "users"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservation_source_requests"
  ADD CONSTRAINT "reservation_source_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_source_requests"
  ADD CONSTRAINT "reservation_source_requests_reservation_id_tenant_id_fkey"
  FOREIGN KEY ("reservation_id", "tenant_id") REFERENCES "reservations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reservation_status_history"
  ADD CONSTRAINT "reservation_status_history_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_status_history"
  ADD CONSTRAINT "reservation_status_history_reservation_id_tenant_id_fkey"
  FOREIGN KEY ("reservation_id", "tenant_id") REFERENCES "reservations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_status_history"
  ADD CONSTRAINT "reservation_status_history_changed_by_user_id_tenant_id_fkey"
  FOREIGN KEY ("changed_by_user_id", "tenant_id") REFERENCES "users"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS "btree_gist";

ALTER TABLE "reservations"
ADD CONSTRAINT "reservations_no_table_overlap"
EXCLUDE USING gist (
  "tenant_id" WITH =,
  "table_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
)
WHERE (
  "table_id" IS NOT NULL
  AND "status" IN ('PENDING', 'CONFIRMED', 'ARRIVED', 'SEATED')
);
