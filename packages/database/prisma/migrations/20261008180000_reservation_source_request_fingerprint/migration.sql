-- Original command fingerprint. Replay compares this hash, not the live reservation row.
-- Nullable first so an existing row does not fail ADD COLUMN.
-- Do not backfill from the current reservation: a later edit is not the original command.
-- Null means the original command is unknown. 20261008190000 sets NOT NULL after every row has a hash.

ALTER TABLE "reservation_source_requests"
  ADD COLUMN "request_fingerprint" TEXT;

ALTER TABLE "reservation_source_requests"
  ADD CONSTRAINT "reservation_source_requests_fingerprint_check"
  CHECK ("request_fingerprint" IS NULL OR "request_fingerprint" ~ '^[0-9a-f]{64}$');
