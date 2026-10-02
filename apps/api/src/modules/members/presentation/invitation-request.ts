import { AUDIT_IP_HASH_KEY, hashAuditIp } from '../../../common/audit/audit-ip-hash';
import { currentRequestId } from '../../../common/http/request-context';
import { readClientAddress } from '../../../common/security/client-address';
import type { AuditClient } from '../../identity/application/terminate-user-sessions.service';

export type InvitationHttpRequest = {
  requestId?: string;
  headers?: { 'user-agent'?: string | string[]; cookie?: string | string[] };
  ip?: string;
  socket?: { remoteAddress?: string };
};

export function readInvitationRequestId(request: InvitationHttpRequest): string {
  const stored = currentRequestId();
  if (stored !== undefined && stored.length > 0) {
    return stored;
  }
  if (request.requestId !== undefined && request.requestId.length > 0) {
    return request.requestId;
  }
  throw new Error('Request id is missing');
}

export function invitationAuditClient(
  request: InvitationHttpRequest,
  key: string | null,
): AuditClient {
  const address = readClientAddress(request);
  return {
    ipHash: address === null || key === null ? null : hashAuditIp(address, key),
    userAgent: readUserAgent(request),
  };
}

export { AUDIT_IP_HASH_KEY };

function readUserAgent(request: InvitationHttpRequest): string | null {
  const raw = request.headers?.['user-agent'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim() ?? '';
  return trimmed.length === 0 ? null : trimmed.slice(0, 256);
}
