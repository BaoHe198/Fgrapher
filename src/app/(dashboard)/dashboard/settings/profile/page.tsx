import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PAID_ROLES } from "@/lib/constants";

import { AccountBasicsForm } from "./account-basics-form";
import { AccountMedia } from "./account-media";
import { RoleProfileSwitcher } from "./role-profile-switcher";

export default async function ProfileSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const providerRoles = session.user.roles.filter((role) =>
    (PAID_ROLES as string[]).includes(role),
  );

  return (
    <div className="flex flex-col gap-6">
      <AccountMedia initialAvatar={user.avatar} initialCoverImage={user.coverImage} />
      <AccountBasicsForm initialUsername={user.username} initialBio={user.bio} />

      {providerRoles.length > 0 ? (
        <>
          <div className="h-px bg-border-subtle" />
          <RoleProfileSwitcher roles={providerRoles} />
        </>
      ) : null}
    </div>
  );
}
