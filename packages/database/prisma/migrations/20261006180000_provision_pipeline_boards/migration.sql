-- Boards for tenants that already had deals enabled before initialization moved off GET.
-- Names are the English defaults. A later rename belongs to the tenant.
-- Pipelines that already exist, including ones with custom columns, are left untouched.

INSERT INTO "pipelines" ("tenant_id", "kind", "name", "amount_label", "updated_at")
SELECT tm."tenant_id", 'LEAD'::"PipelineKind", 'Leads', '', CURRENT_TIMESTAMP
FROM "tenant_modules" tm
WHERE tm."module_key" = 'deals'
  AND tm."status" = 'ENABLED'
  AND NOT EXISTS (
    SELECT 1 FROM "pipelines" existing
    WHERE existing."tenant_id" = tm."tenant_id" AND existing."kind" = 'LEAD'
  );

INSERT INTO "pipelines" ("tenant_id", "kind", "name", "amount_label", "updated_at")
SELECT tm."tenant_id", 'DEAL'::"PipelineKind", 'Deals', '', CURRENT_TIMESTAMP
FROM "tenant_modules" tm
WHERE tm."module_key" = 'deals'
  AND tm."status" = 'ENABLED'
  AND NOT EXISTS (
    SELECT 1 FROM "pipelines" existing
    WHERE existing."tenant_id" = tm."tenant_id" AND existing."kind" = 'DEAL'
  );

INSERT INTO "pipeline_columns" ("tenant_id", "pipeline_id", "name", "position", "width_px", "updated_at")
SELECT p."tenant_id", p."id", defaults.name, defaults.position, 300, CURRENT_TIMESTAMP
FROM "pipelines" p
JOIN (
  VALUES
    ('LEAD'::"PipelineKind", 'New', 0),
    ('LEAD'::"PipelineKind", 'Contacted', 1),
    ('LEAD'::"PipelineKind", 'Qualified', 2),
    ('DEAL'::"PipelineKind", 'New', 0),
    ('DEAL'::"PipelineKind", 'Qualified', 1),
    ('DEAL'::"PipelineKind", 'Proposal', 2),
    ('DEAL'::"PipelineKind", 'Negotiation', 3),
    ('DEAL'::"PipelineKind", 'Won', 4)
) AS defaults(kind, name, position) ON p."kind" = defaults.kind
WHERE NOT EXISTS (
  SELECT 1 FROM "pipeline_columns" column_row WHERE column_row."pipeline_id" = p."id"
);
