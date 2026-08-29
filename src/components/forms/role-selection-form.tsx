"use client";

import type { Role } from "@prisma/client";
import {
  Building2,
  Camera,
  Loader2,
  Palette,
  ShoppingBag,
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
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PAID_ROLES } from "@/lib/constants";
import { cn, formatCurrency } from "@/lib/utils";

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
    : ROLE_OPTIONS.filter((option) => option.role !== "CAMERA_SHOP");
  const [selected, setSelected] = useState<Set<Role>>(new Set(["CUSTOMER"]));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const toggleRole = (role: Role) => {
    if (role === "CUSTOMER") return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roleOptions.map(({ role, key, icon: Icon }) => {
          const isSelected = selected.has(role);
          const isCustomer = role === "CUSTOMER";
          const paid = isPaidRole(role);
          const price = rolePrices[role];
          const label = t(`roles.${key}.label`);
          const description = t(`roles.${key}.description`);

          return (
            <Card
              key={role}
              role="button"
              tabIndex={isCustomer ? -1 : 0}
              aria-pressed={isSelected}
              onClick={() => toggleRole(role)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleRole(role);
                }
              }}
              className={cn(
                "cursor-pointer p-5 transition-all hover:shadow-md hover:ring-primary/40",
                isSelected && "ring-2 ring-primary",
                isCustomer &&
                  "cursor-default opacity-90 hover:shadow-none hover:ring-foreground/10",
              )}
            >
              <div className="flex items-start justify-between">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary",
                    isSelected && "bg-primary text-primary-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <Checkbox
                  checked={isSelected}
                  disabled={isCustomer}
                  aria-label={t("selectRole", { role: label })}
                  onCheckedChange={() => toggleRole(role)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              <div className="mt-4 space-y-1">
                <h3 className="font-medium">{label}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {isCustomer ? (
                  <Badge variant="secondary">{t("defaultBadge")}</Badge>
                ) : (
                  <Badge variant="outline">
                    {t("subscriptionRequiredBadge")}
                  </Badge>
                )}
                {paid && isSelected && price ? (
                  <span className="text-sm font-medium text-muted-foreground">
                    {formatCurrency(price, "VND")}
                    {t("perMonth")}
                  </span>
                ) : null}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={onContinue} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("continueButton")}
        </Button>
      </div>
    </div>
  );
}
