"use client";

import type { Role } from "@prisma/client";
import {
  Building2,
  Camera,
  Loader2,
  Palette,
  ShoppingBag,
  Shirt,
  User,
  Video,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChoiceCard, ChoiceCardGroup } from "@/components/ui/choice-card";
import { PAID_ROLES, SHOP_ROLES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

interface RoleOption {
  role: Role;
  key: string;
  icon: LucideIcon;
}

const ROLE_OPTIONS: RoleOption[] = [
  { role: "PHOTOGRAPHER", key: "photographer", icon: Camera },
  { role: "VIDEOGRAPHER", key: "videographer", icon: Video },
  { role: "MAKEUP_ARTIST", key: "makeupArtist", icon: Palette },
  { role: "STUDIO", key: "studio", icon: Building2 },
  { role: "CAMERA_SHOP", key: "cameraShop", icon: ShoppingBag },
  { role: "COSTUME_SHOP", key: "costumeShop", icon: Shirt },
  { role: "MODEL", key: "model", icon: User },
  { role: "CUSTOMER", key: "customer", icon: User },
];

const isPaidRole = (role: Role) => (PAID_ROLES as Role[]).includes(role);

export function RoleSelectionForm({
  rolePrices,
  marketplaceEnabled,
}: {
  rolePrices: Partial<Record<Role, number>>;
  marketplaceEnabled: boolean;
}) {
  const t = useTranslations("uiKit.roleSelectionForm");
  const router = useRouter();
  const roleOptions = marketplaceEnabled
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((option) => !SHOP_ROLES.includes(option.role));
  const [selected, setSelected] = useState<Set<Role>>(new Set(["CUSTOMER"]));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // MVP scope decision — one provider role per account (CLAUDE.md).
  // Picking a paid role replaces whatever paid role was selected before,
  // rather than adding to it; CUSTOMER always stays selected.
  const toggleRole = (role: Role) => {
    if (role === "CUSTOMER") return;

    setSelected((prev) => {
      if (prev.has(role)) {
        return new Set(["CUSTOMER"]);
      }
      return new Set(["CUSTOMER", role]);
    });
  };

  const onContinue = async () => {
    setServerError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/users/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: Array.from(selected) }),
      });
      const body = await res.json();

      if (!res.ok) {
        setServerError(body.message ?? t("genericError"));
        setIsSubmitting(false);
        return;
      }

      const hasPaidRole = Array.from(selected).some(isPaidRole);
      router.push(hasPaidRole ? "/onboarding/billing" : "/dashboard");
    } catch {
      setServerError(t("genericError"));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <ChoiceCardGroup
        legend={t("groupLegend")}
        hideLegend
        className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      >
        {roleOptions.map(({ role, key, icon: Icon }) => {
          const isSelected = selected.has(role);
          const isCustomer = role === "CUSTOMER";
          const paid = isPaidRole(role);
          const price = rolePrices[role];

          return (
            <ChoiceCard
              key={role}
              name="roles"
              value={role}
              mode="multiple"
              selected={isSelected}
              disabled={isCustomer}
              onSelect={() => toggleRole(role)}
              icon={<Icon />}
              title={t(`roles.${key}.label`)}
              description={t(`roles.${key}.description`)}
            >
              {isCustomer ? (
                <Badge variant="secondary">{t("defaultBadge")}</Badge>
              ) : (
                <Badge variant="outline">
                  {t("subscriptionRequiredBadge")}
                </Badge>
              )}
              {paid && isSelected && price ? (
                <span className="text-body-sm text-text-secondary tabular-nums">
                  {formatCurrency(price, "VND")}
                  {t("perMonth")}
                </span>
              ) : null}
            </ChoiceCard>
          );
        })}
      </ChoiceCardGroup>

      <div className="flex justify-end">
        <Button size="lg" onClick={onContinue} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("continueButton")}
        </Button>
      </div>
    </div>
  );
}
