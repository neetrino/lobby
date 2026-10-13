-- Lead visibility is a user preference. Existing users keep leads visible.
-- Card details stay optional. Amount remains a PostgreSQL integer.

ALTER TABLE "users"
  ADD COLUMN "leads_enabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "PipelineCardOutcome" AS ENUM ('OPEN', 'WON', 'LOST', 'DISQUALIFIED', 'CONVERTED');

ALTER TABLE "pipeline_cards"
  ADD COLUMN "source" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "qualification" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "next_action" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "lost_reason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "outcome" "PipelineCardOutcome" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "expected_close_on" DATE,
  ADD COLUMN "contact_id" UUID,
  ADD COLUMN "owner_user_id" UUID;

ALTER TABLE "pipeline_cards"
  ADD CONSTRAINT "pipeline_cards_source_check" CHECK (char_length("source") <= 120),
  ADD CONSTRAINT "pipeline_cards_qualification_check" CHECK (char_length("qualification") <= 200),
  ADD CONSTRAINT "pipeline_cards_next_action_check" CHECK (char_length("next_action") <= 200),
  ADD CONSTRAINT "pipeline_cards_lost_reason_check" CHECK (char_length("lost_reason") <= 200);

ALTER TABLE "pipeline_cards"
  ADD CONSTRAINT "pipeline_cards_contact_id_tenant_id_fkey"
  FOREIGN KEY ("contact_id", "tenant_id") REFERENCES "contacts"("id", "tenant_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pipeline_cards"
  ADD CONSTRAINT "pipeline_cards_owner_user_id_tenant_id_fkey"
  FOREIGN KEY ("owner_user_id", "tenant_id") REFERENCES "users"("id", "tenant_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
