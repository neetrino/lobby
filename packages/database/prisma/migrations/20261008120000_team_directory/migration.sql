ALTER TABLE "users" ADD COLUMN "job_title" TEXT;

ALTER TABLE "users" ADD CONSTRAINT "users_job_title_check"
  CHECK ("job_title" IS NULL OR char_length("job_title") BETWEEN 1 AND 80);

CREATE TABLE "direct_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "user_low_id" UUID NOT NULL,
  "user_high_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_conversations_pair_check" CHECK ("user_low_id" < "user_high_id"),
  CONSTRAINT "direct_conversations_id_tenant_key" UNIQUE ("id", "tenant_id"),
  CONSTRAINT "direct_conversations_tenant_low_high_key" UNIQUE ("tenant_id", "user_low_id", "user_high_id"),
  CONSTRAINT "direct_conversations_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_conversations_low_tenant_fkey" FOREIGN KEY ("user_low_id", "tenant_id") REFERENCES "users"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_conversations_high_tenant_fkey" FOREIGN KEY ("user_high_id", "tenant_id") REFERENCES "users"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "direct_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "author_user_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_messages_body_check" CHECK (char_length(btrim("body")) BETWEEN 1 AND 2000),
  CONSTRAINT "direct_messages_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "direct_messages_conversation_tenant_fkey" FOREIGN KEY ("conversation_id", "tenant_id") REFERENCES "direct_conversations"("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "direct_messages_author_tenant_fkey" FOREIGN KEY ("author_user_id", "tenant_id") REFERENCES "users"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "direct_messages_tenant_conversation_created_id_idx"
  ON "direct_messages"("tenant_id", "conversation_id", "created_at", "id");
