import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAID_ROLES, PROVIDER_ROLES } from "@/lib/constants";

import { AccountBasicsForm } from "./account-basics-form";
import { AccountMedia } from "./account-media";
import { AvailabilitySettings } from "./availability-settings";
import { RoleProfileSwitcher } from "./role-profile-switcher";

export default async function ProfileSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
  });
  const providerRoles = session.user.roles.filter((role) =>
    (PAID_ROLES as string[]).includes(role),
  );

  return (
    <div className="flex flex-col gap-6">
      <AccountMedia
        initialAvatar={user.avatar}
        initialCoverImage={user.coverImage}
      />
      <AccountBasicsForm
        initialName={user.name}
        initialUsername={user.username}
        initialWardId={user.wardId}
        // Anyone with a provider role already sets a "Tên hiển thị" per role
        // below (RoleProfileSwitcher, backed by Profile.displayName) —
        // showing a second, account-level name field here would just be the
        // same concept twice. Customers have no Profile at all, so this is
        // their only place to set one (backed by User.name instead).
        showDisplayName={providerRoles.length === 0}
      />

      {providerRoles.length > 0 ? (
        <>
          <div className="h-px bg-border-subtle" />
          <RoleProfileSwitcher roles={providerRoles} />
        </>
      ) : null}

      {session.user.roles.some((role) =>
        (PROVIDER_ROLES as string[]).includes(role),
      ) ? (
        <>
          <div className="h-px bg-border-subtle" />
          <AvailabilitySettings />
        </>
      ) : null}
    </div>
  );
}
