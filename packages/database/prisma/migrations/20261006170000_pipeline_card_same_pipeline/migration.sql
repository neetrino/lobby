-- A card's column must belong to that card's pipeline.
-- Card positions inside one column are unique.
-- Existing rows already satisfy both rules; the new foreign key fails closed if they do not.

CREATE UNIQUE INDEX "pipeline_columns_id_pipeline_id_tenant_id_key"
  ON "pipeline_columns"("id", "pipeline_id", "tenant_id");

ALTER TABLE "pipeline_cards" DROP CONSTRAINT "pipeline_cards_column_id_tenant_id_fkey";

ALTER TABLE "pipeline_cards"
  ADD CONSTRAINT "pipeline_cards_column_id_pipeline_id_tenant_id_fkey"
  FOREIGN KEY ("column_id", "pipeline_id", "tenant_id")
  REFERENCES "pipeline_columns"("id", "pipeline_id", "tenant_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "pipeline_cards_column_id_position_key"
  ON "pipeline_cards"("column_id", "position");
