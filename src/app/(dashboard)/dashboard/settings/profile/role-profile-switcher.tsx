"use client";

import type { Role } from "@prisma/client";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Tag } from "@/components/ui/tag";

import { ProfileSettingsForm } from "./profile-settings-form";

export function RoleProfileSwitcher({ roles }: { roles: Role[] }) {
  const roleT = useTranslations("role");
  const [active, setActive] = useState(roles[0]);

  return (
    <div className="flex flex-col gap-4">
      {roles.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <Tag
              key={role}
              selected={role === active}
              onClick={() => setActive(role)}
            >
              {roleT(role)}
            </Tag>
          ))}
        </div>
      ) : null}

      <ProfileSettingsForm key={active} role={active} />
    </div>
  );
}
