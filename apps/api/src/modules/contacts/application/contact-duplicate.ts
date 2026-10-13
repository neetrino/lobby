export type ContactDuplicateWarning = {
  code: 'POSSIBLE_DUPLICATE';
  contactId: string;
};

export function duplicateWarnings(ids: readonly string[]): ContactDuplicateWarning[] {
  return ids.map((contactId) => ({ code: 'POSSIBLE_DUPLICATE', contactId }));
}
