import type { BillingInterval } from "@/lib/onboarding-destination";

// The two URLs the email-verification flow builds, as pure functions so the
// chain from signup through the emailed link to the post-login destination
// can be exercised end to end without a database or an HTTP server.

/**
 * App-relative path for the link in a verification email.
 *
 * The billing period travels here because it is a UI choice made before
 * signup that never reaches the database, and the link is the only thing
 * that survives the trip through an inbox — including onto another device,
 * where nothing in browser storage would.
 *
 * Omitted when it is the default, so an ordinary customer signup doesn't
 * carry a meaningless parameter; the reader falls back to "month" anyway.
 */
export function buildVerificationPath({
  rawToken,
  interval,
}: {
  rawToken: string;
  interval?: BillingInterval;
}): string {
  const query = new URLSearchParams({ token: rawToken });
  if (interval === "year") query.set("interval", interval);
  return `/verify-email?${query.toString()}`;
}

/**
 * Where the "sign in" button on a successful verification points.
 *
 * `next` must already have been checked with isSafeInternalPath — it ends
 * up as a callbackUrl, and a callbackUrl that isn't internal is an open
 * redirect. Encoded so its own query string survives being nested inside
 * one.
 */
export function buildLoginCallbackPath(next: string | null): string {
  if (!next) return "/login";
  return `/login?callbackUrl=${encodeURIComponent(next)}`;
}
