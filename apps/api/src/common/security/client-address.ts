type AddressRequest = {
  ip?: string;
  socket?: { remoteAddress?: string };
};

/**
 * Uses the socket address, or Express `ip` after trust-proxy is configured.
 * `X-Forwarded-For` is not read here, so a client cannot choose its rate-limit bucket.
 */
export function readClientAddress(request: AddressRequest): string | null {
  const address = request.ip?.trim() || request.socket?.remoteAddress?.trim() || '';
  return address.length === 0 ? null : address;
}
