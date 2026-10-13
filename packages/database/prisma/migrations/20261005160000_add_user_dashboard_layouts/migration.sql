-- Per-user dashboard layout. Other modules' facts are not stored here.
-- Deleting the user removes the layout. The tenant row stays restricted.

CREATE TABLE "user_dashboard_layouts" (
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "range_days" INTEGER NOT NULL DEFAULT 30,
  "scope" TEXT NOT NULL DEFAULT 'all',
  "customized" BOOLEAN NOT NULL DEFAULT false,
  "widget_order" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "user_dashboard_layouts_pkey" PRIMARY KEY ("user_id", "tenant_id"),
  CONSTRAINT "user_dashboard_layouts_range_days_check" CHECK ("range_days" IN (7, 30, 90)),
  CONSTRAINT "user_dashboard_layouts_scope_check" CHECK ("scope" IN ('all', 'mine'))
);

ALTER TABLE "user_dashboard_layouts"
  ADD CONSTRAINT "user_dashboard_layouts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_dashboard_layouts"
  ADD CONSTRAINT "user_dashboard_layouts_user_id_tenant_id_fkey"
  FOREIGN KEY ("user_id", "tenant_id") REFERENCES "users" ("id", "tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
