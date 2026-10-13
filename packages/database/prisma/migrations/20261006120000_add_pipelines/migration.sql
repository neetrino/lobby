-- Tenant-owned lead and deal boards. Existing tables are unchanged.

CREATE TYPE "PipelineKind" AS ENUM ('LEAD', 'DEAL');

CREATE TABLE "pipelines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "kind" "PipelineKind" NOT NULL,
  "name" TEXT NOT NULL,
  "amount_label" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pipelines_tenant_id_kind_key" ON "pipelines"("tenant_id", "kind");
CREATE UNIQUE INDEX "pipelines_id_tenant_id_key" ON "pipelines"("id", "tenant_id");

ALTER TABLE "pipelines"
  ADD CONSTRAINT "pipelines_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "pipeline_columns" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "pipeline_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "width_px" INTEGER NOT NULL DEFAULT 300,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "pipeline_columns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pipeline_columns_width_px_check" CHECK ("width_px" BETWEEN 220 AND 640),
  CONSTRAINT "pipeline_columns_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX "pipeline_columns_pipeline_id_position_key" ON "pipeline_columns"("pipeline_id", "position");
CREATE UNIQUE INDEX "pipeline_columns_id_tenant_id_key" ON "pipeline_columns"("id", "tenant_id");
CREATE INDEX "pipeline_columns_tenant_id_pipeline_id_idx" ON "pipeline_columns"("tenant_id", "pipeline_id");

ALTER TABLE "pipeline_columns"
  ADD CONSTRAINT "pipeline_columns_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pipeline_columns"
  ADD CONSTRAINT "pipeline_columns_pipeline_id_tenant_id_fkey"
  FOREIGN KEY ("pipeline_id", "tenant_id") REFERENCES "pipelines"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "pipeline_cards" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "pipeline_id" UUID NOT NULL,
  "column_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL DEFAULT '',
  "amount" INTEGER NOT NULL DEFAULT 0,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "pipeline_cards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pipeline_cards_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "pipeline_cards_title_check" CHECK (char_length(btrim("title")) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX "pipeline_cards_id_tenant_id_key" ON "pipeline_cards"("id", "tenant_id");
CREATE INDEX "pipeline_cards_tenant_id_column_id_position_idx" ON "pipeline_cards"("tenant_id", "column_id", "position");

ALTER TABLE "pipeline_cards"
  ADD CONSTRAINT "pipeline_cards_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pipeline_cards"
  ADD CONSTRAINT "pipeline_cards_pipeline_id_tenant_id_fkey"
  FOREIGN KEY ("pipeline_id", "tenant_id") REFERENCES "pipelines"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pipeline_cards"
  ADD CONSTRAINT "pipeline_cards_column_id_tenant_id_fkey"
  FOREIGN KEY ("column_id", "tenant_id") REFERENCES "pipeline_columns"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
