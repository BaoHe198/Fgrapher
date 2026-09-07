import * as Sentry from "@sentry/nextjs";

import {
  sentryDataCollection,
  sentryTracesSampleRate,
} from "@/lib/sentry-shared";

// Empty/unset DSN makes Sentry.init() a silent no-op — same pattern this
// codebase already uses for Stripe/Cloudinary/Twilio/Resend (see
// .env.example's Sentry section).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: sentryTracesSampleRate,
  dataCollection: sentryDataCollection,
  // Vercel sets this automatically per deployment ("production" |
  // "preview" | "development") — no env var to configure ourselves.
  // Lets Sentry's dashboard filter production errors out from Preview's
  // (which reuses the dev database — see CLAUDE.md) noise.
  environment: process.env.VERCEL_ENV ?? "development",
});
