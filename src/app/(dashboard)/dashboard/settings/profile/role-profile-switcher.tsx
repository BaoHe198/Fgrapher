"use client";

import type { Role } from "@prisma/client";
import { useState } from "react";

import { Tag } from "@/components/ui/tag";
import { ROLE_LABELS } from "@/lib/constants";

import { ProfileSettingsForm } from "./profile-settings-form";

export function RoleProfileSwitcher({ roles }: { roles: Role[] }) {
  const [active, setActive] = useState(roles[0]);

  return (
    <div className="flex flex-col gap-4">
      {roles.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <Tag key={role} selected={role === active} onClick={() => setActive(role)}>
              {ROLE_LABELS[role]}
            </Tag>
          ))}
        </div>
      ) : null}

      <ProfileSettingsForm key={active} role={active} />
    </div>
  );
}
