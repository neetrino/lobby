-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'DENIED', 'FAILURE');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('USER');

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID NOT NULL,
    "actor_role" "TenantRole" NOT NULL,
    "actor_type" "AuditActorType" NOT NULL,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "changes" JSONB,
    "reason" TEXT,
    "request_id" UUID NOT NULL,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "schema_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_events_action_check" CHECK ("action" IN (
        'user.sessions.terminated',
        'user.role.changed',
        'user.disabled',
        'contact.deleted',
        'deal.stage.changed',
        'reservation.status.changed'
    )),
    CONSTRAINT "audit_events_resource_type_check" CHECK (
        "resource_type" IN ('user', 'contact', 'deal', 'reservation')
    ),
    CONSTRAINT "audit_events_reason_check" CHECK (
        "reason" IS NULL OR char_length("reason") BETWEEN 1 AND 500
    ),
    CONSTRAINT "audit_events_ip_hash_check" CHECK (
        "ip_hash" IS NULL OR "ip_hash" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "audit_events_user_agent_check" CHECK (
        "user_agent" IS NULL OR char_length("user_agent") BETWEEN 1 AND 256
    ),
    CONSTRAINT "audit_events_schema_version_check" CHECK ("schema_version" = 1)
);

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_occurred_at_idx" ON "audit_events"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_resource_type_resource_id_idx" ON "audit_events"("tenant_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_actor_user_id_idx" ON "audit_events"("tenant_id", "actor_user_id");

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_tenant_id_fkey" FOREIGN KEY ("actor_user_id", "tenant_id") REFERENCES "users"("id", "tenant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
