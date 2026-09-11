// The decision half of usePolling, kept pure and dependency-free so it can be
// unit-tested without a DOM or fake timers — same split as
// services/email-outbox-policy.ts. The React wiring (visibilitychange
// listener, timers, refs) lives in hooks/use-polling.ts and owns no rules of
// its own.
//
// Why any of this exists: every poller in the app ran on a bare setInterval.
// They kept firing while the tab was hidden, they started a new request
// whether or not the previous one had come back, and a slow response could
// land after a newer one and overwrite it with older data.

export interface PollGate {
  /** The caller wants this poller running at all (panel open, feature on…). */
  enabled: boolean;
  /** `document.visibilityState === "visible"` — nobody is looking otherwise. */
  visible: boolean;
  /** A run started earlier has not settled yet. */
  inFlight: boolean;
}

/**
 * May a run start right now?
 *
 * `inFlight` is what makes the schedule non-overlapping: the next run is only
 * ever scheduled once the previous one settles, so two requests for the same
 * data can never be outstanding together and there is no ordering to get
 * wrong.
 */
export function canPoll(gate: PollGate): boolean {
  return gate.enabled && gate.visible && !gate.inFlight;
}

/**
 * Did conditions just change from "not polling" to "polling"?
 *
 * When they do, whatever is on screen has been frozen for an unknown length of
 * time — longer than the interval, possibly hours if the tab sat in the
 * background. Waiting out a fresh interval would show stale data for up to
 * that long after the user comes back, so the caller runs once immediately
 * instead.
 */
export function shouldCatchUp(prev: PollGate, next: PollGate): boolean {
  const wasPollable = prev.enabled && prev.visible;
  const isPollable = next.enabled && next.visible;
  return !wasPollable && isPollable;
}

/**
 * Is a response still the newest one asked for?
 *
 * Non-overlapping scheduling covers the poller's own runs, but a manual
 * refresh (sending a message, switching conversation) can still be in flight
 * alongside a scheduled one. Callers stamp each request with an increasing
 * sequence and drop anything that comes back behind the latest.
 */
export function isFreshResponse(seq: number, latestSeq: number): boolean {
  return seq >= latestSeq;
}

export interface ReadStateMessage {
  senderId: string;
  readAt: string | Date | null;
}

/**
 * Does this conversation actually need a PATCH /read?
 *
 * Marking read is a two-row write (`conversationParticipant.update` +
 * `message.updateMany`, in a transaction). The chat panel used to fire it
 * after *every* poll — once every two seconds for as long as a conversation
 * was open, almost always writing nothing. It is only needed when the other
 * side has sent something we have not read yet; our own messages never count,
 * and an already-read incoming message does not either.
 *
 * This is self-limiting: once the PATCH lands, the next poll returns those
 * messages with `readAt` set and the answer goes back to false until the other
 * person writes again.
 */
export function shouldMarkRead(
  messages: ReadStateMessage[],
  currentUserId: string,
): boolean {
  return messages.some(
    (message) => message.senderId !== currentUserId && message.readAt === null,
  );
}
