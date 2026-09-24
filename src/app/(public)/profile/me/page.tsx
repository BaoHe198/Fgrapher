import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// "Xem hồ sơ công khai" from the account menu. The session doesn't carry the
// username, so this resolves it and forwards to /profile/<username>. "me"
// can never be a username: they must be at least 3 characters long.
export default async function MyPublicProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/profile/me");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  });
  // No username yet: the settings page is where one is chosen.
  if (!user?.username) {
    redirect("/dashboard/settings/profile");
  }
  redirect(`/profile/${user.username}`);
}
