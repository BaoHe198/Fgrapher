import { adminSessionForPage } from "@/lib/admin";
import { asApiJson } from "@/lib/auth-helpers";
import { listReports } from "@/services/admin";

import { AdminReportsClient, type ReportRow } from "./reports-client";

// The tab the screen opens on ("pending") is read here, with the page
// (27/11/2026), instead of by GET /api/admin/reports?status=PENDING after it
// has loaded. Same gate (requireAdmin) and same reader (listReports) as that
// route; the other tabs still load when chosen.
export default async function AdminReportsPage() {
  if (!(await adminSessionForPage())) return null;

  const { reports } = await listReports({ status: "PENDING" });

  return (
    <AdminReportsClient initialReports={asApiJson<ReportRow[]>(reports)} />
  );
}
