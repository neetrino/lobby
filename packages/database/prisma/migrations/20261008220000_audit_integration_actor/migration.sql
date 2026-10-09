-- Integration bookings are audited without a user row.
-- The new enum value is unused in this migration so PostgreSQL can commit it first.

ALTER TYPE "AuditActorType" ADD VALUE 'INTEGRATION';
