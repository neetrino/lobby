-- External channel account ids are provider strings, not internal UUIDs.
-- The reservation stores the same text as reservation_source_requests.

ALTER TABLE "reservations"
  ALTER COLUMN "source_account_id" TYPE TEXT USING "source_account_id"::text;

ALTER TABLE "reservations"
  ADD CONSTRAINT "reservations_source_account_check"
  CHECK (
    "source_account_id" IS NULL
    OR char_length(btrim("source_account_id")) BETWEEN 1 AND 200
  );
