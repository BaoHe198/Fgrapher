// Feature flags for functionality that's out of MVP scope but not
// removed from the codebase — see docs/MVP_SCOPE.md and
// docs/guides/fgrapher-danh-gia-va-prompt-sua-doi.md for why. Values
// come from src/lib/env.ts (already validated/typed there), not read
// from process.env directly here, so a typo'd env var fails the build
// the same way a missing required var does rather than silently
// defaulting.
import { env } from "@/lib/env";

export const features = {
  // Stripe can't take a merchant account for a Vietnam-registered
  // business — see CLAUDE.md's "Ràng buộc bắt buộc" #1. Plans are
  // assigned manually via /admin/users/[id] while this is false.
  billingEnabled: env.BILLING_ENABLED,
  // Whether a new paid-role signup gets a free plan immediately
  // (assignFreePlan) instead of being required to pay. Read this
  // together with billingEnabled at every call site (registration,
  // adding a role, the subscription-gate self-heal, a role-change-
  // request approval — see FREE_ROLE_GRANT_ENABLED's comment in env.ts
  // for why): free-granting was previously an implicit side effect of
  // "Stripe is off," which stopped meaning what it used to the moment
  // local payment rails (momoEnabled/zalopayEnabled/bankTransferEnabled)
  // existed as a real, independent way to actually charge someone. This
  // makes that a deliberate, separately-named policy switch instead —
  // defaults to true, i.e. today's exact behavior, unchanged, until the
  // project owner explicitly decides otherwise.
  freeRoleGrantEnabled: env.FREE_ROLE_GRANT_ENABLED,
  // Product/Order/Cart/checkout and the CAMERA_SHOP role.
  marketplaceEnabled: env.MARKETPLACE_ENABLED,
  // Post/Like/Comment/Follow.
  socialFeedEnabled: env.SOCIAL_FEED_ENABLED,
  // Requires Twilio Verify (paid beyond trial-verified numbers) — off
  // temporarily disables the phone-verification gate on posting a
  // ServiceRequest while that isn't set up.
  phoneVerificationRequired: env.PHONE_VERIFICATION_REQUIRED,
  // Local Vietnamese payment rails for provider subscription billing —
  // independent of billingEnabled (which is Stripe-specific and stays
  // permanently off per CLAUDE.md rule 1). Each defaults off; flip on
  // only once the business is actually ready to charge — see
  // src/services/payments.ts.
  momoEnabled: env.MOMO_ENABLED,
  zalopayEnabled: env.ZALOPAY_ENABLED,
  bankTransferEnabled: env.BANK_TRANSFER_ENABLED,
} as const;
