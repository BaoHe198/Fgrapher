import * as Sentry from "@sentry/nextjs";

import {
  sentryDataCollection,
  sentryTracesSampleRate,
} from "@/lib/sentry-shared";

// Next.js file convention (src/instrumentation-client.ts, v15.3+) — runs
// in the browser before hydration. Reads process.env.NEXT_PUBLIC_SENTRY_DSN
// directly rather than importing from @/lib/env: that module's parseEnv()
// validates required *server* vars (DATABASE_URL etc.) against
// process.env too, which don't exist in the browser bundle and would
// throw here. Empty/unset DSN makes Sentry.init() a silent no-op.
//
// No replay/feedback integrations — session replay records what the user
// actually saw on screen, which needs its own privacy review (masking
// KYC upload fields, password inputs, etc.) before it's turned on. Add
// deliberately later, not as a side effect of this pass.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: sentryTracesSampleRate,
  dataCollection: sentryDataCollection,
  // Only populated if Vercel project settings → Environment Variables →
  // "Automatically expose System Environment Variables" is checked;
  // otherwise silently falls back to "development" here (harmless, just
  // less useful filtering in the Sentry dashboard) — same var, same
  // fallback, as sentry.server.config.ts/sentry.edge.config.ts.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
});
