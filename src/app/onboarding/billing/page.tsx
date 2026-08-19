import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { PAID_ROLES } from "@/lib/constants";
import type { Role } from "@prisma/client";

import { BillingOnboardingContent } from "./billing-onboarding-content";

export default async function OnboardingBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ roles?: string; checkout?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { roles: rolesParam, checkout } = await searchParams;
  const roles = (rolesParam?.split(",") ?? []).filter((r): r is Role =>
    (PAID_ROLES as string[]).includes(r),
  );

  if (roles.length === 0) {
    redirect("/dashboard");
  }

  return <BillingOnboardingContent roles={roles} cancelled={checkout === "cancelled"} />;
}
