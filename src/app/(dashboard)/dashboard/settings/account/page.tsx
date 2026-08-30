import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import { AccountSettingsForm } from "./account-settings-form";

export default async function AccountSettingsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
  });

  return (
    <AccountSettingsForm
      initialEmail={user.email}
      initialPhone={user.phone}
      initialPhoneVerified={user.phoneVerified}
    />
  );
}
