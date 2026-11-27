import { adminSessionForPage } from "@/lib/admin";
import { asApiJson } from "@/lib/auth-helpers";
import { listDataRequests } from "@/services/admin";

import {
  AdminComplianceClient,
  type DataRequestRow,
} from "./compliance-client";

// The tab the screen opens on (data requests, unfiltered) is read here, with
// the page (27/11/2026), instead of by GET /api/admin/data-requests after it
// has loaded. Same gate (requireAdmin) and same reader (listDataRequests) as
// that route. The audit-log and consent tabs still load when opened.
export default async function AdminCompliancePage() {
  if (!(await adminSessionForPage())) return null;

  const { requests } = await listDataRequests({});

  return (
    <AdminComplianceClient
      initialRequests={asApiJson<DataRequestRow[]>(requests)}
    />
  );
}
