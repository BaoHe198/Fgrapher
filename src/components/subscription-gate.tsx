import type { Role } from "@prisma/client";
import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function hasUsableSubscription(userId: string, role: Role) {
  const userRole = await db.userRole.findUnique({
    where: { userId_role: { userId, role } },
    include: { subscription: true },
  });
  if (!userRole?.active || !userRole.subscription) return false;

  const { status, graceEndsAt } = userRole.subscription;
  if (status === "ACTIVE" || status === "TRIALING") return true;
  if (status === "PAST_DUE" && graceEndsAt) return graceEndsAt > new Date();
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

  return (
    <Card className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-warning-bg">
        <Lock className="size-5 text-warning" />
      </div>
      <p className="text-body-lg font-semibold! text-text-primary">
        {fallbackTitle ?? `Activate your ${roleT(role)} subscription`}
      </p>
      <p className="max-w-sm text-body-md text-text-secondary">
        {fallbackText ??
          `An active ${roleT(role)} subscription is required to use this feature.`}
      </p>
      <Button
        variant="accent"
        nativeButton={false}
        render={<Link href={`/onboarding/billing?roles=${role}`} />}
      >
        Activate now
      </Button>
    </Card>
  );
}
