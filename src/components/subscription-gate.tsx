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

function isUsable(
  subscription: {
    status: string;
    graceEndsAt: Date | null;
  } | null,
) {
  if (!subscription) return false;
  const { status, graceEndsAt } = subscription;
  if (status === "ACTIVE" || status === "TRIALING") return true;
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

  // Self-heals accounts that activated a paid role through
  // /api/users/roles before that route also started granting a free
  // plan (or any other gap that leaves an active role with no
  // Subscription row) — while billing is disabled there's no self-serve
  // Checkout to send them through, and no admin step is expected here,
  // so the correct behavior is just to grant the same free plan
  // /api/auth/register already gives every paid role at signup.
  if (!features.billingEnabled) {
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
