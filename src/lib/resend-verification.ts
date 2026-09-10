// Shared logic for the "resend verification link" form, which renders in
// two places (the /verify-email page and the login page's unverified
// prompt). Kept out of the component so the two rules that actually decide
// whether the action is usable are unit-testable: an earlier draft hid the
// email field in the compact layout while still disabling the button on an
// empty address, which made the login prompt impossible to submit.

import {
  type BillingInterval,
  parseBillingInterval,
} from "@/lib/onboarding-destination";

export type ResendStatus = "idle" | "sending" | "sent" | "error";

/**
 * Whether the resend button should be clickable.
 *
 * The form MUST always give the user a way to supply an address — there is
 * no layout in which the field is hidden — or this returns false forever
 * and the button is dead.
 */
export function canSubmitResend({
  status,
  email,
}: {
  status: ResendStatus;
  email: string;
}): boolean {
  if (status === "sending" || status === "sent") return false;
  return email.trim().length > 0;
}

// Where the login form parks what it knows about the attempt, so the
// unverified prompt can offer it back. NextAuth's redirect drops the
// query string, so the billing period rides along here too — otherwise a
// year-plan signup resending from the login page silently gets a monthly
// link.
const PENDING_EMAIL_KEY = "fg:pending-verification-email";
const PENDING_INTERVAL_KEY = "fg:pending-verification-interval";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function safeStorage(): StorageLike | null {
  try {
    // Absent during SSR; throws outright in browsers configured to block
    // site data.
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Remembers the address a sign-in was attempted with.
 *
 * sessionStorage, deliberately, not the URL: NextAuth redirects on a failed
 * sign-in, so component state is gone by the time the prompt renders, and
 * putting an email address in a query string would write it into browser
 * history and any referrer the page leaks. This stays in the tab, is never
 * transmitted, and dies with the tab.
 */
export function rememberAttemptedEmail(
  email: string,
  interval?: BillingInterval,
  storage: StorageLike | null = safeStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(PENDING_EMAIL_KEY, email);
    if (interval) storage.setItem(PENDING_INTERVAL_KEY, interval);
  } catch {
    // Storage full or blocked — the prompt just asks for the address.
  }
}

/**
 * Reads the remembered address and clears it in the same breath.
 *
 * Always clearing, even when the caller doesn't want the value, is the
 * point: a successful sign-in also leaves an entry behind, and this way the
 * very next render of the login page purges it rather than letting it sit
 * in the tab.
 */
export function takeAttemptedSignIn(
  storage: StorageLike | null = safeStorage(),
): { email: string; interval: BillingInterval } {
  const empty = { email: "", interval: "month" as const };
  if (!storage) return empty;
  try {
    const email = storage.getItem(PENDING_EMAIL_KEY) ?? "";
    const interval = parseBillingInterval(
      storage.getItem(PENDING_INTERVAL_KEY),
    );
    storage.removeItem(PENDING_EMAIL_KEY);
    storage.removeItem(PENDING_INTERVAL_KEY);
    return { email, interval };
  } catch {
    return empty;
  }
}
