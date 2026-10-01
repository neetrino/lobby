-- Allow the audit names for soft archive and restore.
-- `contact.deleted` stays in the check so existing rows remain valid.
-- Dropping and recreating this CHECK does not rewrite the table.

ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check";

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (
    'user.sessions.terminated',
    'user.role.changed',
    'user.disabled',
    'contact.deleted',
    'contact.archived',
    'contact.restored',
    'deal.stage.changed',
    'reservation.status.changed'
));
