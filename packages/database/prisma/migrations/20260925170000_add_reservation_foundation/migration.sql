-- Required for equality operators inside the GiST exclusion constraint below.
CREATE EXTENSION IF NOT EXISTS "btree_gist";

CREATE TYPE "ReservationStatus" AS ENUM (
  'HOLD',
  'PENDING',
  'CONFIRMED',
  'ARRIVED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW'
);

CREATE TABLE "venues" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "address" TEXT,
  "phone" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dining_areas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "venue_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dining_areas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "restaurant_tables" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "venue_id" UUID NOT NULL,
  "dining_area_id" UUID NOT NULL,
  "label" TEXT NOT NULL,
  "minimum_capacity" INTEGER NOT NULL,
  "maximum_capacity" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "restaurant_tables_capacity_check" CHECK (
    "minimum_capacity" > 0 AND "maximum_capacity" >= "minimum_capacity"
  )
);

CREATE TABLE "service_periods" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "venue_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "opens_at_minute" INTEGER NOT NULL,
  "closes_at_minute" INTEGER NOT NULL,
  "default_reservation_minutes" INTEGER NOT NULL,
  "slot_interval_minutes" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_periods_day_check" CHECK ("day_of_week" BETWEEN 0 AND 6),
  CONSTRAINT "service_periods_time_check" CHECK (
    "opens_at_minute" BETWEEN 0 AND 1439
    AND "closes_at_minute" BETWEEN 1 AND 1440
    AND "closes_at_minute" > "opens_at_minute"
  ),
  CONSTRAINT "service_periods_duration_check" CHECK (
    "default_reservation_minutes" > 0 AND "slot_interval_minutes" > 0
  )
);

CREATE TABLE "reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "venue_id" UUID NOT NULL,
  "contact_id" UUID,
  "created_by_user_id" UUID,
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "ends_at" TIMESTAMPTZ(3) NOT NULL,
  "party_size" INTEGER NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
  "customer_name" TEXT NOT NULL,
  "customer_phone" TEXT,
  "customer_email" TEXT,
  "special_requests" TEXT,
  "internal_notes" TEXT,
  "confirmed_at" TIMESTAMPTZ(3),
  "seated_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "cancelled_at" TIMESTAMPTZ(3),
  "cancellation_reason" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservations_period_check" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "reservations_party_size_check" CHECK ("party_size" > 0)
);

CREATE TABLE "reservation_tables" (
  "tenant_id" UUID NOT NULL,
  "venue_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "table_id" UUID NOT NULL,
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "ends_at" TIMESTAMPTZ(3) NOT NULL,
  "blocks_availability" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_tables_pkey" PRIMARY KEY ("reservation_id", "table_id"),
  CONSTRAINT "reservation_tables_period_check" CHECK ("ends_at" > "starts_at")
);

CREATE TABLE "reservation_status_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "reservation_id" UUID NOT NULL,
  "from_status" "ReservationStatus",
  "to_status" "ReservationStatus" NOT NULL,
  "changed_by_user_id" UUID,
  "reason" TEXT,
  "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_status_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_id_tenant_id_key" ON "users"("id", "tenant_id");
CREATE UNIQUE INDEX "contacts_id_tenant_id_key" ON "contacts"("id", "tenant_id");
CREATE UNIQUE INDEX "venues_id_tenant_id_key" ON "venues"("id", "tenant_id");
CREATE UNIQUE INDEX "dining_areas_id_tenant_id_key" ON "dining_areas"("id", "tenant_id");
CREATE UNIQUE INDEX "dining_areas_id_tenant_id_venue_id_key" ON "dining_areas"("id", "tenant_id", "venue_id");
CREATE UNIQUE INDEX "restaurant_tables_id_tenant_id_key" ON "restaurant_tables"("id", "tenant_id");
CREATE UNIQUE INDEX "restaurant_tables_id_tenant_id_venue_id_key" ON "restaurant_tables"("id", "tenant_id", "venue_id");
CREATE UNIQUE INDEX "reservations_id_tenant_id_key" ON "reservations"("id", "tenant_id");
CREATE UNIQUE INDEX "reservations_id_tenant_id_venue_id_key" ON "reservations"("id", "tenant_id", "venue_id");
CREATE UNIQUE INDEX "dining_areas_venue_id_name_key" ON "dining_areas"("venue_id", "name");
CREATE UNIQUE INDEX "restaurant_tables_venue_id_label_key" ON "restaurant_tables"("venue_id", "label");

