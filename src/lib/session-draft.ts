/**
 * Unsaved form input kept for the browser tab's session, so leaving a long
 * form (or a failed save) does not cost the user everything they typed
 * (owner, 19/11/2026).
 *
 * sessionStorage, not localStorage, on purpose: a draft can hold private
 * data (a provider's street address) and must not outlive the tab on a
 * shared computer. Keys carry the user id for the same reason — signing out
 * and in as someone else in the same tab must never show the first
 * person's draft.
 *
 * Every access is wrapped: storage throws in private windows and when the
 * quota is full, and a draft is a convenience, never a reason to break a
 * form.
 */

const PREFIX = "fg:draft:";

export function draftKey(form: string, userId: string, scope = "") {
  return `${PREFIX}${form}:${userId}${scope ? `:${scope}` : ""}`;
}

export function readSessionDraft<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeSessionDraft(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full: the form still works, just undrafted.
  }
}

export function clearSessionDraft(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}
