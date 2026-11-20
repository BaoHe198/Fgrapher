import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

// No index content of its own — the settings layout already shows every
// tab. Lands on the first tab this account has: Account for anyone with a
// provider or shop role (their profile lives in "Trang của tôi"), Profile
// for a customer.
export default async function DashboardSettingsIndex() {
  const session = await auth();
  const hasPlan = session?.user.roles.some(
    (role) => role !== "CUSTOMER" && role !== "ADMIN",
  );
  redirect(
    hasPlan ? "/dashboard/settings/account" : "/dashboard/settings/profile",
  );
}
