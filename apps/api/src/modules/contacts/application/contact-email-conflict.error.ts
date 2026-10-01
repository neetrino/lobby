/** Unique index from `@@unique([tenantId, email])` on `Contact`. */
const CONTACT_EMAIL_INDEX = 'contacts_tenant_id_email_key';

/** Two contacts in one tenant cannot share an email. The message does not include the address. */
export class ContactEmailConflictError extends Error {
  readonly code = 'CONTACT_EMAIL_TAKEN' as const;
  readonly statusCode = 409;

  constructor() {
    super('A contact with this email already exists.');
    this.name = 'ContactEmailConflictError';
  }
}

/**
 * True only for the contacts `(tenant_id, email)` unique index.
 * Prisma 7 puts that index on `meta.driverAdapterError.cause.constraint`.
 * Older clients put it on `meta.target`.
 */
export function isContactEmailConflict(error: unknown): boolean {
  if (!isRecord(error) || error.code !== 'P2002') {
    return false;
  }
  return matchesContactEmailConstraint(error.meta);
}

function matchesContactEmailConstraint(meta: unknown): boolean {
  if (!isRecord(meta)) {
    return false;
  }
  if (constraintNames(meta).includes(CONTACT_EMAIL_INDEX)) {
    return true;
  }
  return isContactTable(meta) && isTenantEmailFieldPair(constraintFields(meta));
}

function constraintNames(meta: Record<string, unknown>): string[] {
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

function constraintFields(meta: Record<string, unknown>): readonly string[] {
  if (Array.isArray(meta.target)) {
    return stringItems(meta.target);
  }
  return readConstraint(meta).fields ?? [];
}

function readConstraint(meta: Record<string, unknown>): {
  index?: string;
  fields?: readonly string[];
} {
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

function isContactTable(meta: Record<string, unknown>): boolean {
  if (meta.modelName === 'Contact' || meta.table === 'contacts') {
    return true;
  }
  return adapterCause(meta)?.table === 'contacts';
}

function isTenantEmailFieldPair(fields: readonly string[]): boolean {
  if (fields.length !== 2) {
    return false;
  }
  const hasEmail = fields.includes('email');
  const hasTenant = fields.includes('tenant_id') || fields.includes('tenantId');
  return hasEmail && hasTenant;
}

function stringItems(values: readonly unknown[]): string[] {
  return values.filter((value): value is string => typeof value === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
