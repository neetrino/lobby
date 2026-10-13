-- Allow the booking-created audit action. Existing action values stay in the check.

ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_action_check";

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_check" CHECK ("action" IN (
    'user.sessions.terminated',
    'user.role.changed',
    'user.disabled',
    'user.password.reset',
    'invitation.created',
    'invitation.resent',
    'invitation.revoked',
    'invitation.accepted',
    'contact.deleted',
    'contact.archived',
    'contact.restored',
    'deal.stage.changed',
    'lead.stage.changed',
    'lead.converted',
    'pipeline.configured',
    'pipeline.card.deleted',
    'pipeline.card.updated',
    'reservation.created',
    'reservation.status.changed'
));
