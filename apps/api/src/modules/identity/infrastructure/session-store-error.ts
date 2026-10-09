const SESSION_STORE_UNAVAILABLE = 'Session store is unavailable.';

/** Safe failure for a missing, timed-out, or rejected session store. The message has no internals. */
export class SessionStoreUnavailableError extends Error {
  constructor() {
    super(SESSION_STORE_UNAVAILABLE);
    this.name = 'SessionStoreUnavailableError';
  }
}
