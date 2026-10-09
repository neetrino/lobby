-- Team statuses belong to the tenant. Existing cards keep a null creator and status.

CREATE TABLE "pipeline_statuses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "pipeline_statuses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pipeline_statuses_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 40),
  CONSTRAINT "pipeline_statuses_color_check" CHECK ("color" ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT "pipeline_statuses_position_check" CHECK ("position" >= 0)
);

CREATE UNIQUE INDEX "pipeline_statuses_tenant_id_name_key" ON "pipeline_statuses"("tenant_id", "name");
CREATE UNIQUE INDEX "pipeline_statuses_tenant_id_position_key" ON "pipeline_statuses"("tenant_id", "position");
CREATE UNIQUE INDEX "pipeline_statuses_id_tenant_id_key" ON "pipeline_statuses"("id", "tenant_id");

ALTER TABLE "pipeline_statuses"
  ADD CONSTRAINT "pipeline_statuses_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pipeline_cards"
  ADD COLUMN "created_by_user_id" UUID,
  ADD COLUMN "status_id" UUID;

CREATE INDEX "pipeline_cards_tenant_id_status_id_idx" ON "pipeline_cards"("tenant_id", "status_id");

ALTER TABLE "pipeline_cards"
  ADD CONSTRAINT "pipeline_cards_created_by_user_id_tenant_id_fkey"
  FOREIGN KEY ("created_by_user_id", "tenant_id") REFERENCES "users"("id", "tenant_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pipeline_cards"
  ADD CONSTRAINT "pipeline_cards_status_id_tenant_id_fkey"
  FOREIGN KEY ("status_id", "tenant_id") REFERENCES "pipeline_statuses"("id", "tenant_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
