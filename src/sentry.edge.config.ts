import * as Sentry from "@sentry/nextjs";

import {
  sentryDataCollection,
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
});
