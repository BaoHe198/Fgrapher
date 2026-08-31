import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { PAID_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

import { RolesSettings } from "./roles-settings";

export default async function RolesSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const verifications = await db.userRole.findMany({
    where: { userId: session.user.id, role: { in: PAID_ROLES } },
    select: {
      role: true,
      verificationStatus: true,
      verificationRejectedReason: true,
    },
  });

  return (
    <RolesSettings
      currentRoles={session.user.roles}
      verifications={verifications}
      marketplaceEnabled={features.marketplaceEnabled}
    />
  );
}
