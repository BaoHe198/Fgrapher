import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { PAID_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { getPendingRoleChangeRequest } from "@/services/role-change-requests";

import { RolesSettings } from "./roles-settings";

export default async function RolesSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [verifications, pendingRoleChangeRequest] = await Promise.all([
    db.userRole.findMany({
      where: { userId: session.user.id, role: { in: PAID_ROLES } },
      select: {
        role: true,
        verificationStatus: true,
        verificationRejectedReason: true,
      },
    }),
    getPendingRoleChangeRequest(session.user.id),
  ]);

  return (
    <RolesSettings
      currentRoles={session.user.roles}
      verifications={verifications}
      marketplaceEnabled={features.marketplaceEnabled}
      pendingRoleChangeRequest={
        pendingRoleChangeRequest
          ? {
              id: pendingRoleChangeRequest.id,
              fromRole: pendingRoleChangeRequest.fromRole,
              toRole: pendingRoleChangeRequest.toRole,
            }
          : null
      }
    />
  );
}
