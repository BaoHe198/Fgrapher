import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { RolesSettings } from "./roles-settings";

export default async function RolesSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <RolesSettings currentRoles={session.user.roles} />;
}
