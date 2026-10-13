CREATE TABLE "pipeline_card_notes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "card_id" UUID NOT NULL,
  "author_user_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pipeline_card_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pipeline_card_notes_body_check" CHECK (char_length(btrim("body")) BETWEEN 1 AND 4000),
  CONSTRAINT "pipeline_card_notes_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "pipeline_card_notes_card_tenant_fkey" FOREIGN KEY ("card_id", "tenant_id") REFERENCES "pipeline_cards"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "pipeline_card_notes_author_tenant_fkey" FOREIGN KEY ("author_user_id", "tenant_id") REFERENCES "users"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "pipeline_card_notes_tenant_card_created_id_idx"
  ON "pipeline_card_notes"("tenant_id", "card_id", "created_at", "id");