CREATE INDEX "venues_tenant_id_is_active_idx" ON "venues"("tenant_id", "is_active");
CREATE INDEX "dining_areas_tenant_id_venue_id_is_active_idx" ON "dining_areas"("tenant_id", "venue_id", "is_active");
CREATE INDEX "restaurant_tables_tenant_id_venue_id_dining_area_id_is_active_idx" ON "restaurant_tables"("tenant_id", "venue_id", "dining_area_id", "is_active");
CREATE INDEX "service_periods_tenant_id_venue_id_day_of_week_is_active_idx" ON "service_periods"("tenant_id", "venue_id", "day_of_week", "is_active");
CREATE INDEX "reservations_tenant_id_venue_id_starts_at_idx" ON "reservations"("tenant_id", "venue_id", "starts_at");
CREATE INDEX "reservations_tenant_id_contact_id_starts_at_idx" ON "reservations"("tenant_id", "contact_id", "starts_at");
CREATE INDEX "reservations_tenant_id_status_starts_at_idx" ON "reservations"("tenant_id", "status", "starts_at");
CREATE INDEX "reservation_tables_tenant_id_table_id_starts_at_idx" ON "reservation_tables"("tenant_id", "table_id", "starts_at");
CREATE INDEX "reservation_status_history_tenant_id_reservation_id_changed_at_idx" ON "reservation_status_history"("tenant_id", "reservation_id", "changed_at");

ALTER TABLE "venues" ADD CONSTRAINT "venues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dining_areas" ADD CONSTRAINT "dining_areas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dining_areas" ADD CONSTRAINT "dining_areas_venue_id_tenant_id_fkey" FOREIGN KEY ("venue_id", "tenant_id") REFERENCES "venues"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_venue_id_tenant_id_fkey" FOREIGN KEY ("venue_id", "tenant_id") REFERENCES "venues"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_dining_area_id_tenant_id_venue_id_fkey" FOREIGN KEY ("dining_area_id", "tenant_id", "venue_id") REFERENCES "dining_areas"("id", "tenant_id", "venue_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_periods" ADD CONSTRAINT "service_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_periods" ADD CONSTRAINT "service_periods_venue_id_tenant_id_fkey" FOREIGN KEY ("venue_id", "tenant_id") REFERENCES "venues"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_venue_id_tenant_id_fkey" FOREIGN KEY ("venue_id", "tenant_id") REFERENCES "venues"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_contact_id_tenant_id_fkey" FOREIGN KEY ("contact_id", "tenant_id") REFERENCES "contacts"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_created_by_user_id_tenant_id_fkey" FOREIGN KEY ("created_by_user_id", "tenant_id") REFERENCES "users"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_tables" ADD CONSTRAINT "reservation_tables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_tables" ADD CONSTRAINT "reservation_tables_reservation_id_tenant_id_venue_id_fkey" FOREIGN KEY ("reservation_id", "tenant_id", "venue_id") REFERENCES "reservations"("id", "tenant_id", "venue_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_tables" ADD CONSTRAINT "reservation_tables_table_id_tenant_id_venue_id_fkey" FOREIGN KEY ("table_id", "tenant_id", "venue_id") REFERENCES "restaurant_tables"("id", "tenant_id", "venue_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_status_history" ADD CONSTRAINT "reservation_status_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_status_history" ADD CONSTRAINT "reservation_status_history_reservation_id_tenant_id_fkey" FOREIGN KEY ("reservation_id", "tenant_id") REFERENCES "reservations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reservation_status_history" ADD CONSTRAINT "reservation_status_history_changed_by_user_id_tenant_id_fkey" FOREIGN KEY ("changed_by_user_id", "tenant_id") REFERENCES "users"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database-enforced protection against assigning one table to overlapping active reservations.
ALTER TABLE "reservation_tables"
ADD CONSTRAINT "reservation_tables_no_overlap"
EXCLUDE USING gist (
  "tenant_id" WITH =,
  "table_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
)
WHERE ("blocks_availability");
