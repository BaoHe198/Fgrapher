import { redirect } from "next/navigation";

export default function DashboardProfileRedirect() {
  redirect("/dashboard/settings/profile");
}
