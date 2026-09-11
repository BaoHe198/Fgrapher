import * as Sentry from "@sentry/nextjs";

import {
  sentryDataCollection,
  sentryIgnoreErrors,
  sentryTracesSampleRate,
} from "@/lib/sentry-shared";

// Covers the edge runtime (proxy.ts and any route handler opted into
// `export const runtime = "edge"`, currently none — see next.config.ts's
// grep confirming zero explicit runtime overrides today). Empty/unset DSN
// makes Sentry.init() a silent no-op, same as sentry.server.config.ts.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: sentryTracesSampleRate,
  dataCollection: sentryDataCollection,
  // Client-disconnect noise from streamed SSR responses — see
  // sentryIgnoreErrors for why, and for what it costs to hide it.
  ignoreErrors: sentryIgnoreErrors,
  environment: process.env.VERCEL_ENV ?? "development",
});
