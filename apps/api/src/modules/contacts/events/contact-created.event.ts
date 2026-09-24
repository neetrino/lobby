export type ContactCreatedEvent = {
  type: 'contact.created';
  contactId: string;
  organizationId: string;
};
