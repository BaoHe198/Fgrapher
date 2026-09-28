import type { Role } from "@prisma/client";
import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { assignFreePlan } from "@/services/subscription";

// Duplicate of isSubscriptionUsable in src/lib/auth-helpers.ts — kept as
// its own copy since this file already had one before that one existed,
// but fixed in lockstep with it: ACTIVE/TRIALING alone isn't enough,
// currentPeriodEnd must not have passed. Without this, a subscription
// from the local payment rails (MoMo/ZaloPay/bank transfer) or a
// manually assigned plan — neither of which anything ever transitions
// away from ACTIVE on its own — would keep gating content open forever
// past its real expiry.
function isUsable(
  subscription: {
    status: string;
    currentPeriodEnd: Date | null;
    graceEndsAt: Date | null;
  } | null,
) {
  if (!subscription) return false;
  const { status, currentPeriodEnd, graceEndsAt } = subscription;
  if (status === "ACTIVE" || status === "TRIALING") {
    return !currentPeriodEnd || currentPeriodEnd > new Date();
  }
  if (status === "PAST_DUE" && graceEndsAt) return graceEndsAt > new Date();
  return false;
}

async function hasUsableSubscription(userId: string, role: Role) {
  const userRole = await db.userRole.findUnique({
    where: { userId_role: { userId, role } },
    include: { subscription: true },
  });
  if (!userRole?.active) return false;
  if (isUsable(userRole.subscription)) return true;

  // Only self-heals the specific historical gap this was written for: an
  // active role with NO Subscription row at all (activated through
  // /api/users/roles before that route also started granting a free
  // plan, or any other gap of the same shape). A role that HAS a
  // subscription row which is simply expired must NOT silently get a
  // free re-grant here — that would defeat currentPeriodEnd enforcement
  // above via a back door, and now that the local payment rails exist,
  // renewing is what those are for.
  if (
    !userRole.subscription &&
    !features.billingEnabled &&
    features.freeRoleGrantEnabled
  ) {
    await assignFreePlan(userId, [role]);
    return true;
  }

  return false;
}

// Server Component wrapper — gates its children behind an active
// subscription for `role`, showing an upsell card instead when inactive.
export async function SubscriptionGate({
  role,
  children,
  fallbackTitle,
  fallbackText,
}: {
  role: Role;
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackText?: string;
}) {
  const session = await auth();
  const usable = session?.user
    ? await hasUsableSubscription(session.user.id, role)
    : false;

  if (usable) return <>{children}</>;

  const roleT = await getTranslations("role");
  const t = await getTranslations("sharedComponents.subscriptionGate");

  return (
    <Card className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-warning-bg">
        <Lock className="size-5 text-warning" />
      </div>
      <p className="text-body-lg font-semibold! text-text-primary">
        {fallbackTitle ?? t("defaultTitle", { role: roleT(role) })}
      </p>
      <p className="max-w-sm text-body-md text-text-secondary">
        {fallbackText ?? t("defaultText", { role: roleT(role) })}
      </p>
      {/* While billing is off (CLAUDE.md — no VN Stripe merchant account),
          hasUsableSubscription() above self-heals any active-but-
          unsubscribed role — so reaching this fallback in that mode means
          the role genuinely isn't active yet, not that a subscription
          needs activating. Only send them through the real Checkout step
          once billing is actually on; otherwise that's a dead end. */}
      <Button
        variant="accent"
        nativeButton={false}
        render={
          <Link
            href={
              features.billingEnabled
                ? `/onboarding/billing?roles=${role}`
                : "/dashboard/settings/roles"
            }
          />
        }
      >
        {t("cta")}
      </Button>
    </Card>
  );
}
