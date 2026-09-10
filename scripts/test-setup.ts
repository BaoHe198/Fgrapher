// Loaded before every test file (see the `test` script in package.json).
//
// src/lib/env.ts validates the required server env vars at import time and
// throws if they're missing, so any test that transitively imports it —
// which is most of the service layer — would fail to load at all without
// this. These are placeholders, never connected to: the unit tests inject
// their own stores rather than talking to a database.
//
// Real values are never overwritten (`??=`), so running the suite with a
// populated .env behaves identically.
// Cast: @types/node types NODE_ENV as read-only, but the test runner has
// to be able to set it before any module reads it.
const mutableEnv = process.env as Record<string, string | undefined>;
mutableEnv.NODE_ENV ??= "test";
mutableEnv.APP_ENV ??= "development";
mutableEnv.DATABASE_URL ??=
  "postgresql://test:test@localhost:5432/fgrapher_test";
mutableEnv.DIRECT_URL ??= "postgresql://test:test@localhost:5432/fgrapher_test";
mutableEnv.NEXTAUTH_SECRET ??= "test-secret-at-least-32-characters-long";

// Deliberately left unset: RESEND_API_KEY, CLOUDINARY_*, STRIPE_* and the
// rest are optional by design (the app no-ops without them), and a test
// run must never be able to send a real email or charge a real card.
