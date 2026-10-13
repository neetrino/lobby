-- CreateTable
CREATE TABLE "processed_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "handler_name" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_version" INTEGER NOT NULL,
    "event_id" UUID NOT NULL,
    "reserved_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_events_handler_event_key" ON "processed_events"("handler_name", "event_type", "event_version", "event_id");
