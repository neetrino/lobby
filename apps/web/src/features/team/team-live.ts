import { readDirectMessages, readNewerMessages, type DirectMessage } from './team-api';

/** How often an open thread looks for messages it does not have yet. There is no push channel. */
export const TEAM_CHAT_POLL_MS = 3_000;

/** Distance from the bottom that still counts as following new messages. */
export const TEAM_CHAT_STICK_PX = 48;

/**
 * Forward pages read in one refresh.
 * A burst past this cap continues on the next refresh from the last server sync cursor.
 */
export const TEAM_CHAT_FORWARD_MAX_PAGES = 20;

type MessagePage = Awaited<ReturnType<typeof readDirectMessages>>;

type ThreadWatch = {
  onOpen: (page: MessagePage) => void;
  onLatest: (messages: readonly DirectMessage[]) => void;
  onFail: () => void;
};

type WatchState = {
  stopped: boolean;
  busy: boolean;
  opened: boolean;
  syncCursor: string | null;
};

/**
 * Loads the newest page, then keeps reading every message newer than the last one shown.
 * The timer starts immediately, so a failed first load retries on the same interval.
 */
export function watchLatest(memberId: string, signal: AbortSignal, handlers: ThreadWatch): () => void {
  const state: WatchState = { stopped: false, busy: false, opened: false, syncCursor: null };
  const timer = setInterval(() => {
    void refresh(memberId, signal, handlers, state);
  }, TEAM_CHAT_POLL_MS);
  void refresh(memberId, signal, handlers, state);
  return () => {
    state.stopped = true;
    clearInterval(timer);
  };
}

/** Keeps the current list when every incoming id is already present. */
export function mergeNewest(current: DirectMessage[], incoming: readonly DirectMessage[]): DirectMessage[] {
  const known = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !known.has(message.id));
  if (fresh.length === 0) {
    return current;
  }
  return [...current, ...fresh].sort(byTime);
}

export type ScrollAnchor = {
  height: number;
  top: number;
};

/** Scroll offset that keeps the same messages in view after content is inserted above. */
export function nextScrollTop(anchor: ScrollAnchor, nextHeight: number): number {
  return anchor.top + (nextHeight - anchor.height);
}

export function isNearBottom(scrollHeight: number, scrollTop: number, clientHeight: number): boolean {
  return scrollHeight - scrollTop - clientHeight <= TEAM_CHAT_STICK_PX;
}

async function refresh(
  memberId: string,
  signal: AbortSignal,
  handlers: ThreadWatch,
  state: WatchState,
): Promise<void> {
  if (state.stopped || state.busy) {
    return;
  }
  state.busy = true;
  try {
    if (!state.opened) {
      await openThread(memberId, signal, handlers, state);
      return;
    }
    await pullNewer(memberId, signal, handlers, state);
  } catch {
    if (!state.stopped && !signal.aborted && !state.opened) {
      handlers.onFail();
    }
  } finally {
    state.busy = false;
  }
}

async function openThread(
  memberId: string,
  signal: AbortSignal,
  handlers: ThreadWatch,
  state: WatchState,
): Promise<void> {
  const page = await readDirectMessages(memberId, null, signal);
  if (state.stopped || signal.aborted) {
    return;
  }
  state.opened = true;
  state.syncCursor = page.page.syncCursor;
  handlers.onOpen(page);
}

async function pullNewer(
  memberId: string,
  signal: AbortSignal,
  handlers: ThreadWatch,
  state: WatchState,
): Promise<void> {
  if (state.syncCursor === null) {
    await reopenEmpty(memberId, signal, handlers, state);
    return;
  }
  const caughtUp = await collectNewer(memberId, state.syncCursor, signal);
  if (state.stopped || signal.aborted) {
    return;
  }
  if (caughtUp.syncCursor !== null) {
    state.syncCursor = caughtUp.syncCursor;
  }
  if (caughtUp.messages.length > 0) {
    handlers.onLatest(caughtUp.messages);
  }
}

async function reopenEmpty(
  memberId: string,
  signal: AbortSignal,
  handlers: ThreadWatch,
  state: WatchState,
): Promise<void> {
  const page = await readDirectMessages(memberId, null, signal);
  if (state.stopped || signal.aborted || page.data.length === 0) {
    return;
  }
  state.syncCursor = page.page.syncCursor;
  handlers.onOpen(page);
}

async function collectNewer(
  memberId: string,
  syncCursor: string,
  signal: AbortSignal,
): Promise<{ messages: DirectMessage[]; syncCursor: string | null }> {
  const collected: DirectMessage[] = [];
  const seen = new Set<string>();
  let after: string | null = syncCursor;
  let latestCursor: string | null = null;
  for (let page = 0; page < TEAM_CHAT_FORWARD_MAX_PAGES && after !== null; page += 1) {
    if (seen.has(after)) {
      break;
    }
    seen.add(after);
    const next = await readNewerMessages(memberId, after, signal);
    collected.push(...next.data);
    if (next.page.syncCursor !== null) {
      latestCursor = next.page.syncCursor;
    }
    after = next.page.nextCursor;
  }
  return { messages: collected, syncCursor: latestCursor };
}

function byTime(left: DirectMessage, right: DirectMessage): number {
  const time = left.createdAt.localeCompare(right.createdAt);
  return time === 0 ? left.id.localeCompare(right.id) : time;
}
