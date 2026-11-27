import { adminSessionForPage } from "@/lib/admin";
import { asApiJson } from "@/lib/auth-helpers";
import { listAdminUsers } from "@/services/admin";

import { AdminUsersClient, type AdminUserRow } from "./users-client";

// The first page of users is read here, with the page (27/11/2026). The
// screen used to render empty and ask GET /api/admin/users after loading.
// Same gate (requireAdmin) and same reader (listAdminUsers) as that route.
export default async function AdminUsersPage() {
  if (!(await adminSessionForPage())) return null;

  const { users } = await listAdminUsers({});

  return <AdminUsersClient initialUsers={asApiJson<AdminUserRow[]>(users)} />;
}
