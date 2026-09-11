// Deliberately conservative — this app handles KYC documents, personal
// data, and session cookies under CLAUDE.md's data-protection rules, so
// the default "collect everything" behavior isn't appropriate. This
// still captures what error tracking actually needs (exception, stack
// trace, route, timestamp) without cookies/auth headers/request bodies/
// local variable values ever leaving the app. Shared by every Sentry.init
// call (client, server, edge) so the three runtimes can't drift apart.
// Not explicitly typed against @sentry/nextjs's DataCollection — that
// type isn't re-exported from the package's public entrypoint, only used
// internally — but each Sentry.init({ dataCollection: ... }) call site
// still gets full structural checking against it.
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: { request: false, response: false },
  httpBodies: [],
  urlQueryParams: false,
  stackFrameVariables: false,
};

// Pure error tracking, not full request tracing — matches what was
// actually asked for. Revisit (and budget the added event volume against
// the free tier) if performance monitoring becomes a real need later.
export const sentryTracesSampleRate = 0;

/**
 * Stack-frame origins we never report from.
 *
 * A browser extension's content script runs *inside* our page, so anything it
 * throws reaches `window.onerror` and lands in this project looking exactly
 * like our own bug — unfixable from here, and it buries the real ones. This
 * filters on **where the frame came from**, not on what the message said, so
 * an identical-looking error thrown by our own bundle is still reported.
 *
 * Browser only; a server/edge stack has no extension frames.
 */
export const sentryDenyUrls = [
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-(web-)?extension:\/\//i,
  /^ms-browser-extension:\/\//i,
  /^chrome:\/\//i,
  /extensions\//i,
];

/**
 * Messages that describe someone else's behaviour rather than a fault of ours.
 *
 * Keep this list short and each entry justified — an over-broad pattern here
 * silently deletes real bugs, which is worse than the noise it removes.
 */
export const sentryIgnoreErrors = [
  // SERVER. Next's App Router streams the HTML/RSC response; when the browser
  // hangs up mid-stream (navigating away, closing the tab, a crawler aborting)
  // Node's stream pipeline throws this. Nothing is broken and nothing can be
  // done about it in code — the request simply ended early.
  //
  // Caveat worth remembering: a *sustained spike* of these would be a real
  // signal (a slow TTFB making people leave before the page finishes), and
  // this filter hides that signal. If the landing page ever feels slow, check
  // Vercel's own request logs rather than expecting Sentry to say so.
  "The destination stream closed early",
];
