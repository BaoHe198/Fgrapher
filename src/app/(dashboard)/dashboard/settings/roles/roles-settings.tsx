"use client";

import type { Role } from "@prisma/client";
import {
  Camera,
  Palette,
  ShoppingBag,
  User,
  Video,
  Building2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PAID_ROLES, ROLE_LABELS, ROLE_MONTHLY_PRICE } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

const ROLE_ICONS: Record<Role, LucideIcon> = {
  PHOTOGRAPHER: Camera,
  VIDEOGRAPHER: Video,
  MAKEUP_ARTIST: Palette,
  STUDIO: Building2,
  CAMERA_SHOP: ShoppingBag,
  CUSTOMER: User,
};

export function RolesSettings({ currentRoles }: { currentRoles: Role[] }) {
  const activeRoles = currentRoles.filter((r) => r !== "CUSTOMER");
  const availableRoles = PAID_ROLES.filter((r) => !currentRoles.includes(r));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          Your roles
        </span>

        <Card className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="size-5 text-text-tertiary" />
            <div>
              <p className="text-body-md font-semibold text-text-primary">Customer</p>
              <p className="text-body-sm text-text-secondary">Always free</p>
            </div>
          </div>
          <Badge variant="success">Active</Badge>
        </Card>

        {activeRoles.map((role) => {
          const Icon = ROLE_ICONS[role];
          return (
            <Card key={role} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon className="size-5 text-text-tertiary" />
                <div>
                  <p className="text-body-md font-semibold text-text-primary">
                    {ROLE_LABELS[role]}
                  </p>
                  <p className="text-body-sm text-text-secondary">
                    {formatCurrency(ROLE_MONTHLY_PRICE[role] ?? 0, "USD")}/mo
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success">Active</Badge>
                <Button
                  size="sm"
                  variant="secondary"
                  nativeButton={false}
                  render={<a href="/dashboard/settings/billing" />}
                >
                  Manage
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {availableRoles.length > 0 ? (
        <div className="flex flex-col gap-3">
          <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
            Add a role
          </span>
          {availableRoles.map((role) => {
            const Icon = ROLE_ICONS[role];
            return (
              <Card key={role} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="size-5 text-text-tertiary" />
                  <div>
                    <p className="text-body-md font-semibold text-text-primary">
                      {ROLE_LABELS[role]}
                    </p>
                    <p className="text-body-sm text-text-secondary">
                      {formatCurrency(ROLE_MONTHLY_PRICE[role] ?? 0, "USD")}/mo
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="accent"
                  nativeButton={false}
                  render={<Link href={`/onboarding/billing?roles=${role}`} />}
                >
                  Activate
                </Button>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
