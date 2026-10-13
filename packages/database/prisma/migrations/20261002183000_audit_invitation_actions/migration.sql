-- Allow invitation lifecycle audit names and the memberInvitation resource.
-- Existing action and resource values stay in the checks.
-- Dropping and recreating these CHECKs does not rewrite the table.

ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check";

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (
    'user.sessions.terminated',
    'user.role.changed',
    'user.disabled',
    'invitation.created',
    'invitation.resent',
    'invitation.revoked',
    'invitation.accepted',
    'contact.deleted',
    'contact.archived',
    'contact.restored',
    'deal.stage.changed',
    'reservation.status.changed'
));

ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_resource_type_check";

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_resource_type_check" CHECK (
    "resource_type" IN ('user', 'memberInvitation', 'contact', 'deal', 'reservation')
);
