-- Channel configuration for a future webhook adapter.
-- The raw secret is not stored. Authentication looks up sha256(credential), then reads tenant, provider, and account from this row.
-- Additive. The table is new and empty. Not a backfill of reservation rows.

CREATE TABLE "reservation_channels" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "provider" "ReservationSource" NOT NULL,
  "channel_account_id" TEXT NOT NULL,
  "credential_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_channels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_channels_provider_check" CHECK (
    "provider" IN ('WEBSITE', 'INSTAGRAM', 'WHATSAPP', 'TELEGRAM')
  ),
  CONSTRAINT "reservation_channels_account_check" CHECK (char_length(btrim("channel_account_id")) BETWEEN 1 AND 200),
  CONSTRAINT "reservation_channels_credential_hash_check" CHECK ("credential_hash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "reservation_channels_credential_hash_key" ON "reservation_channels"("credential_hash");
CREATE UNIQUE INDEX "reservation_channels_account_key" ON "reservation_channels"("tenant_id", "provider", "channel_account_id");

ALTER TABLE "reservation_channels"
  ADD CONSTRAINT "reservation_channels_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
