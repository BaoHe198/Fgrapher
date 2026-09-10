import { PAID_ROLES } from "@/lib/constants";
import type { Role } from "@prisma/client";

// Where a freshly-authenticated account should land.
//
// Registration used to compute this inline and hand it to signIn() as a
// callbackUrl. Email verification broke that: registration no longer signs
// anyone in, so the destination was built, discarded, and the user landed
// on /dashboard — with a paid role still inactive and no prompt to pay.
//
// It was never durable anyway. Anyone who closed the billing page and
// signed in again later hit exactly the same dead end, because the
// destination only ever existed in one navigation. So this derives it from
// the account's own state instead of carrying it.

export type BillingInterval = "month" | "year";

export function parseBillingInterval(value: unknown): BillingInterval {
  return value === "year" ? "year" : "month";
}

/**
 * Paid roles the account holds but hasn't activated — i.e. roles still
 * waiting on checkout.
 */
export function pendingPaidRoles(
  roles: ReadonlyArray<{ role: Role; active: boolean }>,
): Role[] {
  return roles
    .filter(
      (r) => !r.active && (PAID_ROLES as readonly string[]).includes(r.role),
    )
    .map((r) => r.role);
}

/**
 * The onboarding step this account still owes, as an app-relative path.
 *
 * Returns /dashboard when billing is disabled — today's configuration, and
 * permanently so for Stripe (CLAUDE.md constraint 1) — because
 * /api/auth/register already granted a free plan for every paid role, so
 * there is nothing left to collect. That makes this a no-op in the current
 * setup and a working path the moment billing is switched on.
 */
export function buildOnboardingDestination({
  billingEnabled,
  pendingRoles,
  interval,
}: {
  billingEnabled: boolean;
  pendingRoles: ReadonlyArray<Role>;
  interval: BillingInterval;
}): string {
  if (!billingEnabled || pendingRoles.length === 0) return "/dashboard";

  const params = new URLSearchParams({
    roles: pendingRoles.join(","),
    interval,
  });
  return `/onboarding/billing?${params.toString()}`;
}

/**
 * Whether a path is safe to hand to signIn() as a callbackUrl.
 *
 * These paths are generated server-side, so this isn't guarding against a
 * hostile value today — it's making sure a future change can't turn the
 * field into an open redirect without tripping over this. `//evil.com` and
 * `/\evil.com` are protocol-relative URLs that browsers follow off-site
 * despite starting with a slash. NextAuth's own redirect callback enforces
 * same-origin as well; this is the belt to that's braces.
 */
export function isSafeInternalPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//") || path.startsWith("/\\")) return false;
  // Control characters — a raw tab or newline especially — can smuggle a
  // scheme past naive checks, because browsers strip them before parsing.
  if (/[\u0000-\u001f\u007f]/.test(path)) return false;
  return true;
}
