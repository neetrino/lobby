import type { SessionPrincipal } from './contact';

let rememberedSession: SessionPrincipal | null = null;

/** Keep the last signed-in principal across page remounts. Server renders stay empty. */
export function rememberSession(session: SessionPrincipal | null): SessionPrincipal | null {
  if (typeof window === 'undefined') {
    return session;
  }
  if (session !== null) {
    rememberedSession = session;
  }
  return session ?? rememberedSession;
}

export function clearRememberedSession(): void {
  rememberedSession = null;
}
