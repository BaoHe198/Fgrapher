"use client";

import type { Role } from "@prisma/client";
import { useTranslations } from "next-intl";

import { useSharedFilterParams } from "@/components/filters/filter-params-provider";

import { ChipRail } from "./chip-rail";

// Tìm kiếm F's role rail (Core MVP pass, 02/10/2026): "Tất cả" plus the six
// roles as plain 44px chips - no thumbnails, no frame numbers. Styles live
// in the filter sheet.
export function RoleRail({ roles }: { roles: Role[] }) {
  const t = useTranslations("publicPages.browse.v3");
  const railT = useTranslations("publicPages.browse.v3.railRoles");
  const { params, navigate } = useSharedFilterParams();

  const selected = params.get("roles")?.split(",").filter(Boolean) ?? [];
  const current = selected.length === 1 ? selected[0] : "";

  const pick = (role: string) =>
    navigate((next) => {
      if (role) next.set("roles", role);
      else next.delete("roles");
      // A style belongs to a role; switching role drops it.
      next.delete("categories");
      next.delete("page");
    });

  return (
    <ChipRail
      label={t("roleRail")}
      moreLabel={t("moreRoles")}
      value={current}
      onPick={pick}
      items={[
        { value: "", label: t("allRoles") },
        ...roles.map((role) => ({
          value: role,
          label: railT(role as "STUDIO"),
        })),
      ]}
    />
  );
}
