// Deduplication state for the "lượt xem hồ sơ" counter.
//
// The counter used to be a bare `viewCount: { increment: 1 }` fired from the
// profile page's Server Component, so it moved on every single render: a
// refresh, a tab restore, a bounce back from the back button, a role-tab
// switch (`?role=`), and every crawler that touched the URL. A provider
// reading "412 lượt xem" had no way to know whether that was 412 people or
// four people with itchy refresh fingers.
//
// A Server Component cannot set cookies, so the counting moved to a route
// handler the browser calls once per page view, and this module is the part
// that decides whether a given call is a *new* view. Everything here is pure
// so the decision is testable without a request, a database, or a clock.
//
// Why a cookie and not a table: a `ProfileView` row per visitor per profile
// would be the textbook answer, but a schema migration is out of scope here
// and this is an analytics nicety, not billing data. A cookie is per-browser
// and per-device, so the same person on a phone and a laptop counts twice.
// That is the accepted inaccuracy — it is still enormously closer to the
// truth than counting every refresh.

// One window per profile per viewer. A day is long enough that normal
// same-session re-reads (open, leave, come back after lunch) stay a single
// view, and short enough that genuine interest a week later counts again.
export const VIEW_DEDUPE_WINDOW_SECONDS = 60 * 60 * 24;

// A cuid is ~25 characters and each entry carries a timestamp, so 40 entries
// is roughly 1.5KB — comfortably inside the 4KB per-cookie budget, and the
// cookie is path-scoped to the one endpoint that reads it so it never rides
// along on page or asset requests. Past 40 the oldest entries fall off, and
// the 41st-oldest profile can be counted twice. Fine: someone who visited 40
// different profiles in a day is not who this is protecting against.
export const MAX_REMEMBERED_VIEWS = 40;

export const PROFILE_VIEW_COOKIE = "fg_pv";
export const PROFILE_VIEW_COOKIE_PATH = "/api/profiles/view";

/** profileId -> epoch seconds when that profile becomes countable again. */
export type ViewState = Record<string, number>;

/**
 * Reads the cookie. Anything malformed — truncated, hand-edited, left over
 * from an older shape — is treated as "no history", which costs at most one
 * double-counted view. It must never throw: this runs on a request path whose
 * only job is to bump a number.
 */
export function parseViewState(raw: string | undefined): ViewState {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const state: ViewState = {};
    for (const [id, expiry] of Object.entries(parsed as object)) {
      if (typeof expiry === "number" && Number.isFinite(expiry)) {
        state[id] = expiry;
      }
    }
    return state;
  } catch {
    return {};
  }
}

export function serializeViewState(state: ViewState) {
  return JSON.stringify(state);
}

/** True when this viewer has not counted for this profile inside the window. */
export function shouldCountView(
  state: ViewState,
  profileId: string,
  nowSeconds: number,
) {
  const expiry = state[profileId];
  return expiry === undefined || expiry <= nowSeconds;
}

/**
 * Records the view and returns the next state. Also drops entries whose
 * window has passed — without this the cookie would only ever grow, and the
 * 40-entry cap would start evicting live entries while holding dead ones.
 */
export function rememberView(
  state: ViewState,
  profileId: string,
  nowSeconds: number,
): ViewState {
  const live = Object.entries(state).filter(
    ([id, expiry]) => id !== profileId && expiry > nowSeconds,
  );

  // Newest last, so the slice below keeps the most recent entries.
  live.sort((a, b) => a[1] - b[1]);
  live.push([profileId, nowSeconds + VIEW_DEDUPE_WINDOW_SECONDS]);

  return Object.fromEntries(live.slice(-MAX_REMEMBERED_VIEWS));
}
