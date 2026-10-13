CREATE TYPE "PipelineCardPriority" AS ENUM ('NORMAL', 'URGENT');

ALTER TABLE "pipeline_cards"
  ADD COLUMN "priority" "PipelineCardPriority" NOT NULL DEFAULT 'NORMAL';
