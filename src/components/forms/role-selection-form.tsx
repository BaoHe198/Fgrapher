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
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PAID_ROLES, ROLE_MONTHLY_PRICE } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface RoleOption {
  role: Role;
  label: string;
  description: string;
  icon: LucideIcon;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: "PHOTOGRAPHER",
    label: "Photographer",
    description: "Showcase your portfolio and get booked",
    icon: Camera,
  },
  {
    role: "VIDEOGRAPHER",
    label: "Videographer",
    description: "Share your reel and find clients",
    icon: Video,
  },
  {
    role: "MAKEUP_ARTIST",
    label: "Make-up Artist",
    description: "Get booked for shoots and events",
    icon: Palette,
  },
  {
    role: "STUDIO",
    label: "Studio for Rent",
    description: "List your space for creatives",
    icon: Building2,
  },
  {
    role: "CAMERA_SHOP",
    label: "Camera Shop",
    description: "Rent or sell your equipment",
    icon: ShoppingBag,
  },
  {
    role: "CUSTOMER",
    label: "Customer",
    description: "Find and book creative talent",
    icon: User,
  },
];

const isPaidRole = (role: Role) => (PAID_ROLES as Role[]).includes(role);

export function RoleSelectionForm() {
  const router = useRouter();
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
        setServerError(
          body.message ?? "Something went wrong. Please try again.",
        );
        setIsSubmitting(false);
        return;
      }

      const hasPaidRole = Array.from(selected).some(isPaidRole);
      router.push(hasPaidRole ? "/onboarding/billing" : "/dashboard");
    } catch {
      setServerError("Something went wrong. Please try again.");
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
        {ROLE_OPTIONS.map(({ role, label, description, icon: Icon }) => {
          const isSelected = selected.has(role);
          const isCustomer = role === "CUSTOMER";
          const paid = isPaidRole(role);
          const price = ROLE_MONTHLY_PRICE[role];

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
                  aria-label={`Select ${label}`}
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
                  <Badge variant="secondary">Default</Badge>
                ) : (
                  <Badge variant="outline">Subscription required</Badge>
                )}
                {paid && isSelected && price ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    ${price}/mo
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
          Continue
        </Button>
      </div>
    </div>
  );
}
