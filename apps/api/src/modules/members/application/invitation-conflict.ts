import { InvitationError, invitationErrorCodes, type InvitationErrorCode } from '../domain/invitation.errors';

const OPEN_EMAIL_INDEX = 'member_invitations_open_email_key';
const TOKEN_HASH_INDEX = 'member_invitations_token_hash_key';
const USER_EMAIL_INDEX = 'users_tenant_id_email_key';

/** Maps a unique-constraint race to a catalogued invitation error. Other errors propagate. */
export function rethrowInvitationConflict(error: unknown): never {
  const code = invitationUniqueConflict(error);
  if (code !== null) {
    throw new InvitationError(code);
  }
  throw error;
}

export function invitationUniqueConflict(error: unknown): InvitationErrorCode | null {
  if (!isRecord(error) || error.code !== 'P2002') {
    return null;
  }
  const names = constraintNames(error.meta);
  if (names.includes(OPEN_EMAIL_INDEX) || isOpenEmailPair(error.meta)) {
    return invitationErrorCodes.ALREADY_PENDING;
  }
  if (names.includes(USER_EMAIL_INDEX) || isUserEmailPair(error.meta)) {
    return invitationErrorCodes.EMAIL_TAKEN;
  }
  if (names.includes(TOKEN_HASH_INDEX)) {
    return invitationErrorCodes.INVALID;
  }
  return null;
}

function isOpenEmailPair(meta: unknown): boolean {
  return isTable(meta, 'member_invitations') && hasTenantAndEmail(constraintFields(meta));
}

function isUserEmailPair(meta: unknown): boolean {
  return isTable(meta, 'users') && hasTenantAndEmail(constraintFields(meta));
}

function isTable(meta: unknown, table: string): boolean {
  if (!isRecord(meta)) {
    return false;
  }
  if (meta.table === table || adapterCause(meta)?.table === table) {
    return true;
  }
  return meta.modelName === (table === 'users' ? 'User' : 'MemberInvitation');
}

function hasTenantAndEmail(fields: readonly string[]): boolean {
  const hasEmail = fields.includes('email');
  const hasTenant = fields.includes('tenant_id') || fields.includes('tenantId');
  return hasEmail && hasTenant;
}

function constraintNames(meta: unknown): string[] {
  if (!isRecord(meta)) {
    return [];
  }
  const names: string[] = [];
  if (typeof meta.target === 'string') {
    names.push(meta.target);
  }
  const index = readConstraint(meta).index;
  if (index !== undefined) {
    names.push(index);
  }
  return names;
}

function constraintFields(meta: unknown): readonly string[] {
  if (!isRecord(meta)) {
    return [];
  }
  if (Array.isArray(meta.target)) {
    return stringItems(meta.target);
  }
  return readConstraint(meta).fields ?? [];
}

function readConstraint(meta: Record<string, unknown>): { index?: string; fields?: readonly string[] } {
  const cause = adapterCause(meta);
  if (cause === undefined || !isRecord(cause.constraint)) {
    return {};
  }
  const { index, fields } = cause.constraint;
  return {
    ...(typeof index === 'string' ? { index } : {}),
    ...(Array.isArray(fields) ? { fields: stringItems(fields) } : {}),
  };
}

function adapterCause(meta: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!isRecord(meta.driverAdapterError) || !isRecord(meta.driverAdapterError.cause)) {
    return undefined;
  }
  return meta.driverAdapterError.cause;
}

function stringItems(values: readonly unknown[]): string[] {
  return values.filter((value): value is string => typeof value === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
