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
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
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

  RESEND_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
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
