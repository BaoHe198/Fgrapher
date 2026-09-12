import { z } from "zod";

// Env vars are always strings — z.coerce.boolean() is a common trap here
// because it treats ANY non-empty string as true, including the literal
// text "false". This only ever accepts the exact strings "true"/"false"
// (defaulting to false when unset), so a typo'd value fails the build
// loudly instead of silently turning a flag on.
const booleanFlag = (defaultValue: "true" | "false") =>
  z
    .enum(["true", "false"])
    .default(defaultValue)
    .transform((v) => v === "true");

// Either a bare address (`noreply@fgrapher.com`) or RFC 5322's display-name
// form (`Fgrapher <noreply@fgrapher.com>`) — both are valid values for an
// SMTP/Resend "from" header. See EMAIL_FROM below for why this can't just
// be z.string().email().
const EMAIL_FROM_PATTERN =
  /^(?:[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+|[^<>]*<\s*[^<>@\s]+@[^<>@\s]+\.[^<>@\s]+\s*>)$/;

// Fails loudly at build/startup time rather than silently at request time.
//
// Required vs optional here matches how the rest of the app already
// behaves, not an arbitrary line: DATABASE_URL/DIRECT_URL/NEXTAUTH_* are
// required because nothing works without them. Every third-party
// integration (Google OAuth, Cloudinary, Stripe, Resend) is optional here
// because the app already no-ops gracefully without each of them — see
// docs/ARCHITECTURE.md §7. Making them required here would break that
// documented, deliberate behavior for local dev without those credentials.
const serverSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  APP_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
  // 32 chars is the minimum NextAuth/Auth.js itself recommends (`openssl
  // rand -base64 32`) — a non-empty-but-weak value like "secret" would
  // otherwise pass, and a low-entropy JWT signing secret is directly
  // brute-forceable.
  NEXTAUTH_SECRET: z
    .string()
    .min(32, "NEXTAUTH_SECRET must be at least 32 characters"),
  // Deliberately optional, unlike the other three: on Vercel Preview this
  // is meant to be left unset (see docs/ENVIRONMENTS.md) so NextAuth
  // infers the URL per-deployment from VERCEL_URL, since every Preview
  // build gets its own unique URL that can't be hardcoded in one env var.
  NEXTAUTH_URL: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Dynamic STRIPE_PRICE_<ROLE>_MONTHLY/YEARLY pairs (see
  // lib/constants/plans.ts) aren't declared individually here — they're
  // read via bracket notation per-role and are already optional at every
  // call site (priceIdForRole returns undefined, handled by callers).

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),

  // Automated moderation-queue sorting (lib/openai-moderation.ts). Used
  // for nothing else — this is not a general-purpose LLM key, and no
  // other code path should start using it as one without the project
  // owner deciding that separately. The Moderation endpoint is free and
  // exempt from usage limits.
  OPENAI_API_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  // NOT a bare z.string().email(): the documented Resend "from" format —
  // and this app's own fallback — is the display-name form
  // `Fgrapher <noreply@fgrapher.com>`, which z.email() rejects. Requiring
  // a bare address here meant that setting EMAIL_FROM to the value the
  // docs tell you to use threw out of parseEnv() at import time and 500'd
  // every request in the app. Accept either shape.
  EMAIL_FROM: z
    .string()
    .refine(
      (value) => EMAIL_FROM_PATTERN.test(value.trim()),
      "EMAIL_FROM must be an email address or `Name <email@example.com>`",
    )
    .optional(),
  // Bare address only — it's used as a recipient (`to`), not a `from`.
  SUPPORT_EMAIL: z.string().email().optional(),
  CRON_SECRET: z.string().optional(),

  // MoMo Payment Gateway — src/lib/momo.ts no-ops without these, same
  // pattern as every other integration above.
  MOMO_PARTNER_CODE: z.string().optional(),
  MOMO_ACCESS_KEY: z.string().optional(),
  MOMO_SECRET_KEY: z.string().optional(),

  // ZaloPay — src/lib/zalopay.ts. key1 signs outgoing requests, key2
  // verifies incoming callbacks — see that file's comment for why mixing
  // them up is a real, easy-to-make security bug.
  ZALOPAY_APP_ID: z.string().optional(),
  ZALOPAY_KEY1: z.string().optional(),
  ZALOPAY_KEY2: z.string().optional(),
  // Staging-only — see lib/email.ts's sendEmail(). Every outbound email
  // is redirected here instead of the real recipient when APP_ENV is
  // "staging" and this is set.
  STAGING_TEST_INBOX: z.string().email().optional(),

  // Feature flags — see lib/features.ts and docs/MVP_SCOPE.md. All
  // default OFF: Stripe can't take a Vietnam-registered merchant
  // account (CLAUDE.md's "Ràng buộc bắt buộc" #1), and marketplace/
  // social feed are out of MVP scope, per
  // docs/guides/fgrapher-danh-gia-va-prompt-sua-doi.md.
  BILLING_ENABLED: booleanFlag("false"),
  MARKETPLACE_ENABLED: booleanFlag("false"),
  SOCIAL_FEED_ENABLED: booleanFlag("false"),
  // Defaults ON (the anti-fake-request gate from Prompt G7 stays in
  // force by default) — set to "false" only while Twilio isn't
  // configured/paid for yet, per the project owner's explicit call to
  // temporarily let service requests post without a verified phone.
  PHONE_VERIFICATION_REQUIRED: booleanFlag("true"),
  // Local Vietnamese payment rails for provider subscription billing —
  // independent of BILLING_ENABLED (Stripe-specific, stays off
  // permanently per CLAUDE.md rule 1). Flip on only once the business is
  // ready to actually charge — see src/services/payments.ts.
  MOMO_ENABLED: booleanFlag("false"),
  ZALOPAY_ENABLED: booleanFlag("false"),
  BANK_TRANSFER_ENABLED: booleanFlag("false"),
  // Default true — preserves today's exact behavior (every paid-role
  // signup gets a free 12-month plan while Stripe is off). Deliberately
  // its OWN switch, not derived from MOMO_ENABLED/ZALOPAY_ENABLED/
  // BANK_TRANSFER_ENABLED — turning one of those on means a local rail
  // CAN take a real payment, not that free registration should silently
  // stop. Whether it should is a business decision for the project
  // owner to make explicitly by flipping this to "false" when ready, not
  // an automatic side effect of enabling a payment method. See
  // src/lib/features.ts's freeRoleGrantEnabled comment.
  FREE_ROLE_GRANT_ENABLED: booleanFlag("true"),
  // Automated moderation-queue sorting. Defaults OFF: turning it on sends
  // a downscaled copy of every portfolio image to OpenAI (US), which is a
  // personal-data transfer decision for the project owner to make
  // deliberately, not a default — see docs/ops/content-moderation.md.
  // Off (or without OPENAI_API_KEY) every upload still reaches the same
  // human queue in the same order it always did — the scan only sorts
  // that queue, so this gates an optimisation, never the feature itself.
  CONTENT_MODERATION_ENABLED: booleanFlag("false"),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  // Zalo Official Account ID for the profile share menu's Zalo widget
  // (Prompt F7, VIỆC 4) — read directly via process.env in
  // profile-actions.tsx (same reason NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is,
  // per lib/cloudinary.ts's comment: needs to work from a Client
  // Component). Unset in this environment; see that file's comment.
  NEXT_PUBLIC_ZALO_OA_ID: z.string().optional(),
  // Read directly via process.env in sentry.server.config.ts/sentry.edge.
  // config.ts/instrumentation-client.ts (not `env.NEXT_PUBLIC_SENTRY_DSN`
  // from this module) — instrumentation-client.ts runs in the browser
  // bundle, where importing this file would crash: parseEnv() below
  // validates the *required* server vars too (DATABASE_URL etc.), which
  // don't exist in client process.env. Declared here anyway so it's
  // documented/validated for any server-side code that does want to check
  // it, and so .env.example stays the single source of truth for every
  // var the app reads.
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  // Not secrets — shown directly to any customer paying by bank
  // transfer, same reasoning as NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME. Read
  // via src/lib/bank-transfer.ts.
  NEXT_PUBLIC_BANK_TRANSFER_ACCOUNT_NUMBER: z.string().optional(),
  NEXT_PUBLIC_BANK_TRANSFER_ACCOUNT_NAME: z.string().optional(),
  NEXT_PUBLIC_BANK_TRANSFER_BANK_NAME: z.string().optional(),
});

const fullSchema = serverSchema.merge(publicSchema);

function parseEnv() {
  const result = fullSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(
      `Invalid/missing environment variables:\n${missing.join("\n")}\n\n` +
        "Check .env.example for what each variable is and where to get it.",
    );
  }
  return result.data;
}

export const env = parseEnv();
