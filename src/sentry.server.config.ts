import * as Sentry from "@sentry/nextjs";

import {
  sentryDataCollection,
  sentryIgnoreErrors,
  sentryTracesSampleRate,
} from "@/lib/sentry-shared";

// Empty/unset DSN makes Sentry.init() a silent no-op — same pattern this
// codebase already uses for Stripe/Cloudinary/Twilio/Resend (see
// .env.example's Sentry section).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: sentryTracesSampleRate,
  dataCollection: sentryDataCollection,
  // Client-disconnect noise from streamed SSR responses — see
  // sentryIgnoreErrors for why, and for what it costs to hide it.
  ignoreErrors: sentryIgnoreErrors,
  // Vercel sets this automatically per deployment ("production" |
  // "preview" | "development") — no env var to configure ourselves.
  // Lets Sentry's dashboard filter production errors out from Preview's
  // (which reuses the dev database — see CLAUDE.md) noise.
  environment: process.env.VERCEL_ENV ?? "development",
});
