"use client";

import type { Role, VerificationStatus } from "@prisma/client";
import {
  Camera,
  Loader2,
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
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { PAID_ROLES } from "@/lib/constants";

interface VerificationInfo {
  role: Role;
  verificationStatus: VerificationStatus;
  verificationRejectedReason: string | null;
}

const VERIFICATION_VARIANT: Record<
  VerificationStatus,
  "success" | "warning" | "destructive" | "neutral"
> = {
  UNVERIFIED: "neutral",
  PENDING: "warning",
  VERIFIED: "success",
  REJECTED: "destructive",
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
  verifications,
  marketplaceEnabled,
}: {
  currentRoles: Role[];
  verifications: VerificationInfo[];
  marketplaceEnabled: boolean;
}) {
  const roleT = useTranslations("role");
  const t = useTranslations("dashboardSettings.roles");
  const router = useRouter();
  const [activatingRole, setActivatingRole] = useState<Role | null>(null);
  const [removingRole, setRemovingRole] = useState<Role | null>(null);
  const activeRoles = currentRoles.filter((r) => r !== "CUSTOMER");
  // MVP scope decision — one provider role per account (CLAUDE.md): once
  // an account already holds one, hide the option to add another entirely
  // rather than letting them pick a second. The API route enforces this
  // too, this is just so the option never shows up to begin with.
  // CAMERA_SHOP additionally stays hidden while the marketplace is out of
  // MVP scope.
  const availableRoles =
    activeRoles.length > 0
      ? []
      : PAID_ROLES.filter(
          (r) =>
            !currentRoles.includes(r) &&
            (marketplaceEnabled || r !== "CAMERA_SHOP"),
        );
  const verificationByRole = new Map(verifications.map((v) => [v.role, v]));

  const activateRole = async (role: Role) => {
    setActivatingRole(role);
    try {
      const res = await fetch("/api/users/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: [role] }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.add({
          title: body.message ?? t("activateFailed"),
          type: "error",
        });
        return;
      }
      toast.add({
        title: t("activated", { role: roleT(role) }),
        type: "success",
      });
      router.refresh();
    } catch {
      toast.add({ title: t("activateFailed"), type: "error" });
    } finally {
      setActivatingRole(null);
    }
  };

  // MVP-stage-only: undoing a self-activated role is allowed as long as
  // it's never been verified — once VERIFIED, removal has to go through
  // an admin like everything else billing-adjacent while
  // BILLING_ENABLED=false. The API enforces this too; this is just the UI
  // gate.
  const removeRole = async (role: Role) => {
    if (!window.confirm(t("removeRoleConfirm", { role: roleT(role) }))) return;
    setRemovingRole(role);
    try {
      const res = await fetch(`/api/users/roles/${role}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        toast.add({ title: body.message ?? t("removeFailed"), type: "error" });
        return;
      }
      toast.add({
        title: t("removed", { role: roleT(role) }),
        type: "success",
      });
      router.refresh();
    } catch {
      toast.add({ title: t("removeFailed"), type: "error" });
    } finally {
      setRemovingRole(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="text-caption-upper tracking-[0.08em] text-text-tertiary">
          {t("yourRoles")}
        </span>

        <Card className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <User className="size-5 text-text-tertiary" />
            <div>
              <p className="text-body-md font-semibold! text-text-primary">
                {t("customer")}
              </p>
              <p className="text-body-sm text-text-secondary">
                {t("alwaysFree")}
              </p>
            </div>
          </div>
          <Badge variant="success">{t("active")}</Badge>
        </Card>

        {activeRoles.map((role) => {
          const Icon = ROLE_ICONS[role];
          const verification = verificationByRole.get(role);
          const verificationBadge = verification
            ? {
                label: t(
                  `verificationBadge.${verification.verificationStatus}`,
                ),
                variant: VERIFICATION_VARIANT[verification.verificationStatus],
              }
            : null;
          const needsVerification =
            verification?.verificationStatus === "UNVERIFIED" ||
            verification?.verificationStatus === "REJECTED";
          const canRemove = verification?.verificationStatus !== "VERIFIED";
          const isRemoving = removingRole === role;

          return (
            <Card key={role} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="size-5 text-text-tertiary" />
                  <p className="text-body-md font-semibold! text-text-primary">
                    {roleT(role)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="success">{t("active")}</Badge>
                  <Button
                    size="sm"
                    variant="secondary"
                    nativeButton={false}
                    render={<Link href="/dashboard/settings/billing" />}
                  >
                    {t("manage")}
                  </Button>
                  {canRemove ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      disabled={removingRole !== null}
                      onClick={() => removeRole(role)}
                    >
                      {isRemoving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                      {t("removeRole")}
                    </Button>
                  ) : null}
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
                      {t("verifyIdentity")}
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
            {t("addRole")}
          </span>
          {availableRoles.map((role) => {
            const Icon = ROLE_ICONS[role];
            const isActivating = activatingRole === role;
            return (
              <Card key={role} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="size-5 text-text-tertiary" />
                  <p className="text-body-md font-semibold! text-text-primary">
                    {roleT(role)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="accent"
                  disabled={activatingRole !== null}
                  onClick={() => activateRole(role)}
                >
                  {isActivating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {t("activate")}
                </Button>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
