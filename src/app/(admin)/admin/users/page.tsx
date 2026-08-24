"use client";

import type { Role, User, UserRole } from "@prisma/client";
import { Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDate } from "@/lib/format";

type AdminUserRow = User & { roles: Pick<UserRole, "role">[] };

export default function AdminUsersPage() {
  const t = useTranslations("accountFlows.admin.users");
  const roleT = useTranslations("role");
  const ROLE_OPTIONS = [
    { value: "", label: t("allRoles") },
    ...(
      [
        "PHOTOGRAPHER",
        "VIDEOGRAPHER",
        "MAKEUP_ARTIST",
        "STUDIO",
        "CAMERA_SHOP",
        "CUSTOMER",
        "ADMIN",
      ] as Role[]
    ).map((r) => ({ value: r, label: roleT(r) })),
  ];
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    startTransition(() => setIsLoading(true));
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (role) params.set("role", role);
    const timeout = setTimeout(() => {
      fetch(`/api/admin/users?${params.toString()}`)
        .then((res) => res.json())
        .then((body) => {
          startTransition(() => {
            setUsers(body.data ?? []);
            setIsLoading(false);
          });
        });
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, role]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display-md text-text-primary">{t("title")}</h1>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <NativeSelect
          value={role}
          onChange={setRole}
          options={ROLE_OPTIONS}
          className="w-48"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-text-tertiary" />
        </div>
      ) : (
        <Card padding={false} className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-body-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-text-tertiary">
                <th className="px-5 py-3">{t("table.name")}</th>
                <th className="px-3 py-3">{t("table.email")}</th>
                <th className="px-3 py-3">{t("table.roles")}</th>
                <th className="px-3 py-3">{t("table.joined")}</th>
                <th className="px-3 py-3">{t("table.status")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-border-subtle last:border-b-0 hover:bg-bg-sunken"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/users/${user.id}`}
                      className="font-semibold text-text-primary"
                    >
                      {user.firstName ?? user.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {user.email}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {user.roles.map((r) => roleT(r.role)).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-3 py-3">
                    {user.isSuspended ? (
                      <Badge variant="destructive">
                        {t("statusSuspended")}
                      </Badge>
                    ) : user.isVerified ? (
                      <Badge variant="success">{t("statusVerified")}</Badge>
                    ) : (
                      <Badge variant="neutral">{t("statusActive")}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 ? (
            <p className="px-5 py-8 text-center text-body-sm text-text-secondary">
              {t("empty")}
            </p>
          ) : null}
        </Card>
      )}
    </div>
  );
}
