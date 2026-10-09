-- Promote request_fingerprint to NOT NULL only when every stored request already has a hash.
-- If this stops, back up the database and fill the original command hashes, then deploy again.
-- Do not derive those hashes from the current reservation row.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "reservation_source_requests"
    WHERE "request_fingerprint" IS NULL
  ) THEN
    RAISE EXCEPTION 'reservation_source_requests.request_fingerprint is null. Back up the database and store the original command hash before setting NOT NULL.';
  END IF;
END $$;

ALTER TABLE "reservation_source_requests"
  ALTER COLUMN "request_fingerprint" SET NOT NULL;

ALTER TABLE "reservation_source_requests"
  DROP CONSTRAINT "reservation_source_requests_fingerprint_check";

ALTER TABLE "reservation_source_requests"
  ADD CONSTRAINT "reservation_source_requests_fingerprint_check"
  CHECK ("request_fingerprint" ~ '^[0-9a-f]{64}$');
