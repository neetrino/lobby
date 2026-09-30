import type { ContactOperations, ContactRecord, TenantContacts } from '../src/modules/contacts/infrastructure/contact.repository';

type HasTransaction = 'transaction' extends keyof ContactOperations ? true : false;

/** The object inside a contact transaction has no way to open another one. */
export const contactOperationsOmitTransaction: HasTransaction = false;

/** Typecheck rejects a nested contact transaction. */
export function callbackCannotOpenAnotherTransaction(scope: TenantContacts): Promise<ContactRecord> {
  return scope.transaction((contacts) => {
    // @ts-expect-error A contact transaction cannot open another contact transaction.
    return contacts.transaction(() => contacts.create('Ada'));
  });
}
