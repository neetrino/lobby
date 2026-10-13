import type { RequestContext } from '../../../common/tenant/request-context';

/**
 * Archive and restore are allowed for OWNER, ADMIN, or the contact's owner.
 * Other members keep read and update, and cannot archive someone else's contact.
 */
export function canManageContactLifecycle(
  actor: Pick<RequestContext, 'userId' | 'role'>,
  ownerUserId: string,
): boolean {
  if (actor.role === 'OWNER' || actor.role === 'ADMIN') {
    return true;
  }
  return actor.userId === ownerUserId;
}
