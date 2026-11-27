// Error reporting in the browser, loaded after the page instead of with it.
//
// The Sentry SDK is about 76 KB compressed. Imported at the top of
// instrumentation-client.ts it was in every visitor's first download and ran
// before hydration, on every page, including when no DSN was configured and
// it could report nothing. Here it is fetched once the page is idle, and
// never without a DSN.
//
// The cost of waiting is the first moments of a page: an error thrown before
// the SDK has arrived would be missed. startErrorReporting() therefore keeps
// the errors the window reports in the meantime and hands them over as soon
// as the SDK is in. Tracing is off (sentryTracesSampleRate is 0), so nothing
// else about a page load depended on the SDK being there from the start.
//
// No static import of the SDK may be added to browser code elsewhere (the
// error boundaries use reportError below): one would put all of it back in
// the first download.
import {
  sentryDataCollection,
  sentryDenyUrls,
  sentryIgnoreErrors,
  sentryTracesSampleRate,
} from "@/lib/sentry-shared";

type Sdk = typeof import("@/lib/sentry-client-sdk");

// Read directly rather than from @/lib/env: that module validates required
// *server* variables, which do not exist in the browser bundle.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

let sdk: Promise<Sdk | null> | null = null;

function loadSdk(): Promise<Sdk | null> {
  if (!dsn) return Promise.resolve(null);
  sdk ??= import("@/lib/sentry-client-sdk")
    .then((module) => {
      // No replay/feedback integrations — session replay records what the
      // user actually saw on screen, which needs its own privacy review
      // (masking KYC upload fields, password inputs, etc.) before it's
      // turned on. Add deliberately later, not as a side effect.
      module.init({
        dsn,
        tracesSampleRate: sentryTracesSampleRate,
        dataCollection: sentryDataCollection,
        // Browser extensions inject scripts into our page, so their crashes
        // arrive here as if they were ours. Dropping by frame origin keeps
        // our own errors reportable even when they look identical — see
        // sentryDenyUrls.
        denyUrls: sentryDenyUrls,
        ignoreErrors: sentryIgnoreErrors,
        // Only populated if Vercel project settings → Environment Variables
        // → "Automatically expose System Environment Variables" is checked;
        // otherwise silently falls back to "development" here (harmless,
        // just less useful filtering in the Sentry dashboard) — same var,
        // same fallback, as sentry.server.config.ts/sentry.edge.config.ts.
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
      });
      return module;
    })
    // A blocked or failed download must never break the page it reports on.
    .catch(() => null);
  return sdk;
}

/** Reports an error an error boundary caught. Safe to call at any time. */
export function reportError(error: unknown) {
  void loadSdk().then((module) => module?.captureException(error));
}

/**
 * Called once from instrumentation-client.ts. Starts the SDK when the browser
 * is idle; until then, remembers what the window reports so nothing thrown in
 * the first moments of the page is lost.
 */
export function startErrorReporting() {
  if (!dsn || typeof window === "undefined") return;

  const early: unknown[] = [];
  const onError = (event: ErrorEvent) => {
    // No error object means a cross-origin script the browser will not
    // describe ("Script error."); there is nothing in it to report.
    if (event.error) early.push(event.error);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    early.push(event.reason);
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const start = () => {
    void loadSdk().then((module) => {
      // From here the SDK's own window handlers are listening.
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      if (module) for (const error of early) module.captureException(error);
      early.length = 0;
    });
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(start, { timeout: 5000 });
  } else {
    // Safari has no requestIdleCallback.
    window.setTimeout(start, 2000);
  }
}
