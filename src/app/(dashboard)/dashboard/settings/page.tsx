import { redirect } from "next/navigation";

// No index content of its own — the shared settings layout (layout.tsx)
// already renders SettingsNav's full tab list on every settings page, so
// a distinct landing page here would just duplicate that. Redirects to
// the first tab, matching how tab-based settings UIs elsewhere land.
export default function DashboardSettingsIndex() {
  redirect("/dashboard/settings/profile");
}
