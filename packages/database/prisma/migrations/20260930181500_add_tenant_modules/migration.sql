-- CreateEnum
CREATE TYPE "TenantModuleStatus" AS ENUM ('ENABLED', 'DISABLED');

-- CreateTable
CREATE TABLE "tenant_modules" (
    "tenant_id" UUID NOT NULL,
    "module_key" TEXT NOT NULL,
    "status" "TenantModuleStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_modules_pkey" PRIMARY KEY ("tenant_id", "module_key")
);

-- AddForeignKey
ALTER TABLE "tenant_modules" ADD CONSTRAINT "tenant_modules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing starter tenants receive the same default modules as new registration.
INSERT INTO "tenant_modules" ("tenant_id", "module_key", "status", "created_at", "updated_at")
SELECT "id", 'contacts', 'ENABLED'::"TenantModuleStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants"
WHERE "plan" = 'starter'::"TenantPlan"
UNION ALL
SELECT "id", 'deals', 'ENABLED'::"TenantModuleStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants"
WHERE "plan" = 'starter'::"TenantPlan";
