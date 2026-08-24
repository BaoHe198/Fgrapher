"use client";

import type { Role, VerificationStatus } from "@prisma/client";
import {
  Camera,
  Palette,
  ShoppingBag,
  Sparkles,
  User,
  Video,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PAID_ROLES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

interface VerificationInfo {
  role: Role;
  verificationStatus: VerificationStatus;
  verificationRejectedReason: string | null;
}

const VERIFICATION_BADGE: Record<
  VerificationStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "neutral" }
> = {
  UNVERIFIED: { label: "Not verified", variant: "neutral" },
  PENDING: { label: "Verification pending", variant: "warning" },
  VERIFIED: { label: "Verified", variant: "success" },
  REJECTED: { label: "Verification rejected", variant: "destructive" },
};

const ROLE_ICONS: Record<Role, LucideIcon> = {
  PHOTOGRAPHER: Camera,
  VIDEOGRAPHER: Video,
  MAKEUP_ARTIST: Palette,
  STUDIO: Building2,
  CAMERA_SHOP: ShoppingBag,
  MODEL: Sparkles,
  CUSTOMER: User,
  ADMIN: User,
};

export function RolesSettings({
  currentRoles,
  rolePrices,
  verifications,
}: {
  currentRoles: Role[];
  rolePrices: Partial<Record<Role, number>>;
  verifications: VerificationInfo[];
}) {
  const roleT = useTranslations("role");
  const activeRoles = currentRoles.filter((r) => r !== "CUSTOMER");
  const availableRoles = PAID_ROLES.filter((r) => !currentRoles.includes(r));
  const verificationByRole = new Map(verifications.map((v) => [v.role, v]));

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
              <p className="text-body-md font-semibold text-text-primary">
                Customer
              </p>
              <p className="text-body-sm text-text-secondary">Always free</p>
            </div>
          </div>
          <Badge variant="success">Active</Badge>
        </Card>

        {activeRoles.map((role) => {
          const Icon = ROLE_ICONS[role];
          const verification = verificationByRole.get(role);
          const verificationBadge = verification
            ? VERIFICATION_BADGE[verification.verificationStatus]
            : null;
          const needsVerification =
            verification?.verificationStatus === "UNVERIFIED" ||
            verification?.verificationStatus === "REJECTED";

          return (
            <Card key={role} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="size-5 text-text-tertiary" />
                  <div>
                    <p className="text-body-md font-semibold text-text-primary">
                      {roleT(role)}
                    </p>
                    <p className="text-body-sm text-text-secondary">
                      {formatCurrency(rolePrices[role] ?? 0, "VND")}/mo
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
              </div>

              {verificationBadge ? (
                <div className="flex items-center justify-between border-t border-border-subtle pt-3">
                  <div className="flex flex-col gap-0.5">
                    <Badge variant={verificationBadge.variant}>
                      {verificationBadge.label}
                    </Badge>
                    {verification?.verificationStatus === "REJECTED" &&
                    verification.verificationRejectedReason ? (
                      <span className="text-body-sm text-text-secondary">
                        {verification.verificationRejectedReason}
                      </span>
                    ) : null}
                  </div>
                  {needsVerification ? (
                    <Button
                      size="sm"
                      variant="accent"
                      nativeButton={false}
                      render={
                        <Link href={`/onboarding/verification?role=${role}`} />
                      }
                    >
                      Verify identity
                    </Button>
                  ) : null}
                </div>
              ) : null}
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
                      {roleT(role)}
                    </p>
                    <p className="text-body-sm text-text-secondary">
                      {formatCurrency(rolePrices[role] ?? 0, "VND")}/mo
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
